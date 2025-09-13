from flask import Flask, render_template, request, jsonify, send_from_directory, session, url_for
from pymongo import MongoClient
from langchain_core.messages import HumanMessage, BaseMessage, AIMessage
from langchain.chat_models import init_chat_model
from datetime import datetime, timezone
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from typing import Sequence
from typing_extensions import Annotated, TypedDict
import os
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import re
import math
from math import radians, sin, cos, atan2, sqrt
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# ----- Flask setup -----
app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')

# Enhanced CORS configuration
CORS(app, 
    supports_credentials=True,
    origins=["http://localhost:3000", "http://localhost:3001"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept"],
    expose_headers=["Content-Type", "Authorization"]
)

app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False

# Add CORS headers to all responses
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    return response

# ----- MongoDB Setup -----
try:
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
    client.server_info()  # Force connection check
    db = client['Chatbot']
    chat_collection = db['Chats']
    users_collection = db['Users']
    logger.info("MongoDB connection successful")
except Exception as e:
    logger.error(f"MongoDB connection failed: {e}")
    # Fallback to in-memory storage if MongoDB fails
    chat_collection = None
    users_collection = None

# ----- LangGraph initialization -----
groq_api_key = os.getenv("GROQ_API_KEY")
langgraph_app = None

if not groq_api_key:
    logger.error("GROQ_API_KEY not found in environment variables")
else:
    try:
        model = init_chat_model("llama-3.1-8b-instant", model_provider="groq", api_key=groq_api_key)
        prompt_template = ChatPromptTemplate.from_messages([
            ("system",
             "You are a healthcare bot. Your job is to advice homely remedies to patients who contact you. If the query seems too serious you should advice to seek professional help."),
            MessagesPlaceholder(variable_name="messages")
        ])

        class State(TypedDict):
            messages: Annotated[Sequence[BaseMessage], add_messages]

        workflow = StateGraph(state_schema=State)

        def call_model(state: State):
            prompt = prompt_template.invoke({"messages": state["messages"]})
            response = model.invoke(prompt)
            return {"messages": [response]}

        workflow.add_node("model", call_model)
        workflow.add_edge(START, "model")
        memory = MemorySaver()
        langgraph_app = workflow.compile(checkpointer=memory)
        logger.info("LangGraph initialization successful")
    except Exception as e:
        logger.error(f"LangGraph initialization failed: {e}")

# ----- Fallback responses for when GROQ API is down -----
def get_fallback_response(user_input):
    fallback_responses = {
        "hello": "Hello! I'm HealthAssist. How can I help you today?",
        "hi": "Hi there! What health concern would you like to discuss?",
        "help": "I can provide home remedies and health advice. Please describe your symptoms.",
        "fever": "For fever, try resting, drinking plenty of fluids, and taking acetaminophen or ibuprofen as directed. If fever persists above 103°F (39.4°C) or lasts more than 3 days, please consult a doctor.",
        "headache": "For headaches, try resting in a quiet dark room, applying a cool compress, and staying hydrated. Over-the-counter pain relievers may help. If headaches are severe or frequent, consult a doctor.",
        "cough": "For cough, try honey in warm tea, staying hydrated, and using a humidifier. If cough persists for more than a week or is accompanied by fever, see a doctor.",
        "cold": "For cold symptoms, rest, drink fluids, use saline nasal spray, and consider over-the-counter cold remedies. If symptoms worsen or last more than 10 days, see a doctor.",
        "sore throat": "For sore throat, try warm salt water gargles, honey lemon tea, and throat lozenges. If severe or accompanied by fever, see a doctor.",
        "nausea": "For nausea, try ginger tea, small bland meals, and staying hydrated with clear fluids. If persistent or severe, consult a doctor.",
        "emergency": "⚠️ This may be a medical emergency. Please call emergency services or go to the nearest hospital immediately."
    }
    
    user_input_lower = user_input.lower()
    for keyword, response in fallback_responses.items():
        if keyword in user_input_lower:
            return response
    
    return "I understand you're seeking health advice. Currently, I'm experiencing technical difficulties with my AI service. Please try again in a few moments, or describe your symptoms clearly and I'll provide general guidance based on common remedies."

# ----- MongoDB helper functions -----
def save_message(session_id, message, sender):
    if chat_collection is None:
        logger.warning("MongoDB not available, message not saved")
        return
    
    user_email = session.get('user_email')
    message_data = {
        "_id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"),
        "sender": sender, 
        "content": message, 
        "timestamp": datetime.now(timezone.utc)
    }
    
    update_data = {
        "$push": {"messages": message_data},
        "$set": {"last_updated": datetime.now(timezone.utc)}
    }
    
    if user_email:
        update_data["$set"]["user_email"] = user_email
    
    try:
        chat_collection.update_one(
            {"session_id": session_id},
            update_data,
            upsert=True
        )
    except Exception as e:
        logger.error(f"Failed to save message: {e}")

