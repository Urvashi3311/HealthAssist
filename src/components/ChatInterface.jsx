import React, { useState, useEffect, useRef } from 'react';
import VoiceAssistant from './VoiceAssistant';

const ChatInterface = ({ sessionId, onSendMessage, messages, isLoading }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleVoiceInput = (transcript) => {
    setInput(transcript);
    setTimeout(() => {
      if (transcript.trim() && !isLoading) {
        onSendMessage(transcript.trim());
        setInput('');
      }
    }, 500);
  };

  // Function to get the last bot message content
  const getLastBotMessage = () => {
    const lastBotMessage = [...messages].reverse().find(msg => msg.sender === 'bot');
    return lastBotMessage ? lastBotMessage.content : '';
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      maxWidth: '800px',
      margin: '0 auto',
      backgroundColor: '#f5f5f5',
      position: 'relative'
    }}>
      {/* Messages Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '80px' }}>
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '15px'
            }}
          >
            <div
              style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: '18px',
                backgroundColor: message.sender === 'user' ? '#007bff' : '#e9ecef',
                color: message.sender === 'user' ? 'white' : '#333',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '15px' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '18px',
              backgroundColor: '#e9ecef',
              color: '#666',
              fontStyle: 'italic'
            }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Container */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '15px',
          backgroundColor: 'white',
          borderTop: '1px solid #ddd',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          zIndex: 1000
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your health concern or use voice input..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid #ddd',
            borderRadius: '25px',
            outline: 'none',
            fontSize: '16px'
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          style={{
            padding: '12px',
            border: 'none',
            borderRadius: '50%',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: !input.trim() || isLoading ? 'not-allowed' : 'pointer',
            opacity: !input.trim() || isLoading ? 0.5 : 1
          }}
        >
          ➤
        </button>
      </form>

      {/* Voice Assistant */}
      <VoiceAssistant 
        onTranscript={handleVoiceInput}
        getLastBotMessage={getLastBotMessage}
      />
    </div>
  );
};

export default ChatInterface;
