// Example backend API endpoint for chat widget
// This is a Node.js/Express example - adapt to your serverless function provider

// For Vercel, Netlify Functions, or Cloudflare Workers, adapt accordingly

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Load site content for RAG (in production, use a vector database)
let siteContent = null;

function loadSiteContent() {
    try {
        // Load HTML content and extract text
        const indexPath = path.join(__dirname, '../index.html');
        const html = fs.readFileSync(indexPath, 'utf-8');
        
        // Simple text extraction (in production, use proper HTML parsing)
        const textContent = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Split into chunks for RAG
        const chunks = textContent.match(/.{1,1000}/g) || [];
        
        return {
            fullText: textContent,
            chunks: chunks,
        };
    } catch (error) {
        console.error('Error loading site content:', error);
        return null;
    }
}

// Simple RAG: find relevant chunks based on keyword matching
function findRelevantContext(query, content, topK = 3) {
    if (!content) return '';
    
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    // Score chunks by keyword matches
    const scoredChunks = content.chunks.map((chunk, index) => {
        const chunkLower = chunk.toLowerCase();
        let score = 0;
        
        queryWords.forEach(word => {
            const matches = (chunkLower.match(new RegExp(word, 'g')) || []).length;
            score += matches;
        });
        
        return { chunk, score, index };
    });
    
    // Sort by score and return top K
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, topK).map(item => item.chunk);
    
    return topChunks.join('\n\n');
}

// Main chat handler
async function handleChat(req, res) {
    try {
        const { message, conversation_history = [] } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Load site content if not already loaded
        if (!siteContent) {
            siteContent = loadSiteContent();
        }
        
        // Find relevant context from site content
        const relevantContext = findRelevantContext(message, siteContent);
        
        // Build system prompt
        const systemPrompt = `You are the Terpedia Assistant, a helpful AI assistant for the Terpedia scientific repository on functional flavors.

Your role is to:
1. Answer questions about functional flavors, their mechanisms, health effects, and FDA regulations
2. Provide information about Terpedia and its mission
3. Help users navigate and understand the scientific content on the site
4. Be accurate, cite sources when possible, and acknowledge limitations

${relevantContext ? `\nRelevant context from the site:\n${relevantContext}\n` : ''}

Important guidelines:
- Be scientific and accurate
- If you're unsure, say so
- Direct users to specific sections when relevant
- For Terpedia questions, explain that Terpedia is a scientific repository for functional flavors research
- Always acknowledge when information is preliminary or limited`;

        // Build messages array
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversation_history.map(msg => ({
                role: msg.role,
                content: msg.content,
            })),
            { role: 'user', content: message },
        ];
        
        // Call OpenAI API
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini', // or 'gpt-4' for better quality
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
        });
        
        const response = completion.choices[0].message.content;
        
        return res.json({
            response: response,
            model: completion.model,
        });
        
    } catch (error) {
        console.error('Chat API error:', error);
        return res.status(500).json({
            error: 'An error occurred while processing your request',
            message: error.message,
        });
    }
}

// Export for different platforms
module.exports = handleChat;

// For Vercel
// export default async function handler(req, res) {
//     if (req.method === 'POST') {
//         return handleChat(req, res);
//     }
//     return res.status(405).json({ error: 'Method not allowed' });
// }

// For Netlify Functions
// exports.handler = async (event, context) => {
//     if (event.httpMethod !== 'POST') {
//         return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
//     }
//     
//     const req = { body: JSON.parse(event.body) };
//     const res = {
//         json: (data) => ({ statusCode: 200, body: JSON.stringify(data) }),
//         status: (code) => ({ json: (data) => ({ statusCode: code, body: JSON.stringify(data) }) }),
//     };
//     
//     return handleChat(req, res);
// };
