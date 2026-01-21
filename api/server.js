// Simple Express server for local development
// Run with: npm run dev:api
// Requires: npm install express openai cors

const express = require('express');
const cors = require('cors');
const handleChat = require('./chat');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'file://'], // Allow local file access
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Chat endpoint
app.post('/api/chat', handleChat);

// Start server
app.listen(PORT, () => {
    console.log(`Chat API server running on http://localhost:${PORT}`);
    console.log(`Make sure OPENAI_API_KEY is set in your environment`);
    console.log(`Update chat widget endpoint to: http://localhost:${PORT}/api/chat`);
});
