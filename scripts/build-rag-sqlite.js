// Build RAG index using SQLite + sqlite-vec
// Creates rag.sqlite with chunks, embeddings, and metadata
// Run with: node scripts/build-rag-sqlite.js

const fs = require('fs');
const path = require('path');
const { Database } = require('better-sqlite3');
const { OpenAI } = require('openai');

// Initialize OpenAI for embeddings
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

class RAGSQLiteBuilder {
    constructor() {
        this.dbPath = path.join(__dirname, '..', 'rag.sqlite');
        this.content = [];
        this.chunks = [];
    }

    async build() {
        console.log('Building RAG SQLite database...');
        
        // Initialize database
        this.initDatabase();
        
        // Process all HTML files
        await this.processFile('index.html', 'Main Article');
        await this.processFile('about.html', 'About Terpedia');
        await this.processFile('compounds.html', 'All Compounds');
        await this.processFile('cinnamon-roll-tabs.html', 'Cinnamon Roll');
        
        // Process compound pages
        const compoundsDir = path.join(__dirname, '../compounds');
        const compoundFiles = fs.readdirSync(compoundsDir).filter(f => f.endsWith('.html'));
        
        for (const file of compoundFiles) {
            const compoundName = file.replace('.html', '').replace(/-/g, ' ');
            await this.processFile(`compounds/${file}`, `Compound: ${compoundName}`);
        }
        
        // Create chunks
        this.createChunks();
        
        // Generate embeddings and store in database
        await this.generateEmbeddingsAndStore();
        
        // Create indexes
        this.createIndexes();
        
        console.log(`✓ Built RAG database: ${this.dbPath}`);
        console.log(`  - ${this.content.length} pages processed`);
        console.log(`  - ${this.chunks.length} chunks created`);
        
        // Show file size
        const stats = fs.statSync(this.dbPath);
        console.log(`  - Database size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }

    initDatabase() {
        // Remove existing database
        if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
        }
        
        const db = new Database(this.dbPath);
        
        // Enable sqlite-vec extension
        db.exec(`
            -- Create chunks table
            CREATE TABLE chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_title TEXT NOT NULL,
                page_url TEXT NOT NULL,
                section_heading TEXT,
                chunk_text TEXT NOT NULL,
                chunk_index INTEGER,
                word_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Create embeddings table
            -- Note: When sqlite-vec extension is available, this can be converted to:
            -- CREATE VIRTUAL TABLE chunks_embedding USING vec0(...)
            -- For now, we store embeddings as BLOB for future vector search
            CREATE TABLE chunks_embedding (
                embedding_id INTEGER PRIMARY KEY,
                embedding BLOB,
                FOREIGN KEY (embedding_id) REFERENCES chunks(id)
            );
            
            -- Create metadata table
            CREATE TABLE metadata (
                key TEXT PRIMARY KEY,
                value TEXT
            );
        `);
        
        db.close();
    }

    async processFile(filePath, title) {
        try {
            const fullPath = path.join(__dirname, '..', filePath);
            if (!fs.existsSync(fullPath)) {
                console.warn(`⚠ File not found: ${filePath}`);
                return;
            }
            
            const html = fs.readFileSync(fullPath, 'utf-8');
            const content = this.extractContent(html, title, filePath);
            
            if (content.text) {
                this.content.push(content);
            }
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error.message);
        }
    }

    extractContent(html, title, filePath) {
        // Remove scripts and styles
        html = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
            .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
        
        // Extract headings for structure
        const headingMatches = html.match(/<h([1-4])[^>]*>(.*?)<\/h[1-4]>/gi) || [];
        const headings = headingMatches.map(h => {
            const text = h.replace(/<[^>]+>/g, '').trim();
            const level = h.match(/<h([1-4])/)?.[1] || '1';
            return { level: parseInt(level), text };
        });
        
        // Extract main content
        const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        const contentHtml = articleMatch?.[1] || mainMatch?.[1] || html;
        
        // Extract text
        let text = contentHtml
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        // Extract sections
        const sections = this.extractSections(contentHtml, headings);
        
        return {
            title,
            filePath,
            url: filePath.replace(/\\/g, '/'),
            headings: headings.map(h => h.text),
            text,
            sections,
            wordCount: text.split(/\s+/).length,
            timestamp: new Date().toISOString()
        };
    }

    extractSections(html, headings) {
        const sections = [];
        let currentSection = null;
        
        // Split by headings
        const parts = html.split(/(<h[1-4][^>]*>.*?<\/h[1-4]>)/i);
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            if (part.match(/<h[1-4]/i)) {
                // Save previous section
                if (currentSection) {
                    sections.push(currentSection);
                }
                
                // Start new section
                const headingText = part.replace(/<[^>]+>/g, '').trim();
                currentSection = {
                    heading: headingText,
                    text: '',
                    html: part
                };
            } else if (currentSection) {
                // Add to current section
                const text = part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                currentSection.text += ' ' + text;
                currentSection.html += part;
            }
        }
        
        if (currentSection) {
            sections.push(currentSection);
        }
        
        return sections.filter(s => s.text.length > 50);
    }

    createChunks() {
        for (const page of this.content) {
            // Create chunks from full text
            const textChunks = this.chunkText(page.text, 500);
            
            for (let i = 0; i < textChunks.length; i++) {
                this.chunks.push({
                    pageTitle: page.title,
                    pageUrl: page.url,
                    sectionHeading: null,
                    text: textChunks[i],
                    chunkIndex: i,
                    totalChunks: textChunks.length,
                    wordCount: textChunks[i].split(/\s+/).length
                });
            }
            
            // Create chunks from sections
            for (const section of page.sections) {
                if (section.text.length > 100) {
                    const sectionChunks = this.chunkText(section.text, 400);
                    for (let i = 0; i < sectionChunks.length; i++) {
                        this.chunks.push({
                            pageTitle: page.title,
                            pageUrl: page.url,
                            sectionHeading: section.heading,
                            text: sectionChunks[i],
                            chunkIndex: i,
                            totalChunks: sectionChunks.length,
                            wordCount: sectionChunks[i].split(/\s+/).length,
                            isSection: true
                        });
                    }
                }
            }
        }
    }

    chunkText(text, chunkSize = 500) {
        const chunks = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            const testChunk = currentChunk + sentence;
            if (testChunk.length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk = testChunk;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.filter(c => c.length > 50);
    }

    async generateEmbeddingsAndStore() {
        const db = new Database(this.dbPath);
        
        // Store metadata
        db.prepare(`
            INSERT INTO metadata (key, value) VALUES (?, ?)
        `).run('version', '1.0');
        db.prepare(`
            INSERT INTO metadata (key, value) VALUES (?, ?)
        `).run('build_date', new Date().toISOString());
        db.prepare(`
            INSERT INTO metadata (key, value) VALUES (?, ?)
        `).run('total_chunks', this.chunks.length.toString());
        db.prepare(`
            INSERT INTO metadata (key, value) VALUES (?, ?)
        `).run('embedding_model', 'text-embedding-3-small');
        
        const insertChunk = db.prepare(`
            INSERT INTO chunks (page_title, page_url, section_heading, chunk_text, chunk_index, word_count)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const insertEmbedding = db.prepare(`
            INSERT INTO chunks_embedding (embedding_id, embedding)
            VALUES (?, ?)
        `);
        
        console.log(`Generating embeddings for ${this.chunks.length} chunks...`);
        
        // Process in batches to avoid rate limits
        const batchSize = 100;
        for (let i = 0; i < this.chunks.length; i += batchSize) {
            const batch = this.chunks.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(this.chunks.length / batchSize)}...`);
            
            // Generate embeddings for batch
            const texts = batch.map(c => c.text);
            const embeddings = await this.generateEmbeddings(texts);
            
            // Store chunks and embeddings
            for (let j = 0; j < batch.length; j++) {
                const chunk = batch[j];
                const embedding = embeddings[j];
                
                // Insert chunk
                const result = insertChunk.run(
                    chunk.pageTitle,
                    chunk.pageUrl,
                    chunk.sectionHeading,
                    chunk.text,
                    chunk.chunkIndex,
                    chunk.wordCount
                );
                
                const chunkId = result.lastInsertRowid;
                
                // Insert embedding (store as BLOB - Float32Array)
                // When sqlite-vec is loaded, these can be used for vector search
                const embeddingArray = new Float32Array(embedding);
                const embeddingBlob = Buffer.from(embeddingArray.buffer);
                insertEmbedding.run(chunkId, embeddingBlob);
            }
        }
        
        db.close();
        console.log('✓ Embeddings generated and stored');
    }

    async generateEmbeddings(texts) {
        try {
            const response = await openai.embeddings.create({
                model: 'text-embedding-3-small',
                input: texts,
            });
            
            return response.data.map(item => item.embedding);
        } catch (error) {
            console.error('Error generating embeddings:', error);
            // Return zero vectors as fallback
            return texts.map(() => new Array(1536).fill(0));
        }
    }

    createIndexes() {
        const db = new Database(this.dbPath);
        
        // Create indexes for faster lookups
        db.exec(`
            CREATE INDEX idx_chunks_page_url ON chunks(page_url);
            CREATE INDEX idx_chunks_page_title ON chunks(page_title);
            CREATE INDEX idx_chunks_section_heading ON chunks(section_heading);
            
            -- Full-text search index (for keyword search)
            CREATE VIRTUAL TABLE chunks_fts USING fts5(
                chunk_text,
                content='chunks',
                content_rowid='id'
            );
            
            -- Populate FTS index
            INSERT INTO chunks_fts(rowid, chunk_text)
            SELECT id, chunk_text FROM chunks;
        `);
        
        console.log('✓ Indexes created (including FTS5 for full-text search)');
        
        db.close();
    }
}

// Run if called directly
if (require.main === module) {
    if (!process.env.OPENAI_API_KEY) {
        console.error('Error: OPENAI_API_KEY environment variable is required');
        console.error('Set it with: export OPENAI_API_KEY=your_key_here');
        process.exit(1);
    }
    
    const builder = new RAGSQLiteBuilder();
    builder.build().catch(console.error);
}

module.exports = RAGSQLiteBuilder;
