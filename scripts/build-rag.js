// Build RAG index from site content
// Run with: node scripts/build-rag.js
// Generates: rag-index.json

const fs = require('fs');
const path = require('path');

class RAGBuilder {
    constructor() {
        this.content = [];
        this.chunks = [];
    }

    async build() {
        console.log('Building RAG index from site content...');
        
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
        
        // Save to JSON
        this.saveIndex();
        
        console.log(`✓ Built RAG index with ${this.chunks.length} chunks from ${this.content.length} pages`);
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
        
        // Extract links for context
        const linkMatches = contentHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi) || [];
        const links = linkMatches.map(link => {
            const href = link.match(/href=["']([^"']+)["']/)?.[1];
            const text = link.replace(/<[^>]+>/g, '').trim();
            return { href, text };
        });
        
        // Extract sections
        const sections = this.extractSections(contentHtml, headings);
        
        return {
            title,
            filePath,
            url: filePath.replace(/\\/g, '/'),
            headings: headings.map(h => h.text),
            text,
            sections,
            links: links.slice(0, 20), // Limit links
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
        
        return sections.filter(s => s.text.length > 50); // Only meaningful sections
    }

    createChunks() {
        for (const page of this.content) {
            // Create chunks from full text
            const textChunks = this.chunkText(page.text, 500);
            
            for (let i = 0; i < textChunks.length; i++) {
                this.chunks.push({
                    id: `${page.filePath}-chunk-${i}`,
                    pageTitle: page.title,
                    pageUrl: page.url,
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
                            id: `${page.filePath}-section-${section.heading}-${i}`,
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
        
        return chunks.filter(c => c.length > 50); // Only meaningful chunks
    }

    saveIndex() {
        const index = {
            version: '1.0',
            buildDate: new Date().toISOString(),
            totalPages: this.content.length,
            totalChunks: this.chunks.length,
            pages: this.content.map(page => ({
                title: page.title,
                url: page.url,
                headings: page.headings,
                wordCount: page.wordCount,
                sectionCount: page.sections.length
            })),
            chunks: this.chunks
        };
        
        const outputPath = path.join(__dirname, '..', 'rag-index.json');
        fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));
        console.log(`✓ Saved RAG index to: ${outputPath}`);
    }
}

// Run if called directly
if (require.main === module) {
    const builder = new RAGBuilder();
    builder.build().catch(console.error);
}

module.exports = RAGBuilder;
