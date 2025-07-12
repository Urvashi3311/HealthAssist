import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/logsign.css';
import { signup } from '../services/api';

function Signup({ setAuthenticated }) {
  const [email, setEmail] = useState(''); // stores user input.
  const [password, setPassword] = useState(''); // stores errors.
  const [confirmPassword, setConfirmPassword] = useState(''); 
  const [error, setError] = useState(''); 
  const [loading, setLoading] = useState(false); //Indicates when the request is being processed.
  const navigate = useNavigate(); // Redirects user after successful signup


// 1. Prevents default sign submission. 
// 2. Validates password (min 8 characters and if two passwords match.)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Password validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);

    try {
      const response = await signup(email, password);
      if (response.message === 'User registered successfully') {
        // After successful signup, redirect to login
        navigate('/login', { state: { message: 'Signup successful! Please login.' } });
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-form">
          <div className="logo">
            {/* <img src="/logo.png" alt="GerChatBot Logo" /> */}
          </div>
          
          <h2>Create Account for HealthAssist, your personal AI medical assitant.</h2>
          {error && <div className="error-message">{error}</div>}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} /*Updates the email state as the user types.*/
                required /*Ensures that the field must be filled.*/
                placeholder="Enter your email"
              />
            </div>
            
            <div className="form-group">
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                placeholder="Create a password"
              />
              <small className="password-hint">Must be at least 8 characters</small>
            </div>
            
            <div className="form-group">
              <label>Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}  /*Ensures that user enters the same password.*/
                required 
                placeholder="Confirm your password"
              />
            </div>
            
            <button 
              type="submit" 
              className="login-button" 
              disabled={loading} /*Button is disabled when loading is true to prevent multiple submission.*/
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
          
          <p className="signup-link">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup; // Allows component to be used in other parts of app.