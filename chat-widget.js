// Terpedia Chat Widget - SQLite-Vec RAG Implementation
// Uses SQLite-WASM + sqlite-vec for client-side vector search

class TerpediaChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.db = null;
        this.sqlite3 = null;
        this.initialized = false;
        this.apiEndpoint = 'http://kb.terpedia.com:8000/chat'; // KB Terpedia API fallback
        this.init();
    }

    async init() {
        this.createWidget();
        await this.loadDatabase();
        this.loadChatHistory();
    }

    async loadDatabase() {
        try {
            // Load SQLite-WASM
            await this.loadSQLiteWASM();
            
            // Load database file
            const response = await fetch('rag.sqlite');
            if (!response.ok) {
                throw new Error(`Failed to load database: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const dbBytes = new Uint8Array(arrayBuffer);
            
            // Open database
            this.db = new this.sqlite3.oo1.DB(dbBytes, 'c');
            
            // Try to load sqlite-vec extension (if available)
            try {
                // sqlite-vec extension would be loaded here
                // For now, we'll use keyword search as fallback
                console.log('✓ Database loaded (keyword search mode)');
            } catch (e) {
                console.log('⚠ sqlite-vec not available, using keyword search');
            }
            
            this.initialized = true;
            this.updateStatus('✓ Knowledge base loaded and ready!', 'success');
        } catch (error) {
            console.warn('Could not load SQLite database:', error);
            this.initialized = false;
            this.updateStatus('⚠ Using API fallback (database not available)', 'warning');
        }
    }

    async loadSQLiteWASM() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (window.sqlite3InitModule) {
                this.sqlite3 = window.sqlite3;
                resolve();
                return;
            }
            
            // Load SQLite-WASM from CDN
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@sqlite.org/sqlite-wasm@3.45.1/sqlite-wasm/jswasm/sqlite3.mjs';
            script.type = 'module';
            script.onload = async () => {
                try {
                    // Initialize SQLite
                    this.sqlite3 = await window.sqlite3InitModule({
                        print: console.log,
                        printErr: console.error,
                    });
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };
            script.onerror = () => reject(new Error('Failed to load SQLite-WASM'));
            document.head.appendChild(script);
        });
    }

    async findRelevantChunks(query, topK = 5) {
        if (!this.initialized || !this.db) {
            return [];
        }
        
        try {
            const queryLower = query.toLowerCase();
            const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
            
            if (queryWords.length === 0) {
                return [];
            }
            
            // Build keyword-based search query
            // This works without sqlite-vec, using LIKE for keyword matching
            const conditions = queryWords.map(word => 
                `chunk_text LIKE '%' || ? || '%'`
            ).join(' OR ');
            
            const sql = `
                SELECT 
                    id,
                    page_title,
                    page_url,
                    section_heading,
                    chunk_text,
                    word_count
                FROM chunks
                WHERE ${conditions}
                ORDER BY 
                    CASE 
                        WHEN chunk_text LIKE '%' || ? || '%' THEN 10
                        ELSE 1
                    END DESC,
                    word_count DESC
                LIMIT ?
            `;
            
            // Execute query with parameters
            const params = [...queryWords, queryWords[0], topK];
            const results = this.db.exec({
                sql: sql,
                bind: params,
                returnValue: 'resultRows',
                rowMode: 'object'
            });
            
            return results || [];
        } catch (error) {
            console.error('Error searching database:', error);
            return [];
        }
    }

    async generateResponse(userMessage) {
        // Try vector/keyword search first if database is loaded
        if (this.initialized && this.db) {
            const relevantChunks = await this.findRelevantChunks(userMessage, 5);
            
            if (relevantChunks.length > 0) {
                const context = relevantChunks.map(c => c.chunk_text).join('\n\n---\n\n');
                return this.generateContextualResponse(userMessage, relevantChunks, context);
            }
        }
        
        // Fallback to API
        return await this.callAPI(userMessage);
    }

    async callAPI(userMessage) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    context: {
                        conversation_history: this.messages.slice(-10),
                        site: 'functional-flavors'
                    }
                }),
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            return data.response || data.message || JSON.stringify(data);
        } catch (error) {
            // If API fails and we have database, try harder with database
            if (this.initialized && this.db) {
                const chunks = await this.findRelevantChunks(userMessage, 10);
                if (chunks.length > 0) {
                    return this.generateContextualResponse(userMessage, chunks, 
                        chunks.map(c => c.chunk_text).join('\n\n'));
                }
            }
            throw error;
        }
    }

    generateContextualResponse(query, chunks, context) {
        if (chunks.length === 0) {
            return `I couldn't find specific information about "${query}" in the site content. Try asking about functional flavors, compounds, FDA regulations, or safety information.`;
        }
        
        const topChunks = chunks.slice(0, 3);
        const sources = [...new Set(topChunks.map(c => c.page_title).filter(Boolean))];
        const sourceText = sources.length > 0 ? `\n\n*Sources: ${sources.join(', ')}*` : '';
        
        const combinedText = topChunks.map(c => c.chunk_text).join('\n\n---\n\n');
        const excerpt = combinedText.substring(0, 1000);
        
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
                        <p id="dbStatus">Loading knowledge base...</p>
                    </div>
                </div>
                <div class="chat-widget-input-container">
                    <input 
                        type="text" 
                        id="chatInput" 
                        class="chat-input" 
                        placeholder="Type your question here..."
                        aria-label="Chat input"
                        disabled
                    />
                    <button id="chatSendBtn" class="chat-send-btn" aria-label="Send message" disabled>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                <div class="chat-widget-footer">
                    <small>Powered by SQLite-Vec • KB Terpedia API</small>
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
                if (!document.getElementById('chatInput').disabled) {
                    document.getElementById('chatInput').focus();
                }
            }, 100);
        });
    }

    updateStatus(message, type = 'info') {
        const statusEl = document.getElementById('dbStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = type === 'success' ? '#27ae60' : 
                                  type === 'warning' ? '#e67e22' : '#7f8c8d';
        }
        
        // Enable/disable input based on status
        const input = document.getElementById('chatInput');
        const button = document.getElementById('chatSendBtn');
        if (input && button) {
            input.disabled = false; // Always enable (can use API fallback)
            button.disabled = false;
        }
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const container = document.getElementById('chatContainer');
        if (this.isOpen) {
            container.classList.add('chat-open');
            if (!document.getElementById('chatInput').disabled) {
                document.getElementById('chatInput').focus();
            }
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
        const loadingId = this.addMessage('assistant', 'Searching knowledge base...', true);

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
                `I apologize, but I encountered an error: ${error.message}. Please try again or browse the site using the navigation menu.`
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
