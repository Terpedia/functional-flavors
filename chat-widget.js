// Terpedia Chat Widget - Client-Side RAG Implementation
// Works entirely statically without backend

class TerpediaChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.siteContent = null;
        this.init();
    }

    init() {
        this.loadSiteContent();
        this.createWidget();
        this.loadChatHistory();
    }

    async loadSiteContent() {
        // Load content from current page and other pages for RAG
        try {
            // Get current page content
            const currentPageContent = this.extractPageContent();
            
            // Try to load other key pages
            const pagesToLoad = [
                'index.html',
                'compounds.html',
                'about.html',
                'cinnamon-roll-tabs.html'
            ];
            
            const allContent = [currentPageContent];
            
            // Load other pages asynchronously (only if on same domain)
            if (window.location.protocol !== 'file:') {
                for (const page of pagesToLoad) {
                    if (page !== this.getCurrentPageName()) {
                        try {
                            const content = await this.fetchPageContent(page);
                            if (content) allContent.push(content);
                        } catch (e) {
                            // Silently fail - just use current page
                        }
                    }
                }
            }
            
            this.siteContent = {
                fullText: allContent.join('\n\n'),
                chunks: this.chunkText(allContent.join('\n\n'), 500)
            };
        } catch (error) {
            console.warn('Could not load site content:', error);
            this.siteContent = { fullText: '', chunks: [] };
        }
    }

    getCurrentPageName() {
        const path = window.location.pathname;
        return path.split('/').pop() || 'index.html';
    }

    extractPageContent() {
        // Extract text content from current page
        const article = document.querySelector('article') || document.querySelector('main');
        if (!article) return '';
        
        // Clone to avoid modifying DOM
        const clone = article.cloneNode(true);
        
        // Remove scripts and styles
        clone.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
        
        // Get text content
        let text = clone.textContent || clone.innerText || '';
        
        // Clean up
        text = text.replace(/\s+/g, ' ').trim();
        
        // Extract headings for context
        const headings = Array.from(article.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim());
        
        return `Page: ${document.title}\nHeadings: ${headings.join(' > ')}\n\n${text}`;
    }

    async fetchPageContent(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const article = doc.querySelector('article') || doc.querySelector('main');
            if (!article) return null;
            
            // Remove scripts, styles, nav, footer
            article.querySelectorAll('script, style, nav, footer').forEach(el => el.remove());
            
            const text = (article.textContent || article.innerText || '').replace(/\s+/g, ' ').trim();
            const headings = Array.from(article.querySelectorAll('h1, h2, h3, h4')).map(h => h.textContent.trim());
            
            return `Page: ${doc.title}\nHeadings: ${headings.join(' > ')}\n\n${text}`;
        } catch (e) {
            return null;
        }
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
        
        return chunks;
    }

    findRelevantContext(query, topK = 5) {
        if (!this.siteContent || !this.siteContent.chunks.length) {
            return '';
        }
        
        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        
        // Score chunks by keyword matches and position
        const scoredChunks = this.siteContent.chunks.map((chunk, index) => {
            const chunkLower = chunk.toLowerCase();
            let score = 0;
            
            // Exact phrase match (higher weight)
            if (chunkLower.includes(queryLower)) {
                score += 10;
            }
            
            // Individual word matches
            queryWords.forEach(word => {
                const matches = (chunkLower.match(new RegExp(word, 'g')) || []).length;
                score += matches * 2;
            });
            
            // Prefer earlier chunks (they often contain overview/intro)
            score += (this.siteContent.chunks.length - index) * 0.1;
            
            return { chunk, score, index };
        });
        
        // Sort by score and return top K
        scoredChunks.sort((a, b) => b.score - a.score);
        const topChunks = scoredChunks.slice(0, topK)
            .filter(item => item.score > 0)
            .map(item => item.chunk);
        
        return topChunks.join('\n\n---\n\n');
    }

    async generateResponse(userMessage, context) {
        // Client-side response generation using the content
        // This is a simple rule-based system - for better results, use OpenAI API with a serverless function
        
        const queryLower = userMessage.toLowerCase();
        
        // Check for common questions
        if (queryLower.includes('what is terpedia') || queryLower.includes('about terpedia')) {
            return this.getTerpediaInfo();
        }
        
        if (queryLower.includes('functional flavor') || queryLower.includes('what are functional flavors')) {
            return this.getFunctionalFlavorsInfo(context);
        }
        
        if (queryLower.includes('cinnamaldehyde') || queryLower.includes('cinnamon')) {
            return this.getCompoundInfo('cinnamaldehyde', context);
        }
        
        if (queryLower.includes('eugenol')) {
            return this.getCompoundInfo('eugenol', context);
        }
        
        if (queryLower.includes('fda') || queryLower.includes('regulation')) {
            return this.getRegulatoryInfo(context);
        }
        
        if (queryLower.includes('safety') || queryLower.includes('toxic')) {
            return this.getSafetyInfo(context);
        }
        
        // Generic response using context
        if (context) {
            return this.generateContextualResponse(userMessage, context);
        }
        
        // Fallback
        return `I found some information that might help. Based on the site content, here's what I can tell you:\n\n${context ? context.substring(0, 500) + '...' : 'Please try rephrasing your question or browse the site using the navigation menu.'}`;
    }

    getTerpediaInfo() {
        return `**Terpedia** is a scientific repository for functional flavors research. It provides:

• Comprehensive scientific articles on functional flavors
• Detailed compound profiles with mechanisms of action
• FDA regulatory information
• Safety and toxicology data
• Real-world examples (like the cinnamon roll analysis)

Terpedia serves as an authoritative, evidence-based resource that bridges peer-reviewed research, regulatory frameworks, and practical applications. The platform is designed to make scientific information about functional flavors accessible to researchers, industry professionals, healthcare providers, and consumers.

You can explore the site using the navigation menu or ask me specific questions about functional flavors!`;
    }

    getFunctionalFlavorsInfo(context) {
        const intro = `**Functional flavors** are bioactive compounds found in natural foods and spices that extend beyond mere sensory perception. `;
        
        if (context) {
            const relevant = context.substring(0, 800);
            return intro + `Here's what the site says:\n\n${relevant}...\n\nFor more details, check out the main article on the homepage.`;
        }
        
        return intro + `They include terpenes, aldehydes, and phenolic compounds that interact with human physiology through various mechanisms including receptor binding, enzymatic modulation, and cellular signaling pathways. Check out the main article for comprehensive information!`;
    }

    getCompoundInfo(compound, context) {
        const compoundNames = {
            'cinnamaldehyde': 'Cinnamaldehyde',
            'eugenol': 'Eugenol'
        };
        
        const name = compoundNames[compound] || compound;
        
        if (context) {
            const relevant = context.substring(0, 600);
            return `Here's information about **${name}** from the site:\n\n${relevant}...\n\nFor complete details, visit the compound's dedicated page in the "All Compounds" section.`;
        }
        
        return `**${name}** is a functional flavor compound with various biological effects. For detailed information about its mechanisms, health effects, and safety, please visit the compound's page in the "All Compounds" section or check the main article.`;
    }

    getRegulatoryInfo(context) {
        if (context) {
            const relevant = context.substring(0, 700);
            return `Here's information about **FDA regulations** from the site:\n\n${relevant}...\n\nFor complete regulatory details, see the "FDA Regulations and Health Claims" section in the main article.`;
        }
        
        return `The FDA distinguishes between different types of claims for functional flavors:
• **Structure/function claims** - describe how a substance affects body structure/function
• **Health claims** - require FDA pre-approval
• **Qualified health claims** - require specific disclaimers

Most functional flavor compounds have GRAS status for flavoring purposes. For detailed regulatory information, see the main article's "FDA Regulations" section.`;
    }

    getSafetyInfo(context) {
        if (context) {
            const relevant = context.substring(0, 700);
            return `Here's **safety and toxicology** information from the site:\n\n${relevant}...\n\nFor comprehensive safety data, see the "Safety and Toxicology" section in the main article.`;
        }
        
        return `Safety information for functional flavors includes:
• Acute toxicity (LD50 values)
• Chronic toxicity and carcinogenicity
• Drug interactions
• Special populations (pregnant women, children, elderly)
• Regulatory safety assessments

Most compounds are safe at typical dietary levels. For detailed safety information, see the "Safety and Toxicology" section in the main article.`;
    }

    generateContextualResponse(query, context) {
        // Extract the most relevant sentences
        const sentences = context.match(/[^.!?]+[.!?]+/g) || [];
        const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        
        // Score sentences
        const scoredSentences = sentences.map(sentence => {
            const sentenceLower = sentence.toLowerCase();
            let score = 0;
            queryWords.forEach(word => {
                if (sentenceLower.includes(word)) score++;
            });
            return { sentence, score };
        });
        
        scoredSentences.sort((a, b) => b.score - a.score);
        const topSentences = scoredSentences.slice(0, 5).map(s => s.sentence).join(' ');
        
        return `Based on the site content, here's what I found:\n\n${topSentences}\n\nFor more complete information, please check the relevant sections in the article or use the table of contents to navigate directly.`;
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
                        <p><strong>Note:</strong> I search the site content to answer your questions. For the best experience, try asking about topics covered in the articles!</p>
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
                    <small>Powered by Terpedia • Client-Side RAG</small>
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
            // Find relevant context
            const context = this.findRelevantContext(message);
            
            // Generate response
            const response = await this.generateResponse(message, context);
            
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
                // Optionally restore last few messages to UI
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
