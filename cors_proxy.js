const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoint for NASA PSAP data
app.get('/nasa-psap', async (req, res) => {
    try {
        const nasaUrl = 'https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/emergency_services/MapServer/10/query?where=1%3D1&outFields=*&returnGeometry=true&f=json';
        
        console.log('Fetching NASA PSAP data from:', nasaUrl);
        
        const response = await fetch(nasaUrl);
        const data = await response.json();
        
        console.log(`Successfully fetched ${data.features ? data.features.length : 0} PSAP features`);
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching NASA PSAP data:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'CORS Proxy is running' });
});

app.listen(PORT, () => {
    console.log(`CORS Proxy server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('  - GET /nasa-psap - Fetch NASA PSAP data');
    console.log('  - GET /health - Health check');
}); 