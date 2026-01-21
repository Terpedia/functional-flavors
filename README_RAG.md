# RAG Index Build Process

The chat widget uses a file-based RAG (Retrieval Augmented Generation) system that works entirely statically.

## Building the RAG Index

The RAG index is a pre-processed JSON file containing all site content in a searchable format.

### Build Command

```bash
npm run build:rag
```

This will:
1. Parse all HTML files (index.html, compounds pages, etc.)
2. Extract text content and structure
3. Create searchable chunks
4. Generate `rag-index.json`

### What Gets Indexed

- Main article (`index.html`)
- About page (`about.html`)
- Compounds listing (`compounds.html`)
- Cinnamon roll page (`cinnamon-roll-tabs.html`)
- All compound detail pages (`compounds/*.html`)

### RAG Index Structure

The generated `rag-index.json` contains:

```json
{
  "version": "1.0",
  "buildDate": "2024-12-01T...",
  "totalPages": 20,
  "totalChunks": 150,
  "pages": [...],
  "chunks": [
    {
      "id": "index.html-chunk-0",
      "pageTitle": "Main Article",
      "pageUrl": "index.html",
      "text": "Content chunk...",
      "chunkIndex": 0,
      "wordCount": 120
    }
  ]
}
```

## Publishing

1. **Build the index**:
   ```bash
   npm run build:rag
   ```

2. **Commit the index**:
   ```bash
   git add rag-index.json
   git commit -m "Update RAG index"
   git push
   ```

3. **The chat widget will automatically load** `rag-index.json` from the site root

## How It Works

1. **Build time**: `npm run build:rag` processes all HTML files
2. **Publish**: `rag-index.json` is committed and deployed with the site
3. **Runtime**: Chat widget loads `rag-index.json` and searches it client-side

## Benefits

- ✅ Works entirely statically (no backend needed)
- ✅ Fast search (pre-processed chunks)
- ✅ No API keys required
- ✅ Privacy-friendly (all processing client-side)
- ✅ Works on GitHub Pages

## Updating Content

When you update site content:

1. Make your changes to HTML files
2. Run `npm run build:rag` to rebuild the index
3. Commit both the HTML changes and `rag-index.json`
4. Push to deploy

## File Size

The RAG index is typically 200-500 KB (compressed by GitHub Pages). This is acceptable for a static file and loads quickly.

## Troubleshooting

**Index not loading?**
- Check that `rag-index.json` exists in the repo root
- Verify it's committed and pushed
- Check browser console for fetch errors

**Outdated content?**
- Rebuild the index: `npm run build:rag`
- Commit and push the updated `rag-index.json`

**Missing pages?**
- Check that HTML files are in expected locations
- Verify file paths in `scripts/build-rag.js`
