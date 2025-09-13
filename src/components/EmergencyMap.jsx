import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// API base URL from environment variable
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom hospital icon (using a red cross symbol)
const hospitalIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/8145/8145721.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35], // Anchor at the bottom center
  popupAnchor: [0, -30], // Popup appears above the pin
});


// Custom current location icon (blue marker)
const currentLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  shadowSize: [41, 41]
});

const EmergencyMap = () => {
  const [position, setPosition] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  useEffect(() => {
    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setPosition(coords);
          fetchHospitals(coords);
        },
        (err) => {
          console.error('Geolocation error:', err);
          setError('Location access denied. Using default location.');
          const fallback = [28.6139, 77.2090]; // Fallback to Delhi
          setPosition(fallback);
          fetchHospitals(fallback);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      const fallback = [28.6139, 77.2090];
      setPosition(fallback);
      fetchHospitals(fallback);
    }
  }, []);

  const fetchHospitals = async ([lat, lon]) => {
    try {
      setLoading(true);
      const query = `
        [out:json];
        (
          node["amenity"="hospital"](around:10000,${lat},${lon});
          way["amenity"="hospital"](around:10000,${lat},${lon});
          relation["amenity"="hospital"](around:10000,${lat},${lon});
        );
        out center;
      `;
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      const rawHospitals = data.elements.map((el) => {
        const hospitalCoords = el.lat ? [el.lat, el.lon] : [el.center.lat, el.center.lon];
        const distance = calculateDistance(lat, lon, hospitalCoords[0], hospitalCoords[1]);
        
        return {
          id: el.id,
          name: el.tags?.name || 'Unnamed Hospital',
          coords: hospitalCoords,
          distance: distance,
          duration: null,
          loading: false,
          address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || el.tags?.['addr:city'] || 'Address not available',
          website: el.tags?.website || null
        };
      });

      // Sort hospitals by distance (closest first)
      rawHospitals.sort((a, b) => a.distance - b.distance);

      setHospitals(rawHospitals);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching hospitals:', error);
      setError('Failed to load hospitals. Please try again later.');
      setLoading(false);
    }
  };

  const getDirections = async (hospital) => {
    if (!position) return;
    
    try {
      // Set loading state for this hospital
      setHospitals(prev =>
        prev.map(h =>
          h.id === hospital.id ? { ...h, loading: true } : h
        )
      );

      const [startLat, startLon] = position;
      const [endLat, endLon] = hospital.coords;

      // Use your Flask API to get directions
      const res = await fetch(`${API_BASE_URL}/api/directions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [[startLon, startLat], [endLon, endLat]],
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      const summary = data.routes[0].summary;

      // Update hospital with travel time
      setHospitals(prev =>
        prev.map(h =>
          h.id === hospital.id
            ? {
                ...h,
                duration: Math.round(summary.duration / 60),
                loading: false,
              }
            : h
        )
      );

      // Open Google Maps with directions
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLon}&destination=${endLat},${endLon}&travelmode=driving`);

    } catch (err) {
      console.warn('Directions API error:', err);
      setHospitals(prev =>
        prev.map(h =>
          h.id === hospital.id
            ? { ...h, duration: 'N/A', loading: false }
            : h
        )
      );
    }
  };

  if (error) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'column',
        padding: '20px'
      }}>
        <h3>⚠️ {error}</h3>
        <p>Please check your location permissions or try again later.</p>
      </div>
    );
  }

  if (!position || loading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>📍</div>
        <div>Loading map and finding nearby hospitals...</div>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 1000,
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        maxWidth: '300px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0' }}>🏥 Nearby Hospitals</h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
          Found {hospitals.length} hospitals near you
        </p>
        {hospitals.length > 0 && (
          <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
            {hospitals.slice(0, 5).map((hospital, index) => (
              <div key={hospital.id} style={{ 
                padding: '8px', 
                borderBottom: index < 4 ? '1px solid #eee' : 'none',
                fontSize: '13px'
              }}>
                <strong>{hospital.name}</strong>
                <div>{hospital.distance.toFixed(2)} km away</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <MapContainer 
        center={position} 
        zoom={14} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={position} icon={currentLocationIcon}>
          <Popup>
            <strong>📍 Your Current Location</strong>
          </Popup>
        </Marker>

        {hospitals.map((hospital) => (
          <Marker
            key={hospital.id}
            position={hospital.coords}
            icon={hospitalIcon}
          >
            <Popup>
              <div style={{ minWidth: '250px' }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#2c5aa0', fontSize: '16px' }}>
                  🏥 {hospital.name}
                </h3>
                
                <div style={{ margin: '8px 0', padding: '8px', background: '#f0f8ff', borderRadius: '4px' }}>
                  <strong style={{ color: '#2c5aa0' }}>📍 Distance:</strong> {hospital.distance.toFixed(2)} km
                </div>
                
                {hospital.duration && (
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <strong>⏱️ Travel time:</strong> ~{hospital.duration} min
                  </p>
                )}
                
                <p style={{ margin: '5px 0', fontSize: '14px' }}>
                  <strong>🏠 Address:</strong> {hospital.address}
                </p>
                
                {hospital.website && (
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <strong>🌐 Website:</strong> 
                    <a href={hospital.website} target="_blank" rel="noopener noreferrer" style={{ color: '#2c5aa0', marginLeft: '5px' }}>
                      Visit website
                    </a>
                  </p>
                )}
                
                <button 
                  onClick={() => getDirections(hospital)}
                  style={{
                    marginTop: '12px',
                    padding: '10px 15px',
                    backgroundColor: '#2c5aa0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    width: '100%',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                  disabled={hospital.loading}
                >
                  {hospital.loading ? 'Calculating route...' : '🚗 Get Directions'}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <style>
        {`
          .hospital-marker-icon {
            filter: hue-rotate(300deg) saturate(200%) brightness(0.9);
          }
        `}
      </style>
    </div>
  );
};

export default EmergencyMap;