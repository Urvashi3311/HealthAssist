import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatBox from './components/ChatBox';
import MessageInput from './components/MessageInput';
import Login from './components/Login';
import Signup from './components/Signup';
import EmergencyMap from './components/EmergencyMap';
import VoiceAssistant from './components/VoiceAssistant';
import MapNavigation from './components/MapNavigation';

import {
  checkAuth,
  logout,
  createSession,
  fetchMessages,
  sendMessage
} from './services/api';
import './styles.css';

// DASHBOARD COMPONENT
function Dashboard() {
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        if (!activeSessionId) {
          const newSession = await createSession();
          if (newSession) {
            setActiveSessionId(newSession.session_id);
          } else {
            setError('Failed to create a session');
          }
        }
      } catch (error) {
        setError('Error initializing session');
        console.error('Error creating session:', error);
      }
    };
    initializeApp();
  }, [activeSessionId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (activeSessionId) {
        setLoading(true);
        try {
          const messagesData = await fetchMessages(activeSessionId);
          setMessages(messagesData);
        } catch (error) {
          setError('Error loading messages');
          console.error('Error fetching messages:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadMessages();
  }, [activeSessionId]);

  const handleSendMessage = async (messageText) => {
    const userMessage = {
      sender: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    setMessages([...messages, userMessage]);
    setLoading(true);

    try {
      const response = await sendMessage(activeSessionId, messageText);
      if (response) {
        const botMessage = {
          sender: 'bot',
          content: response.bot_response,
          timestamp: new Date().toISOString(),
        };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      } else {
        setError('No response from bot');
      }
    } catch (error) {
      setError('Error sending message');
      console.error('Error sending message:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = (transcript) => {
    // Auto-send voice input as a message
    if (transcript.trim() && !loading) {
      handleSendMessage(transcript.trim());
    }
  };

  const handlePlayResponse = (speakFunction) => {
    // Find the last bot message and read it aloud
    const lastBotMessage = [...messages].reverse().find(msg => msg.sender === 'bot');
    if (lastBotMessage && speakFunction) {
      speakFunction(lastBotMessage.content);
    }
  };

  const handleNavigateToMap = () => {
    navigate('/emergency-map');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setError('Error during logout');
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="app">
      <Sidebar 
        onSelectSession={(sessionId) => setActiveSessionId(sessionId)} 
        activeSessionId={activeSessionId}
        onNavigateToMap={handleNavigateToMap}
      />
      <div className="main-content">
        <Header onLogout={handleLogout} />
        <div className="chat-container">
          {error && <div className="error-message">{error}</div>}
          <ChatBox
            messages={messages}
            sessionId={activeSessionId}
            onMessagesUpdated={setMessages}
          />
          <MessageInput 
            onSendMessage={handleSendMessage} 
            disabled={loading || !activeSessionId} 
          />
        </div>
      </div>
      
      {/* Add Voice Assistant Component */}
      <VoiceAssistant 
        onTranscript={handleVoiceInput}
        onPlayResponse={handlePlayResponse}
      />
    </div>
  );
}

// APP COMPONENT
function AppRouter() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const result = await checkAuth();
        setAuthenticated(result.authenticated);
      } catch (error) {
        setError('Authentication check failed');
        console.error('Authentication check failed:', error);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={authenticated ? <Navigate to="/dashboard" /> : <Login setAuthenticated={setAuthenticated} />} />
      <Route path="/signup" element={authenticated ? <Navigate to="/dashboard" /> : <Signup setAuthenticated={setAuthenticated} />} />
      <Route path="/dashboard" element={authenticated ? <Dashboard /> : <Navigate to="/login" />} />
      <Route path="/emergency-map" element={authenticated ? <EmergencyMapWrapper /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to={authenticated ? "/dashboard" : "/login"} />} />
      <Route path="*" element={<Navigate to={authenticated ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

// Emergency Map Wrapper with Navigation
function EmergencyMapWrapper() {
  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <MapNavigation />
      <EmergencyMap />
    </div>
  );
}

// WRAPPED IN BROWSERROUTER
function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;