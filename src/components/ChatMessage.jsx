// src/components/ChatMessage.jsx
import React, { useState } from 'react';
import { deleteMessage, updateMessage } from '../services/api';

const ChatMessage = ({ message, sessionId, onMessageUpdated, onMessageDeleted }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content || message.messages);
  const [isHovered, setIsHovered] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    const result = await updateMessage(sessionId, message._id, editedContent);
    if (!result.error) {
      onMessageUpdated(message._id, editedContent);
      setIsEditing(false);
    }
  };

  const handleDelete = async () => {
    if (!sessionId || !message._id) {
      console.error("Invalid sessionId or message ID");
      return;
    }

    const response = await deleteMessage(sessionId, message._id);
    if (response.success) {
      onMessageDeleted(message._id);
    } else {
      console.error("Failed to delete message:", response.error);
    }
  };

  const isUser = message.sender === 'user';

  return (
    <div
      className={`message ${isUser ? 'user-message' : 'bot-message'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isEditing ? (
        <div className="edit-message-container">
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="edit-message-input"
          />
          <div className="edit-message-actions">
            <button onClick={handleSave} className="save-edit-btn">Save</button>
            <button onClick={() => setIsEditing(false)} className="cancel-edit-btn">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          {/* Render message content with HTML support */}
          <div
            className="message-bubble"
            dangerouslySetInnerHTML={{ __html: message.content || message.messages }}
          />

          {/* Only show edit/delete for user messages */}
          {isHovered && isUser && (
            <div className="message-actions">
              <button onClick={handleEdit} className="edit-btn">✏️</button>
              <button onClick={handleDelete} className="delete-btn">🗑️</button>
            </div>
          )}

          <div className="message-info">
            <span className="sender">{isUser ? 'You' : 'Bot'}</span>
            <span className="timestamp">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatMessage;
