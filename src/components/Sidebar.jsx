import React, { useEffect, useState } from 'react';
import { fetchSessions, createSession, deleteSession } from '../services/api';

const Sidebar = ({ onSelectSession, activeSessionId }) => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const sessionsData = await fetchSessions();
      setSessions(sessionsData);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const newSession = await createSession();
      if (newSession) {
        setSessions([newSession, ...sessions]);
        onSelectSession(newSession.session_id);
      }
    } catch (error) {
      console.error("Error creating session:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat session?')) {
      try {
        const result = await deleteSession(sessionId);
        if (!result.error) {
          const updatedSessions = sessions.filter(session => session.session_id !== sessionId);
          setSessions(updatedSessions);

          if (activeSessionId === sessionId) {
            onSelectSession(null);
          }
        }
      } catch (error) {
        console.error("Error deleting session:", error);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Previous Chats</h2>
        <button 
          onClick={handleCreateSession} 
          className="new-chat-btn"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'New Chat'}
        </button>
      </div>

      <div className="sessions-scroll">
        {loading && sessions.length === 0 ? (
          <div className="loading-sessions">Loading chats...</div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className={`session-item ${session.session_id === activeSessionId ? 'active' : ''}`}
                onClick={() => onSelectSession(session.session_id)}
              >
                <div className="session-header">
                  <div className="session-title">
                    Chat {session.session_id.substring(0, 8)}...
                  </div>
                  <button 
                    className="delete-session-btn"
                    onClick={(e) => handleDeleteSession(session.session_id, e)}
                    title="Delete this chat"
                  >
                    ×
                  </button>
                </div>
                <div className="session-date">
                  {formatDate(session.last_updated)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
