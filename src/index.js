import React from 'react';
import ReactDOM from 'react-dom/client'; // Import from 'react-dom/client'
import App from './App.jsx'; // Ensure this points to App.jsx
import './index.css';

// Create a root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the app using the root element
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);