// Terpedia Chat Widget - Integrated with KB Terpedia API
// Uses the existing kb.terpedia.com chat API

class TerpediaChatWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        // Use KB Terpedia chat API
        this.apiEndpoint = 'https://kb.terpedia.com/chat'; // Main chat endpoint
        // Fallback to OpenRouter-compatible endpoint if needed
        this.openRouterEndpoint = 'https://kb.terpedia.com/v1/chat/completions';
        this.init();
    }

    init() {
        this.createWidget();
        this.loadChatHistory();
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
                            <li>Information about specific compounds (terpenes, aldehydes, etc.)</li>
                            <li>FDA regulations and health claims</li>
                            <li>Safety and toxicology information</li>
                            <li>General questions about Terpedia</li>
                            <li>Terpene-protein interactions</li>
                            <li>Molecular properties and analysis</li>
                        </ul>
                        <p>What would you like to know?</p>
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
                    <small>Powered by KB Terpedia • OpenAI</small>
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
        const loadingId = this.addMessage('assistant', 'Thinking...', true);

        try {
            // Try main chat endpoint first
            let response;
            try {
                response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        message: message,
                        context: {
                            conversation_history: this.messages.slice(-10), // Last 10 messages for context
                            site: 'functional-flavors'
                        }
                    }),
                });
            } catch (error) {
                // Fallback to OpenRouter-compatible endpoint
                console.warn('Main endpoint failed, trying OpenRouter endpoint:', error);
                response = await fetch(this.openRouterEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'terpedia/unified',
                        messages: [
                            ...this.messages.slice(-10).map(msg => ({
                                role: msg.role,
                                content: msg.content
                            })),
                            {
                                role: 'user',
                                content: message
                            }
                        ],
                        stream: false
                    }),
                });
            }

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Remove loading message
            this.removeMessage(loadingId);
            
            // Extract response text (handle different response formats)
            let responseText;
            if (data.response) {
                // Main chat endpoint format
                responseText = data.response;
            } else if (data.choices && data.choices[0] && data.choices[0].message) {
                // OpenRouter format
                responseText = data.choices[0].message.content;
            } else if (data.message) {
                // Alternative format
                responseText = data.message;
            } else {
                responseText = JSON.stringify(data);
            }
            
            // Add assistant response
            this.addMessage('assistant', responseText);
            
            // Save to history
            this.saveChatHistory();
        } catch (error) {
            console.error('Chat error:', error);
            this.removeMessage(loadingId);
            this.addMessage('assistant', 
                `I apologize, but I'm having trouble connecting to the Terpedia API. ` +
                `Please check your internet connection and try again. ` +
                `Error: ${error.message}`
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

    setApiEndpoint(endpoint) {
        this.apiEndpoint = endpoint;
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
