const express = require('express');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const ORS_API_KEY = process.env.ORS_API_KEY;

if (!ORS_API_KEY) {
  console.error('ORS_API_KEY not found in .env file.');
  process.exit(1); // Stop the server
}

// ✅ CORS setup
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// 🔁 Proxy route to OpenRouteService
app.post('/api/directions', async (req, res) => {
  try {
    const orsResponse = await axios.post(
      'https://api.openrouteservice.org/v2/directions/driving-car',
      req.body,
      {
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    res.json(orsResponse.data);
  } catch (error) {
    console.error('ORS API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch directions' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});
