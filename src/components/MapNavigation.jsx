import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Fallback icon
const FallbackArrowLeft = () => <span style={{ fontSize: '16px' }}>←</span>;

// Try to import lucide-react icon, fallback if not available
let ArrowLeftIcon;
try {
  const lucide = require('lucide-react');
  ArrowLeftIcon = lucide.ArrowLeft;
} catch (error) {
  console.warn('Lucide ArrowLeft not available, using fallback');
  ArrowLeftIcon = FallbackArrowLeft;
}

const MapNavigation = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      zIndex: 1000
    }}>
      <button
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 15px',
          backgroundColor: 'white',
          color: '#333',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          fontWeight: 'bold'
        }}
      >
        <ArrowLeftIcon size={16} />
        Back to Chat
      </button>
    </div>
  );
};

export default MapNavigation;