def get_sessions():
    if chat_collection is None:
        return []
    
    user_email = session.get('user_email')
    query = {"user_email": user_email} if user_email else {}
    
    try:
        sessions = chat_collection.find(query, {"session_id": 1, "last_updated": 1, "_id": 0}).sort("last_updated", -1)
        return [{"session_id": doc['session_id'], "last_updated": doc['last_updated'].strftime("%Y-%m-%d %H:%M:%S")} for doc in sessions]
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}")
        return []

def get_messages_for_session(session_id):
    if chat_collection is None:
        return []
    
    user_email = session.get('user_email')
    query = {"session_id": session_id}
    if user_email:
        query["user_email"] = user_email
    
    try:
        chat = chat_collection.find_one(query, {"_id": 0, "messages": 1})
        return chat.get("messages", []) if chat else []
    except Exception as e:
        logger.error(f"Failed to get messages: {e}")
        return []

def generate_bot_response(session_id, user_input):
    if langgraph_app is None:
        logger.warning("Using fallback response system")
        return get_fallback_response(user_input)
    
    try:
        previous_messages = get_messages_for_session(session_id)
        history = []
        
        for msg in previous_messages:
            content = msg.get('content') or msg.get('messages')
            if content:
                if msg['sender'] == 'user':
                    history.append(HumanMessage(content=content))
                else:
                    history.append(AIMessage(content=content))
        
        history.append(HumanMessage(content=user_input))
        logger.debug(f"History for session {session_id}: {len(history)} messages")
        
        state = {'messages': history}
        
        response = langgraph_app.invoke(
            state,
            config={"configurable": {"thread_id": session_id}}
        )
        
        answer = response['messages'][-1].content if response['messages'] else "No response"
        formatted_answer = answer.replace("\u2022", "\n•")
        logger.debug(f"Bot response generated: {formatted_answer[:100]}...")
        return formatted_answer
    
    except Exception as e:
        logger.error(f"Error generating bot response: {e}")
        return get_fallback_response(user_input)

# ----- Directions API endpoint -----
@app.route('/api/directions', methods=['POST', 'OPTIONS'])
def get_directions():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        coordinates = data.get('coordinates', [])
        
        if len(coordinates) < 2:
            return jsonify({"error": "At least two coordinates are required"}), 400
        
        # Extract start and end coordinates
        start_lon, start_lat = coordinates[0]
        end_lon, end_lat = coordinates[1]
        
        # Calculate distance using Haversine formula (more accurate)
        R = 6371000  # Earth radius in meters
        lat1 = radians(start_lat)
        lon1 = radians(start_lon)
        lat2 = radians(end_lat)
        lon2 = radians(end_lon)
        
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        distance_meters = R * c
        
        # Estimate time based on average driving speed (50 km/h ≈ 13.89 m/s)
        # Add some extra time for traffic and stops
        duration_seconds = (distance_meters / 13.89) * 1.3
        
        return jsonify({
            "routes": [{
                "summary": {
                    "distance": distance_meters,  # meters
                    "duration": duration_seconds  # seconds
                }
            }]
        })
    except Exception as e:
        logger.error(f"Directions error: {e}")
        return jsonify({"error": str(e)}), 500

# ----- OPTIONS handlers for preflight requests -----
@app.route("/api/sessions", methods=['OPTIONS'])
def options_sessions():
    return '', 200

@app.route("/api/sessions/<session_id>/messages", methods=['OPTIONS'])
def options_session_messages(session_id):
    return '', 200

@app.route("/api/login", methods=['OPTIONS'])
def options_login():
    return '', 200

@app.route("/api/signup", methods=['OPTIONS'])
def options_signup():
    return '', 200

@app.route("/api/logout", methods=['OPTIONS'])
def options_logout():
    return '', 200

@app.route("/api/check-auth", methods=['OPTIONS'])
def options_check_auth():
    return '', 200

@app.route("/api/directions", methods=['OPTIONS'])
def options_directions():
    return '', 200

# ----- Flask routes -----
@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

@app.route("/api/sessions", methods=['GET'])
def get_all_sessions():
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"authenticated": False, "error": "Not authenticated. Please log in."}), 200
    
    sessions = get_sessions()
    return jsonify(sessions)

@app.route("/api/sessions", methods=['POST'])
def create_session():
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"authenticated": False, "error": "Not authenticated. Please log in."}), 200
    
    data = request.json
    session_id = data.get('session_id', datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"))
    
    if chat_collection is not None:
        chat_collection.insert_one({
            "session_id": session_id,
            "user_email": user_email,
            "messages": [],
            "last_updated": datetime.now(timezone.utc)
        })
    
    return jsonify({"session_id": session_id, "status": "created"})

@app.route("/api/sessions/<session_id>/messages", methods=['GET'])
def get_session_messages(session_id):
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"authenticated": False, "error": "Not authenticated. Please log in."}), 200
    
    messages = get_messages_for_session(session_id)
    return jsonify(messages)

