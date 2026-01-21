// Terpedia Chat Widget - File-Based RAG Implementation
// Works entirely statically with pre-built RAG index

class TerpediaChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.ragIndex = null;
        this.init();
    }

    async init() {
        await this.loadRAGIndex();
        this.createWidget();
        this.loadChatHistory();
    }

    async loadRAGIndex() {
        try {
            const response = await fetch('rag-index.json');
            if (!response.ok) {
                throw new Error(`Failed to load RAG index: ${response.status}`);
            }
            this.ragIndex = await response.json();
            console.log(`Loaded RAG index with ${this.ragIndex.totalChunks} chunks from ${this.ragIndex.totalPages} pages`);
        } catch (error) {
            console.warn('Could not load RAG index:', error);
            // Fallback to current page content
            this.ragIndex = null;
            this.loadFallbackContent();
        }
    }

    loadFallbackContent() {
        // Fallback: extract from current page
        const article = document.querySelector('article') || document.querySelector('main');
        if (!article) return;
        
        const clone = article.cloneNode(true);
        clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
        const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        
        this.ragIndex = {
            chunks: this.chunkText(text, 500).map((chunk, i) => ({
                id: `fallback-${i}`,
                pageTitle: document.title,
                text: chunk
            }))
        };
    }

    chunkText(text, chunkSize = 500) {
        const chunks = [];
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentChunk = '';
        
        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }
        
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }
        
        return chunks.filter(c => c.length > 50);
    }

    findRelevantChunks(query, topK = 5) {
        if (!this.ragIndex || !this.ragIndex.chunks || !this.ragIndex.chunks.length) {
            return [];
        }
        
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        
        // Score chunks by relevance
        const scoredChunks = this.ragIndex.chunks.map(chunk => {
            const chunkLower = chunk.text.toLowerCase();
            let score = 0;
            
            // Exact phrase match (highest weight)
            if (chunkLower.includes(queryLower)) {
                score += 20;
            }
            
            // Individual word matches
            queryWords.forEach(word => {
                const matches = (chunkLower.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length;
                score += matches * 3;
                
                // Partial matches (lower weight)
                const partialMatches = (chunkLower.match(new RegExp(word, 'gi')) || []).length;
                score += (partialMatches - matches) * 1;
            });
            
            // Boost score for section headings
            if (chunk.sectionHeading) {
                const headingLower = chunk.sectionHeading.toLowerCase();
                queryWords.forEach(word => {
                    if (headingLower.includes(word)) {
                        score += 5;
                    }
                });
            }
            
            // Boost score for page title matches
            if (chunk.pageTitle) {
                const titleLower = chunk.pageTitle.toLowerCase();
                queryWords.forEach(word => {
                    if (titleLower.includes(word)) {
                        score += 3;
                    }
                });
            }
            
            return { ...chunk, score };
        });
        
        // Sort by score and return top K
        scoredChunks.sort((a, b) => b.score - a.score);
        return scoredChunks
            .slice(0, topK)
            .filter(item => item.score > 0);
    }

    async generateResponse(userMessage) {
        const queryLower = userMessage.toLowerCase();
        
        // Find relevant chunks
        const relevantChunks = this.findRelevantChunks(userMessage, 5);
        const context = relevantChunks.map(c => c.text).join('\n\n---\n\n');
        
        // Check for specific question types
        if (queryLower.includes('what is terpedia') || queryLower.includes('about terpedia')) {
            return this.getTerpediaInfo(relevantChunks);
        }
        
        if (queryLower.includes('functional flavor') || queryLower.includes('what are functional flavors')) {
            return this.getFunctionalFlavorsInfo(relevantChunks, context);
        }
        
        if (queryLower.match(/\b(cinnamaldehyde|cinnamon)\b/i)) {
            return this.getCompoundInfo('cinnamaldehyde', relevantChunks, context);
        }
        
        if (queryLower.match(/\beugenol\b/i)) {
            return this.getCompoundInfo('eugenol', relevantChunks, context);
        }
        
        if (queryLower.match(/\b(fda|regulation|regulatory)\b/i)) {
            return this.getRegulatoryInfo(relevantChunks, context);
        }
        
        if (queryLower.match(/\b(safety|toxic|toxicity|safe)\b/i)) {
            return this.getSafetyInfo(relevantChunks, context);
        }
        
        // Generic response using context
        if (context && relevantChunks.length > 0) {
            return this.generateContextualResponse(userMessage, relevantChunks, context);
        }
        
        // Fallback
        return `I couldn't find specific information about "${userMessage}" in the site content. 

Try asking about:
• Functional flavors and their mechanisms
• Specific compounds (cinnamaldehyde, eugenol, linalool, etc.)
• FDA regulations
• Safety information
• Terpedia

Or browse the site using the navigation menu to find what you're looking for!`;
    }

    getTerpediaInfo(chunks) {
        const terpediaChunk = chunks.find(c => 
            c.text.toLowerCase().includes('terpedia') && 
            (c.text.toLowerCase().includes('repository') || c.text.toLowerCase().includes('scientific'))
        );
        
        if (terpediaChunk) {
            return `**Terpedia** is a scientific repository for functional flavors research. Here's what the site says:\n\n${terpediaChunk.text.substring(0, 600)}...\n\nFor more information, check out the "About" page or the main article.`;
        }
        
        return `**Terpedia** is a scientific repository for functional flavors research. It provides comprehensive scientific articles, detailed compound profiles, FDA regulatory information, safety data, and real-world examples. The platform serves as an authoritative, evidence-based resource that bridges peer-reviewed research, regulatory frameworks, and practical applications.`;
    }

    getFunctionalFlavorsInfo(chunks, context) {
        const intro = `**Functional flavors** are bioactive compounds found in natural foods and spices that extend beyond mere sensory perception. `;
        
        if (chunks.length > 0) {
            const bestChunk = chunks[0];
            const excerpt = bestChunk.text.substring(0, 700);
            const source = bestChunk.pageTitle ? `\n\n*Source: ${bestChunk.pageTitle}*` : '';
            return intro + `Here's what the site says:\n\n${excerpt}...${source}\n\nFor complete information, check out the main article on the homepage.`;
        }
        
        return intro + `They include terpenes, aldehydes, and phenolic compounds that interact with human physiology through various mechanisms. Check out the main article for comprehensive information!`;
    }

    getCompoundInfo(compound, chunks, context) {
        const compoundNames = {
            'cinnamaldehyde': 'Cinnamaldehyde',
            'eugenol': 'Eugenol'
        };
        
        const name = compoundNames[compound] || compound;
        const compoundChunks = chunks.filter(c => 
            c.text.toLowerCase().includes(compound.toLowerCase())
        );
        
        if (compoundChunks.length > 0) {
            const bestChunk = compoundChunks[0];
            const excerpt = bestChunk.text.substring(0, 600);
            const source = bestChunk.pageTitle ? `\n\n*Source: ${bestChunk.pageTitle}*` : '';
            return `Here's information about **${name}** from the site:\n\n${excerpt}...${source}\n\nFor complete details, visit the compound's dedicated page in the "All Compounds" section.`;
        }
        
        return `**${name}** is a functional flavor compound with various biological effects. For detailed information about its mechanisms, health effects, and safety, please visit the compound's page in the "All Compounds" section.`;
    }

    getRegulatoryInfo(chunks, context) {
        const regulatoryChunks = chunks.filter(c => 
            c.text.toLowerCase().includes('fda') || 
            c.text.toLowerCase().includes('regulation') ||
            c.text.toLowerCase().includes('claim')
        );
        
        if (regulatoryChunks.length > 0) {
            const bestChunk = regulatoryChunks[0];
            const excerpt = bestChunk.text.substring(0, 700);
            const source = bestChunk.pageTitle ? `\n\n*Source: ${bestChunk.pageTitle}*` : '';
            return `Here's information about **FDA regulations** from the site:\n\n${excerpt}...${source}\n\nFor complete regulatory details, see the "FDA Regulations and Health Claims" section in the main article.`;
        }
        
        return `The FDA distinguishes between different types of claims for functional flavors. For detailed regulatory information, see the main article's "FDA Regulations" section.`;
    }

    getSafetyInfo(chunks, context) {
        const safetyChunks = chunks.filter(c => 
            c.text.toLowerCase().includes('safety') || 
            c.text.toLowerCase().includes('toxic') ||
            c.text.toLowerCase().includes('ld50') ||
            c.sectionHeading?.toLowerCase().includes('safety')
        );
        
        if (safetyChunks.length > 0) {
            const bestChunk = safetyChunks[0];
            const excerpt = bestChunk.text.substring(0, 700);
            const source = bestChunk.pageTitle ? `\n\n*Source: ${bestChunk.pageTitle}*` : '';
            return `Here's **safety and toxicology** information from the site:\n\n${excerpt}...${source}\n\nFor comprehensive safety data, see the "Safety and Toxicology" section in the main article.`;
        }
        
        return `Safety information for functional flavors includes acute toxicity, chronic effects, drug interactions, and special population considerations. For detailed safety information, see the "Safety and Toxicology" section in the main article.`;
    }

    generateContextualResponse(query, chunks, context) {
        if (chunks.length === 0) {
            return this.generateResponse(query); // Fallback
        }
        
        // Use the best matching chunks
        const topChunks = chunks.slice(0, 3);
        const sources = [...new Set(topChunks.map(c => c.pageTitle).filter(Boolean))];
        const sourceText = sources.length > 0 ? `\n\n*Sources: ${sources.join(', ')}*` : '';
        
        // Combine top chunks
        const combinedText = topChunks.map(c => c.text).join('\n\n---\n\n');
        const excerpt = combinedText.substring(0, 800);
        
        return `Based on the site content, here's what I found:\n\n${excerpt}${excerpt.length < combinedText.length ? '...' : ''}${sourceText}\n\nFor more complete information, check the relevant sections in the article or use the table of contents to navigate directly.`;
    }

    createWidget() {
        // Create widget container
        const widget = document.createElement('div');
        widget.id = 'terpedia-chat-widget';
        widget.innerHTML = `
            <div class="chat-widget-container" id="chatContainer">
                <div class="chat-widget-header">
                    <h3>Terpedia Assistant</h3>
                    <p class="chat-subtitle">Ask questions about functional flavors or Terpedia</p>
                    <button class="chat-close-btn" id="chatCloseBtn" aria-label="Close chat">×</button>
                </div>
                <div class="chat-widget-messages" id="chatMessages">
                    <div class="chat-welcome">
                        <p>👋 Hello! I'm the Terpedia Assistant. I can help you with:</p>
                        <ul>
                            <li>Questions about functional flavors and their mechanisms</li>
                            <li>Information about specific compounds</li>
                            <li>FDA regulations and health claims</li>
                            <li>Safety and toxicology information</li>
                            <li>General questions about Terpedia</li>
                        </ul>
                        <p><strong>Note:</strong> I search the published site content to answer your questions!</p>
                    </div>
                </div>
                <div class="chat-widget-input-container">
                    <input 
                        type="text" 
                        id="chatInput" 
                        class="chat-input" 
                        placeholder="Type your question here..."
                        aria-label="Chat input"
                    />
                    <button id="chatSendBtn" class="chat-send-btn" aria-label="Send message">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                <div class="chat-widget-footer">
                    <small>Powered by Terpedia • File-Based RAG</small>
                </div>
            </div>
            <button class="chat-widget-toggle" id="chatToggleBtn" aria-label="Open chat">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="chat-badge" id="chatBadge" style="display: none;">1</span>
            </button>
        `;
        document.body.appendChild(widget);

        // Event listeners
        document.getElementById('chatToggleBtn').addEventListener('click', () => this.toggleChat());
        document.getElementById('chatCloseBtn').addEventListener('click', () => this.closeChat());
        document.getElementById('chatSendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-focus input when chat opens
        document.getElementById('chatToggleBtn').addEventListener('click', () => {
            setTimeout(() => {
                document.getElementById('chatInput').focus();
            }, 100);
        });
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const container = document.getElementById('chatContainer');
        if (this.isOpen) {
            container.classList.add('chat-open');
            document.getElementById('chatInput').focus();
        } else {
            container.classList.remove('chat-open');
        }
    }

    closeChat() {
        this.isOpen = false;
        document.getElementById('chatContainer').classList.remove('chat-open');
    }

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;

        // Add user message to chat
        this.addMessage('user', message);
        input.value = '';

        // Show loading indicator
        const loadingId = this.addMessage('assistant', 'Searching site content...', true);

        try {
            // Generate response
            const response = await this.generateResponse(message);
            
            // Remove loading message
            this.removeMessage(loadingId);
            
            // Add assistant response
            this.addMessage('assistant', response);
            
            // Save to history
            this.saveChatHistory();
        } catch (error) {
            console.error('Chat error:', error);
            this.removeMessage(loadingId);
            this.addMessage('assistant', 
                'I apologize, but I encountered an error. Please try rephrasing your question or browse the site using the navigation menu.'
            );
        }
    }

    addMessage(role, content, isLoading = false) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message chat-message-${role}`;
        messageDiv.id = messageId;
        
        if (isLoading) {
            messageDiv.innerHTML = `
                <div class="chat-message-content">
                    <div class="chat-loading">
                        <span></span><span></span><span></span>
                    </div>
                    <p>${content}</p>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="chat-message-content">
                    ${this.formatMessage(content)}
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Save to messages array
        if (!isLoading) {
            this.messages.push({ role, content });
        }
        
        return messageId;
    }

    removeMessage(messageId) {
        const message = document.getElementById(messageId);
        if (message) {
            message.remove();
        }
    }

    formatMessage(content) {
        // Basic markdown-like formatting
        content = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        // Convert URLs to links
        content = content.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank" rel="noopener">$1</a>'
        );
        
        return `<p>${content}</p>`;
    }

    saveChatHistory() {
        try {
            localStorage.setItem('terpedia_chat_history', JSON.stringify(this.messages));
        } catch (e) {
            console.warn('Could not save chat history:', e);
        }
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem('terpedia_chat_history');
            if (saved) {
                this.messages = JSON.parse(saved);
            }
        } catch (e) {
            console.warn('Could not load chat history:', e);
        }
    }
}

// Initialize chat widget when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.terpediaChat = new TerpediaChatWidget();
    });
} else {
    window.terpediaChat = new TerpediaChatWidget();
}
