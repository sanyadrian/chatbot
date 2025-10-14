// Chat Management Module
class ChatManager {
    constructor() {
        this.apiBase = window.location.origin;
        this.socket = null;
        this.currentChat = null;
        this.messages = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Message input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Send button
        const sendBtn = document.getElementById('sendMessageBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => {
                this.sendMessage();
            });
        }

        // Chat actions
        const assignBtn = document.getElementById('assignChatBtn');
        if (assignBtn) {
            assignBtn.addEventListener('click', () => {
                this.assignCurrentChat();
            });
        }

        // Close button is handled by app.js to avoid conflicts

        const deleteBtn = document.getElementById('deleteChatBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.deleteCurrentChat();
            });
        }

        // Status filter
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterChats(e.target.value);
            });
        }
    }

    async loadChats(status = 'all') {
        try {
            const response = await fetch(`${this.apiBase}/api/chats/sessions?status=${status}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.sessions || [];
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
        return [];
    }

    async loadChatMessages(chatId) {
        try {
            const response = await fetch(`${this.apiBase}/api/chats/${chatId}/messages`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.messages = data.messages || [];
                this.renderMessages();
                return this.messages;
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
        return [];
    }

    async sendMessage() {
        if (!this.currentChat) return;

        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;

        // Add message to UI immediately for better UX
        this.addMessageToUI({
            content: message,
            sender_type: 'agent',
            created_at: new Date().toISOString()
        });

        messageInput.value = '';

        try {
            const response = await fetch(`${this.apiBase}/api/chats/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    session_id: this.currentChat.session_id || this.currentChat.id,
                    message: message,
                    sender_type: 'agent'
                })
            });

            if (!response.ok) {
                // Remove the message if sending failed
                this.removeLastMessage();
                throw new Error('Failed to send message');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Failed to send message. Please try again.');
        }
    }

    addMessageToUI(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = this.createMessageElement(message);
        chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    removeLastMessage() {
        const chatMessages = document.getElementById('chatMessages');
        const lastMessage = chatMessages.lastElementChild;
        if (lastMessage && lastMessage.classList.contains('message')) {
            lastMessage.remove();
        }
    }

    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender_type === 'agent' ? 'agent' : 'customer'}`;
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `;

        return messageDiv;
    }

    renderMessages() {
        const chatMessages = document.getElementById('chatMessages');
        
        if (this.messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="no-chat-selected">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation</p>
                </div>
            `;
            return;
        }

        chatMessages.innerHTML = this.messages.map(message => 
            this.createMessageElement(message).outerHTML
        ).join('');

        this.scrollToBottom();
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    selectChat(chat) {
        this.currentChat = chat;
        this.loadChatMessages(chat.session_id || chat.id);
        this.updateChatHeader(chat);
        this.showChatInterface();
        
        // Start polling for new messages as fallback
        this.startMessagePolling();
        
        // Note: Assignment is handled by app.js to avoid duplicates
    }

    startMessagePolling() {
        // Clear existing polling
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
        }

        // Poll for new messages every 3 seconds
        this.messagePollingInterval = setInterval(() => {
            if (this.currentChat) {
                this.loadChatMessages(this.currentChat.session_id || this.currentChat.id);
            }
        }, 3000);
    }

    stopMessagePolling() {
        if (this.messagePollingInterval) {
            clearInterval(this.messagePollingInterval);
            this.messagePollingInterval = null;
        }
    }

    async loadChatMessages(sessionId) {
        console.log('Loading messages for session:', sessionId);
        console.log('API URL:', `${this.apiBase}/api/chats/messages?session_id=${sessionId}`);
        
        try {
            const response = await fetch(`${this.apiBase}/api/chats/messages?session_id=${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            console.log('Messages response status:', response.status);
            console.log('Messages response ok:', response.ok);

            if (response.ok) {
                const data = await response.json();
                console.log('Messages data:', data);
                const newMessages = data.messages || [];
                
                // Only update if there are new messages
                if (newMessages.length !== this.messages.length) {
                    console.log('New messages detected, updating UI');
                    this.messages = newMessages;
                    this.renderMessages();
                }
            } else {
                const errorText = await response.text();
                console.error('Failed to load messages:', response.status, errorText);
                this.messages = [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.messages = [];
            this.renderMessages();
        }
    }

    renderMessages() {
        const chatMessages = document.getElementById('chatMessages');
        
        if (this.messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-comments"></i>
                    <p>No messages yet. Start the conversation!</p>
                </div>
            `;
            return;
        }

        chatMessages.innerHTML = this.messages.map(message => `
            <div class="message ${message.sender_type}">
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-time">${this.formatTime(message.created_at)}</div>
            </div>
        `).join('');

        this.scrollToBottom();
    }

    updateChatHeader(chat) {
        document.getElementById('customerName').textContent = chat.customer_name || 'Unknown Customer';
        document.getElementById('customerEmail').textContent = chat.customer_email || 'No email';
        document.getElementById('chatTopic').textContent = chat.topic || 'General';
        document.getElementById('chatStatus').textContent = chat.status;
    }

    showChatInterface() {
        document.getElementById('chatHeader').style.display = 'flex';
        document.getElementById('chatInputContainer').style.display = 'block';
        
        // Setup message input
        this.setupMessageInput();
    }

    setupMessageInput() {
        // Use event delegation to handle clicks and keypress events
        // This ensures the events work even if elements are added dynamically
        
        // Remove any existing listeners first
        document.removeEventListener('click', this.handleSendClick);
        document.removeEventListener('keypress', this.handleKeyPress);
        document.removeEventListener('input', this.handleInput);
        
        // Bind the handlers to this context
        this.handleSendClick = this.handleSendClick.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.handleInput = this.handleInput.bind(this);
        
        // Add event listeners
        document.addEventListener('click', this.handleSendClick);
        document.addEventListener('keypress', this.handleKeyPress);
        document.addEventListener('input', this.handleInput);
    }

    handleInput(event) {
        if (event.target && event.target.id === 'messageInput') {
            // Store the current input value
            this.currentInputValue = event.target.value;
            console.log('Input value changed:', this.currentInputValue);
        }
    }

    handleSendClick(event) {
        if (event.target && event.target.id === 'sendMessageBtn') {
            console.log('Send button clicked!');
            event.preventDefault();
            event.stopPropagation();
            
            // Get the message value immediately
            const messageInput = document.getElementById('messageInput');
            console.log('Message input value at click:', messageInput ? messageInput.value : 'input not found');
            
            this.sendMessage();
        }
    }

    handleKeyPress(event) {
        if (event.target && event.target.id === 'messageInput' && event.key === 'Enter') {
            console.log('Enter key pressed in message input!');
            event.preventDefault();
            event.stopPropagation();
            
            // Get the message value immediately
            const messageInput = document.getElementById('messageInput');
            console.log('Message input value at keypress:', messageInput ? messageInput.value : 'input not found');
            
            this.sendMessage();
        }
    }

    async sendMessage() {
        console.log('=== sendMessage() called ===');
        
        const messageInput = document.getElementById('messageInput');
        console.log('Message input element:', messageInput);
        console.log('Message input value (raw):', messageInput ? messageInput.value : 'input not found');
        console.log('Stored input value:', this.currentInputValue);
        
        // Use stored value if available, otherwise get from input
        const message = (this.currentInputValue || (messageInput ? messageInput.value : '')).trim();

        console.log('Message input value (trimmed):', message);
        console.log('Current chat:', this.currentChat);

        if (!message || !this.currentChat) {
            console.log('Exiting sendMessage: no message or no current chat');
            return;
        }

        // Clear input AFTER capturing the message
        if (messageInput) {
            messageInput.value = '';
        }
        this.currentInputValue = '';

        // Debug logging
        console.log('Sending message debug:');
        console.log('Current chat:', this.currentChat);
        console.log('Session ID:', this.currentChat.session_id || this.currentChat.id);
        console.log('Message:', message);

        // Add message to UI immediately
        const tempMessage = {
            content: message,
            sender_type: 'agent',
            created_at: new Date().toISOString()
        };
        this.messages.push(tempMessage);
        this.renderMessages();

        const requestBody = {
            session_id: this.currentChat.session_id || this.currentChat.id,
            message: message,
            sender_type: 'agent'
        };

        console.log('Request body:', requestBody);
        console.log('API URL:', `${this.apiBase}/api/chats/message`);

        try {
            const response = await fetch(`${this.apiBase}/api/chats/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const data = await response.json();
                // Update the temporary message with the real one
                const messageIndex = this.messages.findIndex(m => m.content === message && m.sender_type === 'agent');
                if (messageIndex !== -1) {
                    this.messages[messageIndex] = data.message;
                    this.renderMessages();
                }
            } else {
                console.error('Failed to send message');
                // Remove the temporary message
                this.messages = this.messages.filter(m => m !== tempMessage);
                this.renderMessages();
                this.showError('Failed to send message');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Remove the temporary message
            this.messages = this.messages.filter(m => m !== tempMessage);
            this.renderMessages();
            this.showError('Failed to send message');
        }
    }

    hideChatInterface() {
        document.getElementById('chatHeader').style.display = 'none';
        document.getElementById('chatInputContainer').style.display = 'none';
        document.getElementById('chatMessages').innerHTML = `
            <div class="no-chat-selected">
                <i class="fas fa-comments"></i>
                <h3>Select a chat to start</h3>
                <p>Choose a conversation from the sidebar to begin chatting</p>
            </div>
        `;
        this.currentChat = null;
        this.messages = [];
    }

    async closeCurrentChat() {
        console.log('🚀 CLOSE CURRENT CHAT - UPDATED VERSION LOADED!');
        console.log('🚀 CLOSE CURRENT CHAT - Button clicked!');
        if (!this.currentChat) return;

        if (!confirm('Are you sure you want to close this chat?')) return;

        try {
            console.log('🔄 CHAT.JS: Attempting to close chat with ID:', this.currentChat);
            console.log('🔄 CHAT.JS: API Base URL:', this.apiBase);
            console.log('🔄 CHAT.JS: Full URL:', `${this.apiBase}/api/chats/close-session`);
            
            const url = `${this.apiBase}/api/chats/delete`;
            console.log('🔄 CHAT.JS: About to call URL:', url);
            
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ session_id: this.currentChat.session_id, action: 'close' })
            });

            console.log('🔄 CHAT.JS: Response status:', response.status);
            console.log('🔄 CHAT.JS: Response ok:', response.ok);

            if (response.ok) {
                this.hideChatInterface();
                // Refresh chats list
                if (window.app) {
                    window.app.loadChats();
                }
            } else {
                this.showError('Failed to close chat');
            }
        } catch (error) {
            console.error('Failed to close chat:', error);
            this.showError('Failed to close chat');
        }
    }

    // Assignment is handled by app.js to avoid duplicates

    // Welcome message is handled by app.js to avoid duplicates

    async deleteCurrentChat() {
        if (!this.currentChat) return;

        if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) return;

        // Debug: Log the current chat object
        console.log('Delete Chat Debug:');
        console.log('Current Chat Object:', this.currentChat);
        console.log('Current Chat Type:', typeof this.currentChat);
        console.log('Current Chat Keys:', this.currentChat ? Object.keys(this.currentChat) : 'No currentChat');
        console.log('Session ID:', this.currentChat ? (this.currentChat.session_id || this.currentChat.id) : 'No currentChat');
        console.log('API Base:', this.apiBase);
        console.log('Token:', localStorage.getItem('token') ? 'Present' : 'Missing');

        if (!this.currentChat) {
            console.error('ERROR: No current chat selected!');
            this.showError('No chat selected for deletion');
            return;
        }

        try {
            const sessionId = this.currentChat.session_id || this.currentChat.id;
            console.log('Current chat object:', this.currentChat);
            console.log('Extracted session ID:', sessionId);
            console.log('Session ID type:', typeof sessionId);
            
            if (!sessionId) {
                console.error('ERROR: No session ID found in current chat!');
                this.showError('No session ID found for this chat');
                return;
            }
            
            const requestBody = { session_id: sessionId };
            console.log('Request Body:', requestBody);

            const response = await fetch(`${this.apiBase}/api/chats/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response Status:', response.status);
            console.log('Response OK:', response.ok);

            if (response.ok) {
                const result = await response.json();
                console.log('Delete Success:', result);
                this.hideChatInterface();
                // Refresh chats list
                if (window.app) {
                    window.app.loadChats();
                }
            } else {
                const errorData = await response.json();
                console.error('Delete Error Response:', errorData);
                this.showError('Failed to delete chat: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to delete chat:', error);
            this.showError('Failed to delete chat: ' + error.message);
        }
    }

    async assignChat(chatId, agentId) {
        try {
            const response = await fetch(`${this.apiBase}/api/chats/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    session_id: chatId,
                    agent_id: agentId
                })
            });

            if (response.ok) {
                // Refresh chats list
                if (window.app) {
                    window.app.loadChats();
                }
                return true;
            }
        } catch (error) {
            console.error('Failed to assign chat:', error);
        }
        return false;
    }

    filterChats(status) {
        // This would filter the displayed chats based on status
        // Implementation depends on how chats are rendered
        if (window.app) {
            window.app.loadChats(status);
        }
    }

    setupSocket(socket) {
        this.socket = socket;

        // Handle new messages
        this.socket.on('message-received', (data) => {
            if (this.currentChat && this.currentChat.id === data.sessionId) {
                this.addMessageToUI({
                    content: data.message,
                    sender_type: data.senderType,
                    created_at: data.timestamp
                });
            }
            // Refresh chats list to show updated last message
            if (window.app) {
                window.app.loadChats();
            }
        });

        // Handle new customer messages (with notification)
        this.socket.on('new-customer-message', (data) => {
            this.showNotification(`New message in chat ${data.sessionId}`, 'info');
            
            // Show browser notification
            if (window.notificationService) {
                window.notificationService.showNewMessageNotification({
                    customerName: 'Customer',
                    message: data.message || 'New message received',
                    sessionId: data.sessionId
                });
            }
            
            // Refresh chats list
            if (window.app) {
                window.app.loadChats();
            }
        });

        // Handle new chat sessions
        this.socket.on('new-chat-available', (data) => {
            this.showNotification(`New chat from ${data.customerName} (${data.topic})`, 'success');
            
            // Show browser notification
            if (window.notificationService) {
                window.notificationService.showNewChatNotification(data);
            }
            
            // Refresh chats list
            if (window.app) {
                window.app.loadChats();
            }
        });

        // Handle chat status changes
        this.socket.on('chat-status-changed', (data) => {
            if (this.currentChat && this.currentChat.id === data.sessionId) {
                this.currentChat.status = data.status;
                this.updateChatHeader(this.currentChat);
            }
            // Refresh chats list
            if (window.app) {
                window.app.loadChats();
            }
        });

        // Handle agent assignment
        this.socket.on('agent-assigned', (data) => {
            if (this.currentChat && this.currentChat.id === data.sessionId) {
                this.showNotification(`Agent assigned to chat ${data.sessionId}`, 'info');
            }
            // Refresh chats list
            if (window.app) {
                window.app.loadChats();
            }
        });

        // Handle typing indicators
        this.socket.on('user-typing', (data) => {
            if (this.currentChat && this.currentChat.id === data.sessionId) {
                this.showTypingIndicator(data.userId, data.isTyping);
            }
        });

        // Handle new messages
        this.socket.on('new-message', (data) => {
            console.log('Received new message via socket:', data);
            if (this.currentChat && (this.currentChat.session_id === data.session_id || this.currentChat.id === data.session_id)) {
                console.log('Adding new message to current chat');
                this.messages.push(data.message);
                this.renderMessages();
            } else {
                console.log('Message not for current chat. Current:', this.currentChat?.session_id, 'Message:', data.session_id);
            }
        });

        // Handle chat updates
        this.socket.on('chat-updated', (data) => {
            console.log('Chat updated via socket:', data);
            if (window.app) {
                window.app.loadChats();
            }
        });
    }

    showTypingIndicator(userId, isTyping) {
        const chatMessages = document.getElementById('chatMessages');
        let typingIndicator = document.getElementById('typing-indicator');
        
        if (isTyping) {
            if (!typingIndicator) {
                typingIndicator = document.createElement('div');
                typingIndicator.id = 'typing-indicator';
                typingIndicator.className = 'message customer typing-indicator';
                typingIndicator.innerHTML = `
                    <div class="message-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="message-content">
                        <div class="typing-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                `;
                chatMessages.appendChild(typingIndicator);
                this.scrollToBottom();
            }
        } else {
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Remove after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) { // Less than 1 minute
            return 'Just now';
        } else if (diff < 3600000) { // Less than 1 hour
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        } else if (diff < 86400000) { // Less than 1 day
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    showError(message) {
        // Create a temporary error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '20px';
        errorDiv.style.right = '20px';
        errorDiv.style.zIndex = '1000';
        
        document.body.appendChild(errorDiv);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    showSuccess(message) {
        // Create a temporary success message
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        successDiv.style.position = 'fixed';
        successDiv.style.top = '20px';
        successDiv.style.right = '20px';
        successDiv.style.zIndex = '1000';
        successDiv.style.backgroundColor = '#4CAF50';
        successDiv.style.color = 'white';
        successDiv.style.padding = '10px 15px';
        successDiv.style.borderRadius = '4px';
        successDiv.style.fontSize = '14px';
        
        document.body.appendChild(successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Initialize chat manager
window.chatManager = new ChatManager();
