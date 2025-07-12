// src/components/ChatBox.jsx
import React, { useEffect, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';

const ChatBox = ({ messages, sessionId, onMessagesUpdated }) => {
  const messagesEndRef = useRef(null);
  const [showEmergencyOptions, setShowEmergencyOptions] = useState(false);

  const emergencyOptions = [
    { emoji: '💔', text: 'Chest pain' },
    { emoji: '🌬️', text: 'Difficulty breathing' },
    { emoji: '💉', text: 'Severe bleeding' },
    { emoji: '🧠', text: 'Seizure or unconsciousness' },
    { emoji: '🐍', text: 'Snake or insect bite' },
    { emoji: '🔥', text: 'High fever in a child' },
    { emoji: '🚫', text: 'None of these' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleEmergencyClick = () => {
    setShowEmergencyOptions(!showEmergencyOptions);
  };

  const handleEmergencyOptionSelect = (optionText) => {
    setShowEmergencyOptions(false);

    if (optionText === 'None of these') return;

    const emergencyResponse = {
      _id: Date.now().toString(),
      sender: 'bot',
      content: `⚠️ This may be a serious medical emergency.<br/>
                📞 Call emergency services (e.g., <strong>108</strong> in India).<br/>
                🗺️ <a href="/emergency-map" target="_blank">Click here to view nearby hospitals</a>`,
      timestamp: new Date().toISOString()
    };

    onMessagesUpdated([...messages, emergencyResponse]);
  };

  const handleMessageUpdated = (messageId, newContent) => {
    const updatedMessages = messages.map(msg =>
      msg._id === messageId ? { ...msg, content: newContent } : msg
    );
    onMessagesUpdated(updatedMessages);
  };

  const handleMessageDeleted = (messageId) => {
    const updatedMessages = messages.filter(msg => msg._id !== messageId);
    onMessagesUpdated(updatedMessages);
  };

  return (
    <div className="chat-box-container">
      {/* Emergency container moved to top */}
      <div className="emergency-container" style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 100
      }}>
        <button 
          className="emergency-button"
          onClick={handleEmergencyClick}
        >
          🚨 Emergency Help
        </button>

        {showEmergencyOptions && (
          <div className="emergency-options" style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            width: '200px',
            marginTop: '5px',
            zIndex: 101
          }}>
            {emergencyOptions.map((option, index) => (
              <div 
                key={index}
                className="emergency-option"
                onClick={() => handleEmergencyOptionSelect(option.text)}
              >
                <span className="emoji">{option.emoji}</span> {option.text}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat box with padding to account for emergency button */}
      <div className="chat-box" style={{ paddingTop: '60px' }}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>Start a conversation with the HealthCare ChatBot!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={message._id || index}
              message={message}
              sessionId={sessionId}
              onMessageUpdated={handleMessageUpdated}
              onMessageDeleted={handleMessageDeleted}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatBox;