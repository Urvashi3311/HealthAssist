// src/components/Login.jsx
import '../styles/logsign.css';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/api';

function Login({ setAuthenticated }) {
  const [email, setEmail] = useState(''); // to store the email address
  const [password, setPassword] = useState(''); //to store the user password
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // Indicates when request is bein processed.
  const navigate = useNavigate(); // Redirects user after successful log-in.

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevents default submission.
    setError(''); // Clears any previous error messages
    setLoading(true); //Starts loading state.

    try {
      const response = await login(email, password); // Calls API function for login.
      if (response.verified) { // If login is successful.
        setAuthenticated(true); // Update authentication status.
        localStorage.setItem('userEmail',email)
        navigate('/dashboard'); // Redirect user to dashboard.
      } else {
        setError(response.error || 'Login failed'); // Show error if login fails.
      }
    } catch (err) {
      setError('An error occurred. Please try again.'); // Handle unexpected errors.
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className='login-div'>
      <div className="login-form">
        <h2>Login to HealthAssist</h2>
        {error && <div className="error-message">{error}</div>}
        {/* Updates email state when user types. Required ensures user cannot submit empty field.  */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          {/* Updates password state on user input. 
          Required ensures user doesn't submit an empty field.*/}
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          {/*Calls handleSubmit when clicked. 
          Shows logging in and submission is disabled when loading is true.*/}
          <button 
            type="submit" 
            className="login-button" 
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className="signup-link">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
      </div>
    </div>
  );
}

export default Login;