import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const EmergencyMap = () => {
  const [position, setPosition] = useState(null);
  const [hospitals, setHospitals] = useState([]);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        fetchHospitals(coords);
      },
      (err) => {
        console.error('Geolocation error:', err);
        const fallback = [28.6139, 77.2090]; // Fallback to Delhi
        setPosition(fallback);
        fetchHospitals(fallback);
      }
    );
  }, []);

  const fetchHospitals = async ([lat, lon]) => {
    try {
      const query = `
        [out:json];
        (
          node["amenity"="hospital"](around:5000,${lat},${lon});
          way["amenity"="hospital"](around:5000,${lat},${lon});
          relation["amenity"="hospital"](around:5000,${lat},${lon});
        );
        out center;
      `;
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await response.json();

      const rawHospitals = data.elements.map((el) => ({
        id: el.id,
        name: el.tags?.name || 'Unnamed Hospital',
        coords: el.lat ? [el.lat, el.lon] : [el.center.lat, el.center.lon],
        distance: null,
        duration: null,
        loading: false,
      }));

      setHospitals(rawHospitals);
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  const handlePopupOpen = async (hospitalId) => {
    const hospital = hospitals.find(h => h.id === hospitalId);
    if (!hospital || hospital.distance !== null || hospital.loading) return;

    const [lat, lon] = position;

    try {
      // Set loading true
      setHospitals(prev =>
        prev.map(h =>
          h.id === hospitalId ? { ...h, loading: true } : h
        )
      );

      const res = await axios.post('http://localhost:4000/api/directions', {
        coordinates: [[lon, lat], [hospital.coords[1], hospital.coords[0]]],
      });

      const summary = res.data.routes[0].summary;

      // Set distance & duration
      setHospitals(prev =>
        prev.map(h =>
          h.id === hospitalId
            ? {
                ...h,
                distance: (summary.distance / 1000).toFixed(2),
                duration: Math.round(summary.duration / 60),
                loading: false,
              }
            : h
        )
      );
    } catch (err) {
      console.warn('ORS route error:', err);
      setHospitals(prev =>
        prev.map(h =>
          h.id === hospitalId
            ? { ...h, distance: '?', duration: '?', loading: false }
            : h
        )
      );
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      {position && (
        <MapContainer center={position} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker position={position}>
            <Popup>You are here</Popup>
          </Marker>

          {hospitals.map((h) => (
            <Marker
              key={h.id}
              position={h.coords}
              eventHandlers={{
                popupopen: () => handlePopupOpen(h.id),
              }}
            >
              <Popup>
                <strong>{h.name}</strong><br />
                {h.loading ? (
                  <em>Loading route info...</em>
                ) : h.distance !== null ? (
                  <>
                    📍 {h.distance} km<br />
                    ⏱️ ~{h.duration} min
                  </>
                ) : (
                  <em>Click marker to get route</em>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
};

export default EmergencyMap;
