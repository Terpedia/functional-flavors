# SQLite-Vec RAG Implementation

This project uses **sqlite-vec + SQLite-WASM** for client-side RAG (Retrieval Augmented Generation). This approach is perfect for static sites because:

- ✅ **Single file**: Everything in `rag.sqlite` (chunks + embeddings + metadata)
- ✅ **Client-side**: No backend needed, works entirely in the browser
- ✅ **Fast**: Vector search with sqlite-vec
- ✅ **Versioned**: Database file is committed to git, easy to version
- ✅ **Tiny**: SQLite-WASM is small and efficient

## Building the Database

### Prerequisites

1. **Install dependencies:**
```bash
npm install
```

2. **Set OpenAI API key:**
```bash
export OPENAI_API_KEY=your_key_here
```

### Build Command

```bash
npm run build:rag:sqlite
```

This will:
1. Process all HTML files (index.html, compounds, etc.)
2. Extract and chunk content
3. Generate embeddings using OpenAI `text-embedding-3-small`
4. Store everything in `rag.sqlite`

### Output

- **rag.sqlite**: SQLite database with:
  - `chunks` table: Text chunks with metadata
  - `chunks_embedding` table: Vector embeddings (sqlite-vec)
  - `metadata` table: Build info, version, etc.

## How It Works

### Build Time

1. **Content Extraction**: Parse HTML files, extract text
2. **Chunking**: Split into ~500 character chunks
3. **Embedding Generation**: Create 1536-dim vectors using OpenAI
4. **Database Creation**: Store chunks + embeddings in SQLite

### Runtime (Browser)

1. **Load SQLite-WASM**: Load SQLite in browser via WASM
2. **Load Database**: Fetch `rag.sqlite` file
3. **Vector Search**: Use sqlite-vec for similarity search
4. **Generate Response**: Use retrieved chunks to answer questions

## SQLite-Vec Setup

### Loading sqlite-vec Extension

The sqlite-vec extension needs to be loaded separately. Options:

1. **Use pre-built WASM** (recommended):
   - Download sqlite-vec WASM from: https://github.com/asg017/sqlite-vec
   - Include in project: `sqlite-vec.wasm`

2. **CDN** (if available):
   - Load from CDN if sqlite-vec provides one

3. **Build from source**:
   - Follow sqlite-vec build instructions
   - Compile to WASM

### Database Schema

```sql
-- Chunks table
CREATE TABLE chunks (
    id INTEGER PRIMARY KEY,
    page_title TEXT,
    page_url TEXT,
    section_heading TEXT,
    chunk_text TEXT,
    chunk_index INTEGER,
    word_count INTEGER
);

-- Vector embeddings (sqlite-vec)
CREATE VIRTUAL TABLE chunks_embedding USING vec0(
    embedding_id INTEGER PRIMARY KEY,
    embedding BLOB  -- Float32Array as BLOB
);

-- Metadata
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

## Vector Search Query

```sql
-- Find similar chunks using vector search
SELECT 
    c.id,
    c.page_title,
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

## Current Implementation Status

### ✅ Completed
- Build script for generating SQLite database
- Embedding generation with OpenAI
- Database schema with sqlite-vec support
- Chat widget structure

### 🚧 In Progress
- SQLite-WASM integration in browser
- sqlite-vec WASM extension loading
- Vector search implementation
- Query embedding generation (may need API or pre-computed)

### 📝 Notes

1. **Query Embeddings**: To do vector search, we need embeddings for user queries. Options:
   - Use OpenAI API in browser (requires API key exposure - not recommended)
   - Pre-compute common queries
   - Use keyword search as fallback (current implementation)
   - Use KB Terpedia API for query embeddings

2. **sqlite-vec WASM**: The extension needs to be compiled to WASM. Check:
   - https://github.com/asg017/sqlite-vec
   - Build instructions for WASM compilation

3. **File Size**: The SQLite database will be ~1-5 MB depending on content. This is acceptable for static hosting.

## Alternative: Hybrid Approach

If sqlite-vec WASM setup is complex, we can use a hybrid:

1. **Keyword Search**: Use SQLite for fast keyword-based search (current)
2. **API Fallback**: Use KB Terpedia API for complex queries
3. **Best of Both**: Fast local search + powerful API when needed

## Publishing

1. **Build database:**
   ```bash
   npm run build:rag:sqlite
   ```

2. **Commit database:**
   ```bash
   git add rag.sqlite
   git commit -m "Update RAG database"
   git push
   ```

3. **Deploy**: GitHub Pages will serve `rag.sqlite` as a static file

## File Structure

```
functional-flavors/
├── rag.sqlite              # Generated database (committed)
├── scripts/
│   └── build-rag-sqlite.js # Build script
├── chat-widget.js          # Browser-side widget
└── package.json            # Dependencies
```

## Dependencies

- `better-sqlite3`: For building the database (Node.js)
- `openai`: For generating embeddings
- SQLite-WASM: Loaded in browser (via CDN or local file)
- sqlite-vec: Vector search extension (WASM)

## Next Steps

1. ✅ Build script created
2. 🔄 Integrate SQLite-WASM in browser
3. 🔄 Load sqlite-vec extension
4. 🔄 Implement vector search
5. 🔄 Handle query embeddings (API or pre-computed)
6. ✅ Test and deploy

## References

- [sqlite-vec](https://github.com/asg017/sqlite-vec)
- [SQLite-WASM](https://sqlite.org/wasm/doc/trunk/index.md)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
