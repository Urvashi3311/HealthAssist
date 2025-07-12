// src/components/MessageInput.jsx
import React, { useState } from 'react'; // USed for managing the input states.

// OnSendMessage: Function that handles sending the messages.
// disabled: A boolean that controls whether the input button be displayed. 
// message: Stores the user's input. 
const MessageInput = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');

// prevents form from reloading the page.
// Validates message. 
// onSendMessage() passes the message to the parent component.
// Clears the input field.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  //console.log(disabled);
  

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
        disabled={disabled}
        className="message-input"
      />
      <button 
        type="submit" 
        disabled={!message.trim() || disabled}
        className="send-button"
      >
        Send
      </button>
    </form>
  );
};

export default MessageInput;