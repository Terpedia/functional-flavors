# Loading sqlite-vec Extension

To enable vector search with sqlite-vec, you need to load the extension in the browser.

## Option 1: Pre-built WASM (Recommended)

1. **Download sqlite-vec WASM:**
   ```bash
   # From https://github.com/asg017/sqlite-vec
   # Download the compiled WASM file
   ```

2. **Add to project:**
   ```
   functional-flavors/
   ├── sqlite-vec.wasm
   └── chat-widget.js
   ```

3. **Load in chat-widget.js:**
   ```javascript
   async loadSQLiteVecExtension() {
       const wasmPath = 'sqlite-vec.wasm';
       const wasmResponse = await fetch(wasmPath);
       const wasmBytes = await wasmResponse.arrayBuffer();
       
       // Load extension into SQLite
       this.sqlite3.oo1.DB.dbConfig.wasm = wasmBytes;
       // Or use sqlite3_wasm_vfs_register() if available
   }
   ```

## Option 2: CDN (if available)

```javascript
const vecWasm = await fetch('https://cdn.jsdelivr.net/npm/sqlite-vec/wasm/sqlite-vec.wasm');
// Load into SQLite
```

## Option 3: Build from Source

Follow instructions at: https://github.com/asg017/sqlite-vec

## Vector Search Query

Once loaded, you can use:

```sql
SELECT 
    c.id,
    c.chunk_text,
    vec_distance_cosine(
        c_e.embedding,
        :query_embedding
    ) AS distance
FROM chunks c
JOIN chunks_embedding c_e ON c.id = c_e.embedding_id
ORDER BY distance ASC
LIMIT 5;
```

## Query Embedding Generation

To generate query embeddings, you have options:

1. **Use KB Terpedia API** (recommended):
   ```javascript
   async generateQueryEmbedding(query) {
       const response = await fetch('https://kb.terpedia.com/api/embeddings', {
           method: 'POST',
           body: JSON.stringify({ text: query })
       });
       return await response.json();
   }
   ```

2. **Pre-compute common queries** (store in database)

3. **Use OpenAI API in browser** (requires API key - not recommended for security)

## Current Status

- ✅ FTS5 full-text search (working)
- ✅ Keyword search fallback (working)
- 🔄 Vector search (requires sqlite-vec WASM + query embeddings)
