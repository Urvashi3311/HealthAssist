import React, { useState, useEffect, useRef } from 'react';

// Fallback icons in case lucide-react is not available
const FallbackIcons = {
  Mic: () => <span style={{ fontSize: '24px' }}>🎤</span>,
  MicOff: () => <span style={{ fontSize: '24px' }}>🔇</span>,
  Volume2: () => <span style={{ fontSize: '24px' }}>🔊</span>,
  VolumeX: () => <span style={{ fontSize: '24px' }}>🔇</span>
};

// Try to import lucide-react icons, fallback to emojis if not available
let Mic, MicOff, Volume2, VolumeX;
try {
  const lucide = require('lucide-react');
  Mic = lucide.Mic;
  MicOff = lucide.MicOff;
  Volume2 = lucide.Volume2;
  VolumeX = lucide.VolumeX;
} catch (error) {
  console.warn('Lucide icons not available, using fallback emojis');
  Mic = FallbackIcons.Mic;
  MicOff = FallbackIcons.MicOff;
  Volume2 = FallbackIcons.Volume2;
  VolumeX = FallbackIcons.VolumeX;
}

const VoiceAssistant = ({ onTranscript, onPlayResponse }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [browserSupport, setBrowserSupport] = useState({
    recognition: false,
    synthesis: false
  });
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);

  useEffect(() => {
    // Check browser support
    const recognitionSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const synthesisSupported = 'speechSynthesis' in window;
    
    setBrowserSupport({
      recognition: recognitionSupported,
      synthesis: synthesisSupported
    });

    // Initialize speech recognition if supported
    if (recognitionSupported) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Voice input:', transcript);
        onTranscript(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    // Initialize speech synthesis if supported
    if (synthesisSupported) {
      synthesisRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, [onTranscript]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        alert('Microphone access is blocked. Please allow microphone permissions in your browser settings.');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakText = (text) => {
    if (synthesisRef.current && text) {
      synthesisRef.current.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthesisRef.current.speak(utterance);
    }
  };

  const stopSpeaking = () => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handlePlayResponse = (speakFunction) => {
    if (isSpeaking) {
      // If already speaking, stop it
      stopSpeaking();
    } else {
      // If not speaking, start speaking
      onPlayResponse && onPlayResponse(speakText);
    }
  };

  if (!browserSupport.recognition && !browserSupport.synthesis) {
    // Don't render anything if browser doesn't support voice features
    return null;
  }

  return (
    <div className="voice-assistant">
      {/* Voice Output Button - Only show if synthesis is supported */}
      {browserSupport.synthesis && (
        <button
          onClick={() => handlePlayResponse(speakText)}
          className={`voice-btn voice-output-btn ${isSpeaking ? 'speaking' : ''}`}
          title={isSpeaking ? 'Stop speaking' : 'Read last response aloud'}
        >
          {isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
      )}

      {/* Voice Input Button - Only show if recognition is supported */}
      {browserSupport.recognition && (
        <button
          onClick={toggleListening}
          className={`voice-btn voice-input-btn ${isListening ? 'listening' : ''}`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
      )}

      {/* Status indicator */}
      {isListening && (
        <div className="voice-status">
          Listening... Speak now
        </div>
      )}
      {isSpeaking && (
        <div className="voice-status">
          Speaking... Click to stop
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;