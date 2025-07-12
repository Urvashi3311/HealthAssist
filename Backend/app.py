from flask import Flask, render_template, request, jsonify, send_from_directory, session,url_for
from pymongo import MongoClient
from langchain_core.messages import HumanMessage, BaseMessage, AIMessage
from langchain.chat_models import init_chat_model
from datetime import datetime,timezone
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

# ----- Flask setup -----
app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')
# In app.py, update CORS configuration
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])
app.secret_key = os.urandom(24)


# ----- MongoDB Setup -----
client = MongoClient('mongodb://localhost:27017/')
db = client['Chatbot']
chat_collection = db['Chats']
users_collection = db['Users']

# ----- LangGraph initialization -----
groq_api_key = os.getenv("GROQ_API_KEY")
model = init_chat_model("llama3-8b-8192", model_provider="groq", api_key=groq_api_key)
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

# ----- MongoDB helper functions -----
def save_message(session_id, message, sender):
    user_email = session.get('user_email')
    message_data = {
         "_id": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"),
         # Unique ID for each message
        "sender": sender, 
        "content": message, 
        "timestamp": datetime.now(timezone.utc)

    }
    
    update_data = {
        "$push": {"messages": message_data},
        "$set": {"last_updated": datetime.now(timezone.utc)


}
    }
    
    if user_email:
        update_data["$set"]["user_email"] = user_email
    
    chat_collection.update_one(
        {"session_id": session_id},
        update_data,
        upsert=True
    )

def get_sessions():
    # Get user_email from session
    user_email = session.get('user_email')
    
    # Filter by user_email if available
    query = {"user_email": user_email} if user_email else {}
    sessions = chat_collection.find(query, {"session_id": 1, "last_updated": 1, "_id": 0}).sort("last_updated", -1)
    return [{"session_id": doc['session_id'], "last_updated": doc['last_updated'].strftime("%Y-%m-%d %H:%M:%S")} for doc in sessions]

def get_messages_for_session(session_id):
    user_email = session.get('user_email')
    
    query = {"session_id": session_id}
    if user_email:
        query["user_email"] = user_email
    
    chat = chat_collection.find_one(query, {"_id": 0, "messages": 1})
    return chat.get("messages", []) if chat else []

def generate_bot_response(session_id, user_input):
    # Get previous messages
    previous_messages = get_messages_for_session(session_id)
    
    # Convert to LangChain message format
    history = []
    for msg in previous_messages:
        content = msg.get('content') or msg.get('messages')
        if content:
            if msg['sender'] == 'user':
                history.append(HumanMessage(content=content))
            else:
                history.append(AIMessage(content=content))
    
    # Add current message
    history.append(HumanMessage(content=user_input))
    
    # Generate response
    state = {'messages': history}
    response = langgraph_app.invoke(
        state,
        config={"configurable": {"thread_id": session_id}}
    )
    answer = response['messages'][-1].content if response['messages'] else "No response"
    formatted_answer = answer.replace("\u2022", "\n•")
    
    return formatted_answer

# ----- Flask routes -----

# Serve the React app
@app.route('/')
def serve():
    if 'user_email' not in session:
        return send_from_directory(app.static_folder,'index.html')
    return send_from_directory(app.static_folder, 'index.html')

# Serve static files (JS, CSS, etc.)
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

# API route to get all sessions for a user
@app.route("/api/sessions", methods=['GET'])
def get_all_sessions():
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "Not authenticated. Please log in."}), 401
    
    sessions = get_sessions()
    return jsonify(sessions)

# API route to create a new session
@app.route("/api/sessions", methods=['POST'])
def create_session():
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "Not authenticated. Please log in."}), 401
    
    data = request.json
    session_id = data.get('session_id', datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f"))

    
    # Create a new session with user_email from session
    chat_collection.insert_one({
        "session_id": session_id,
        "user_email": user_email,
        "messages": [],
       "last_updated": datetime.now(timezone.utc)


    })
    
    return jsonify({"session_id": session_id, "status": "created"})

# API route to get messages for a session
@app.route("/api/sessions/<session_id>/messages", methods=['GET'])
def get_session_messages(session_id):
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "Not authenticated. Please log in."}), 401
    
    messages = get_messages_for_session(session_id)
    return jsonify(messages)

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop('user_email', None)  # Clear session data
    return jsonify({"message": "Logged out successfully", "redirect": "/login"}), 200


# API route to send a message and get a response
@app.route("/api/sessions/<session_id>/messages", methods=['POST'])
def send_message(session_id):
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "Not authenticated. Please log in."}), 401
    
    data = request.json
    user_input = data.get('message')
    
    if not user_input:
        return jsonify({'error': 'No message provided'}), 400
    
    # Save user message
    save_message(session_id, user_input, 'user')
    
    # Generate bot response
    bot_response = generate_bot_response(session_id, user_input)
    
    # Save bot response
    save_message(session_id, bot_response, 'bot')
    
    return jsonify({
        'user_message': user_input,
        'bot_response': bot_response
    })

# ----- User Authentication Routes -----

# API route for user signup
@app.route("/api/signup", methods=['POST'])
def signup():
    data = request.get_json()
    
    # Validate input data
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
        existing_user = users_collection.find_one({"email": email})
        if existing_user:
            return jsonify({"error": "Email already registered"}), 409
        
        hashed_password = generate_password_hash(password)
        
        # Insert new user
        users_collection.insert_one({
            "email": email,
            "password": hashed_password,
            "created_at": datetime.now(timezone.utc)


        })
        
        session['user_email'] = email
        
        return jsonify({"message": "User registered successfully"}), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# API route for user login
@app.route("/api/login", methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Email and password are required"}), 400
    
    email = data['email']
    password = data['password']
    
    try:
        # Find user
        user = users_collection.find_one({"email": email})
        
        # Check if user exists
        if not user:
            return jsonify({"verified": False, "error": "User not found"}), 401
        
        # Verify password
        if not check_password_hash(user['password'], password):
            return jsonify({"verified": False, "error": "Invalid password"}), 401
        
        # Store email in session
        session['user_email'] = email

        # User verification successful
        return jsonify({
            "verified": True,
            "message": "Login successful",
            "user": {
                "email": user['email'],
                "created_at": user['created_at']
            }
        }), 200
    
    except Exception as e:
        return jsonify({"verified": False, "error": str(e)}), 500

@app.route("/api/check-auth", methods=["GET"])
def check_auth():
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"authenticated": False, "error": "User not authenticated"}), 401

    user = users_collection.find_one({"email": user_email})

    if user:
        return jsonify({"authenticated": True, "email": user_email}), 200
    else:
        # Clear invalid session
        session.pop('user_email', None)
        return jsonify({"authenticated": False, "error": "User not found"}), 401

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    # TODO: Replace this with your actual deletion logic
    try:
        # Example: remove session from database or in-memory store
        print(f"Deleting session {session_id}")
        return {"message": "Session deleted successfully"}, 200
    except Exception as e:
        return {"error": str(e)}, 500
@app.route('/emergency-map')
def emergency_map():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Nearby Hospitals</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                padding: 20px;
                text-align: center;
            }
            iframe {
                width: 90%;
                height: 500px;
                border: none;
                border-radius: 10px;
                margin-top: 20px;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            }
            .loading {
                font-size: 18px;
                color: #444;
            }
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


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