@app.route("/api/sessions/<session_id>/messages", methods=['POST'])
def send_message(session_id):
    user_email = session.get('user_email')
    if not user_email:
        return jsonify({"authenticated": False, "error": "Not authenticated. Please log in."}), 200
    
    data = request.json
    user_input = data.get('message')
    
    if not user_input:
        return jsonify({'error': 'No message provided'}), 400
    
    logger.info(f"Received message from {user_email}: {user_input}")
    
    save_message(session_id, user_input, 'user')
    bot_response = generate_bot_response(session_id, user_input)
    save_message(session_id, bot_response, 'bot')
    
    logger.info(f"Sent bot response: {bot_response[:100]}...")
    
    return jsonify({
        'user_message': user_input,
        'bot_response': bot_response
    })

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop('user_email', None)
    return jsonify({"message": "Logged out successfully", "redirect": "/login"}), 200

@app.route("/api/signup", methods=['POST'])
def signup():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400
    
    email = data['email']
    password = data['password']
    
    email_pattern = r'^[\w\.-]+@[\w\.-]+\.\w+$'
    if not re.match(email_pattern, email):
        return jsonify({"error": "Invalid email format"}), 400
    
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400
    
    try:
        if users_collection is not None:
            existing_user = users_collection.find_one({"email": email})
            if existing_user:
                return jsonify({"error": "Email already registered"}), 409
        
        hashed_password = generate_password_hash(password)
        if users_collection is not None:
            users_collection.insert_one({
                "email": email,
                "password": hashed_password,
                "created_at": datetime.now(timezone.utc)
            })
        
        session['user_email'] = email
        return jsonify({"message": "User registered successfully"}), 201
    
    except Exception as e:
        logger.error(f"Signup error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/login", methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400
    
    email = data['email']
    password = data['password']
    
    try:
        user = None
        if users_collection is not None:
            user = users_collection.find_one({"email": email})
        
        if not user:
            return jsonify({"verified": False, "error": "User not found"}), 200
        
        if not check_password_hash(user['password'], password):
            return jsonify({"verified": False, "error": "Invalid password"}), 200
        
        session['user_email'] = email
        return jsonify({
            "verified": True,
            "message": "Login successful",
            "user": {
                "email": user['email'],
                "created_at": user['created_at']
            }
        }), 200
    
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"verified": False, "error": str(e)}), 500

@app.route("/api/check-auth", methods=["GET"])
def check_auth():
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"authenticated": False, "error": "User not authenticated"}), 200

    user = None
    if users_collection is not None:
        user = users_collection.find_one({"email": user_email})
    
    if user:
        return jsonify({"authenticated": True, "email": user_email}), 200
    else:
        session.pop('user_email', None)
        return jsonify({"authenticated": False, "error": "User not found"}), 200

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    try:
        user_email = session.get('user_email')
        if not user_email:
            return jsonify({"authenticated": False, "error": "Not authenticated"}), 200
        
        if chat_collection is not None:
            result = chat_collection.delete_one({"session_id": session_id, "user_email": user_email})
            if result.deleted_count > 0:
                return jsonify({"message": "Session deleted successfully"}), 200
            else:
                return jsonify({"error": "Session not found"}), 404
        else:
            return jsonify({"message": "Session deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Delete session error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/emergency-map')
def emergency_map():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Nearby Hospitals</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
            iframe { width: 90%; height: 500px; border: none; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .loading { font-size: 18px; color: #444; }
        </style>
    </head>
    <body>
        <h2>🗺️ Finding Nearby Hospitals...</h2>
        <p class="loading">Trying to detect your current location. Please allow location access.</p>
        <div id="map-container"></div>
        <script>
            function showMap(lat, lon) {
                const iframe = document.createElement('iframe');
                iframe.src = `https://www.google.com/maps?q=hospitals+near+${lat},${lon}&output=embed`;
                document.querySelector('.loading').style.display = 'none';
                document.getElementById('map-container').appendChild(iframe);
            }
            function showError(message) {
                document.querySelector('.loading').textContent = "⚠️ " + message;
            }
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lon = position.coords.longitude;
                        showMap(lat, lon);
                    },
                    () => showError('Location access denied. Please allow it or search manually.')
                );
            } else {
                showError('Geolocation not supported by this browser.');
            }
        </script>
    </body>
    </html>
    '''

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint to check if the API and GROQ service are working"""
    groq_status = "active" if langgraph_app is not None else "inactive"
    mongo_status = "connected" if chat_collection is not None else "disconnected"
    
    return jsonify({
        "status": "ok",
        "groq_api": groq_status,
        "mongodb": mongo_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    logger.info(f"GROQ API Status: {'Available' if langgraph_app is not None else 'Unavailable'}")
    logger.info(f"MongoDB Status: {'Connected' if chat_collection is not None else 'Disconnected'}")
    app.run(host='127.0.0.1', port=5000, debug=True)