import axios from 'axios';


const API_URL = 'http://localhost:5000/api';

// Configure axios to include credentials (cookies) with requests
axios.defaults.withCredentials = true;

// Sends POST request to /login.
// Handles login, signup, and authentication.
export const login = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}/login`, {
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    return { verified: false, error: error.response?.data?.error || 'Login failed' };
  }
};

// Sends a POST request to '/signup'.
// Used by Signup.jsx
export const signup = async (email, password) => {
  try {
    const response = await axios.post(`${API_URL}/signup`, {
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Signup error:', error);
    return { error: error.response?.data?.error || 'Signup failed' };
  }
};

// Sends a POST request to '/logout'.
// Logs the user out.
export const logout = async () => {
  try {
    const response = await axios.post(`${API_URL}/logout`, {}, { withCredentials: true });
    if (response.status !== 200) {
      throw new Error(`Logout failed with status ${response.status}`);
    }
    return response.data;
  } catch (error) {
    console.error('Logout error:', error.response?.data || error.message);
    return { error: error.response?.data?.message || 'Logout failed' };
  }
};

// Sends a DELETE request to '/sessions/{sessionId}/messages/{messageId}'.
// Deletes a message from the session.
export const deleteMessage = async (sessionId, messageId) => {
  try {
    if (!sessionId || !messageId) {
      throw new Error("Session ID or Message ID is missing");
    }

    const response = await axios.delete(`${API_URL}/sessions/${sessionId}/messages/${messageId}`, {
      withCredentials: true
    });

    return response.data; // Assuming API returns a success message or data
  } catch (error) {
    console.error('Error deleting message:', error.response ? error.response.data : error.message);
    return { error: error.response?.data?.error || 'Failed to delete message' };
  }
};


// Sends GET request to '/sessions'.
// Retrieves all the sessions for a user.
export const fetchSessions = async () => {
  try {
    const response = await axios.get(`${API_URL}/sessions`);
    return response.data;
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
};

// Sends POST request to '/session'.
// Creates a new chat session for the authenticated user.
export const createSession = async (userEmail) => {
  try {
    const response = await axios.post(`${API_URL}/sessions`, 
      { email: userEmail },  // Send email in the request body
      { headers: { "Content-Type": "application/json" } } // Set correct headers
    );

    if (response.data && response.data.session_id) {
      return response.data;
    } else {
      console.error("Session created but no session_id returned");
      return null;
    }
  } catch (error) {
    console.error('Error creating session:', error.response?.data || error.message);
    return null;
  }
};

// Sends the GET request to 'sessions/{sessionID}/messages'.
// Fetches all messages in a chat session.
export const fetchMessages = async (sessionId) => {
  try {
    const response = await axios.get(`${API_URL}/sessions/${sessionId}/messages`);
    return response.data;
  } catch (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
};

// Sends a POST request to '/sessions/{sessionsId}/messages'.
// Responsible for carrying user response to LLM and getting the response back from LLM.
export const sendMessage = async (sessionId, message) => {
  try {
    const response = await axios.post(`${API_URL}/sessions/${sessionId}/messages`, {
      message
    });
    return response.data;
  } catch (error) {
    console.error('Error sending message:', error);
    return null;
  }
};

// Sends PUT request to '/sessions/{sessionsId}/messages/{messageId}'.
// Updates an existing message in a chat session.
export const updateMessage = async (sessionId, messageId, newContent) => {
  try {
    if (!sessionId || !messageId || !newContent) {
      throw new Error("Session ID, Message ID, or New Content is missing");
    }

    const response = await axios.patch(`${API_URL}/sessions/${sessionId}/messages/${messageId}`, {
      content: newContent
    }, {
      withCredentials: true
    });

    return response.data; // Assuming API returns a success message or data
  } catch (error) {
    console.error('Error updating message:', error.response ? error.response.data : error.message);
    return { error: error.response?.data?.error || 'Failed to update message' };
  }
};

// Sends a DELETE request to '/sessions/{sessionId}'.
// Deletes a session and all its associated messages.
export const deleteSession = async (sessionId) => {
  try {
    const response = await axios.delete(`${API_URL}/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting session:', error);
    return { error: error.response?.data?.error || 'Failed to delete session' };
  }
};
// Sends a GET request to '/check-auth'.
// Checks if user is authenticated. If the user is not, returns False.
export const checkAuth = async () => {
  try {
    const response = await axios.get(`${API_URL}/check-auth`, {
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Auth check error:', error);
    return { authenticated: false };
  }
};

