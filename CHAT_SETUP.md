# Chat Widget Setup Guide

The Terpedia chat widget is now integrated into the site. To make it fully functional, you need to set up a backend API endpoint that connects to OpenAI.

## What's Included

1. **Chat Widget UI** (`chat-widget.js` + `chat-widget.css`)
   - Fully functional frontend
   - Responsive design
   - Message history
   - Loading states

2. **Example Backend** (`api/chat.js`)
   - Node.js/Express example
   - RAG implementation (simple keyword-based)
   - OpenAI integration

## Setup Options

### Option 1: Vercel Serverless Function (Recommended)

1. **Create `vercel.json`** in project root:
```json
{
  "functions": {
    "api/chat.js": {
      "runtime": "nodejs18.x"
    }
  }
}
```

2. **Create `api/chat.js`** (adapt the example):
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Implementation from api/chat.js
  // ...
}
```

3. **Set Environment Variable**:
   - In Vercel dashboard: Settings → Environment Variables
   - Add `OPENAI_API_KEY` with your OpenAI API key

4. **Update Widget Endpoint**:
   - In `index.html`, update: `window.terpediaChat.setApiEndpoint('https://your-domain.vercel.app/api/chat');`

### Option 2: Netlify Functions

1. **Create `netlify/functions/chat.js`**:
```javascript
const OpenAI = require('openai');

exports.handler = async (event, context) => {
  // Implementation from api/chat.js
  // ...
};
```

2. **Set Environment Variable**:
   - In Netlify dashboard: Site settings → Environment variables
   - Add `OPENAI_API_KEY`

3. **Update Widget Endpoint**:
   - `window.terpediaChat.setApiEndpoint('https://your-domain.netlify.app/.netlify/functions/chat');`

### Option 3: Cloudflare Workers

1. **Create `workers/chat.js`**:
```javascript
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    
    // Implementation adapted for Cloudflare Workers
    // ...
  }
};
```

2. **Set Environment Variable**:
   - In Cloudflare dashboard: Workers → Settings → Variables
   - Add `OPENAI_API_KEY`

### Option 4: Custom Backend Server

1. **Install dependencies**:
```bash
npm install express openai cors
```

2. **Create server**:
```javascript
const express = require('express');
const cors = require('cors');
const handleChat = require('./api/chat');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', handleChat);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

3. **Set environment variable**:
```bash
export OPENAI_API_KEY=your_key_here
```

## RAG Implementation

The current implementation uses simple keyword matching. For production, consider:

1. **Vector Database** (Recommended):
   - Use Pinecone, Weaviate, or Chroma
   - Embed site content using OpenAI embeddings
   - Semantic search for better relevance

2. **Improved Text Extraction**:
   - Use a proper HTML parser (cheerio, jsdom)
   - Extract structured content (sections, headings)
   - Maintain context and hierarchy

3. **Content Indexing**:
   - Index all pages (index.html, compound pages, etc.)
   - Create embeddings for each section
   - Store in vector database

## Example Vector Database Setup (Pinecone)

```javascript
const { Pinecone } = require('@pinecone-database/pinecone');

// Initialize
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Create embeddings and store
async function indexContent() {
  const content = loadSiteContent();
  const embeddings = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: content.chunks,
  });
  
  // Store in Pinecone
  // ...
}

// Search
async function searchRelevantContext(query) {
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  
  // Search Pinecone
  // ...
}
```

## Security Considerations

1. **API Key Security**:
   - Never expose API keys in frontend code
   - Use environment variables
   - Consider rate limiting

2. **Rate Limiting**:
   - Implement rate limiting per IP/user
   - Prevent abuse

3. **Input Validation**:
   - Validate and sanitize user input
   - Limit message length
   - Check for malicious content

4. **CORS**:
   - Configure CORS properly
   - Only allow your domain

## Testing

1. **Local Testing**:
   - Run backend locally
   - Update endpoint to `http://localhost:3000/api/chat`
   - Test chat functionality

2. **Production Testing**:
   - Deploy backend
   - Update endpoint in `index.html`
   - Test on live site

## Cost Considerations

- **OpenAI API Costs**:
  - GPT-4o-mini: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
  - GPT-4: ~$5-30 per 1M tokens (depending on model)
  - Consider caching common questions
  - Implement rate limiting

- **Vector Database Costs**:
  - Pinecone: Free tier available, then ~$70/month
  - Weaviate: Open source option
  - Chroma: Open source, self-hosted

## Troubleshooting

1. **Widget not appearing**:
   - Check browser console for errors
   - Verify `chat-widget.js` and `chat-widget.css` are loaded

2. **API errors**:
   - Check backend logs
   - Verify API key is set
   - Check CORS configuration

3. **RAG not working**:
   - Verify content is being loaded
   - Check embedding/search implementation
   - Test with simple queries first

## Next Steps

1. Choose a backend platform (Vercel recommended for simplicity)
2. Set up OpenAI API key
3. Deploy backend function
4. Update endpoint in `index.html`
5. Test chat functionality
6. Consider upgrading to vector database for better RAG

## Support

For issues or questions:
- Check the example code in `api/chat.js`
- Review OpenAI API documentation
- Test with simple queries first
- Monitor API usage and costs
