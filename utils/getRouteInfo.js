// src/utils/getRouteInfo.js
import axios from 'axios';

export const getRouteInfo = async (start, end) => {
  const apiKey = process.env.REACT_APP_ORS_API_KEY;
  const url = 'https://api.openrouteservice.org/v2/directions/driving-car';

  try {
    const response = await axios.post(url, {
      coordinates: [start, end],
    }, {
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const summary = response.data.features[0].properties.summary;
    return {
      distance: (summary.distance / 1000).toFixed(2), // in km
      duration: Math.round(summary.duration / 60) // in minutes
    };
  } catch (err) {
    console.error('Error fetching route info:', err);
    return null;
  }
};
