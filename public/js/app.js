// Main App JavaScript
class ChatDashboard {
    constructor() {
        this.apiBase = window.location.origin;
        this.socket = null;
        this.currentUser = null;
        this.currentChat = null;
        this.chats = [];
        this.websites = [];
        this.agents = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.showSection(section);
                this.updateActiveNav(item);
            });
        });

        // Test notification button
        const testNotificationBtn = document.getElementById('testNotificationBtn');
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Initialize audio context on first user interaction
                if (window.notificationService) {
                    window.notificationService.initializeAudioContext();
                }
                this.testNotifications();
            });
        }

        // Test server notifications button (right-click for server test)
        if (testNotificationBtn) {
            testNotificationBtn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.testServerNotifications();
            });
        }

        // Sidebar toggle for mobile
        const sidebarToggle = document.getElementById('sidebarToggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                document.querySelector('.sidebar').classList.toggle('open');
            });
        }

        // Logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (window.authManager) {
                    window.authManager.logout();
                } else {
                    this.logout();
                }
            });
        }

        // User menu
        const userMenuBtn = document.querySelector('.user-menu-btn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                // Toggle user menu dropdown (implement if needed)
            });
        }
    }

    async checkAuth() {
        const token = localStorage.getItem('token');
        console.log('Checking auth with token:', token ? 'exists' : 'missing');
        
        if (!token) {
            console.log('No token found, showing login page');
            this.showLoginPage();
            return;
        }

        try {
            console.log('Making auth request to:', `${this.apiBase}/api/auth/me`);
            const response = await fetch(`${this.apiBase}/api/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('Auth response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Auth successful, user data:', data);
                this.currentUser = data.agent;
                this.showDashboard();
                this.initializeSocket();
                this.loadInitialData();
            } else {
                console.log('Auth check failed:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({}));
                console.log('Error data:', errorData);
                localStorage.removeItem('token');
                this.showLoginPage();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
            this.showLoginPage();
        }
    }

    showLoginPage() {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('dashboard').style.display = 'flex';
        
        // Update user info
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.name;
            document.getElementById('userNameSmall').textContent = this.currentUser.name;
        }
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        const section = document.getElementById(`${sectionName}Section`);
        if (section) {
            section.classList.add('active');
            document.getElementById('pageTitle').textContent = this.getSectionTitle(sectionName);
        }

        // Load section data
        this.loadSectionData(sectionName);
    }

    getSectionTitle(sectionName) {
        const titles = {
            'chats': 'Live Chats',
            'websites': 'Websites',
            'messages': 'Offline Messages',
            'agents': 'Agents',
            'settings': 'Settings'
        };
        return titles[sectionName] || 'Dashboard';
    }

    updateActiveNav(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'chats':
                await this.loadChats();
                break;
            case 'websites':
                if (window.websitesManager) {
                    await window.websitesManager.loadWebsites();
                }
                break;
            case 'messages':
                if (window.app && window.app.initMessagesSection) {
                    window.app.initMessagesSection();
                }
                break;
            case 'agents':
                if (window.agentsManager) {
                    await window.agentsManager.loadAgents();
                }
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    async loadInitialData() {
        await Promise.all([
            this.loadChats(),
            this.loadWebsites(),
            this.loadAgents()
        ]);
    }

    async loadChats() {
        try {
            const response = await fetch(`${this.apiBase}/api/chats/sessions`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.chats = data.sessions || [];
                this.renderChats();
                this.updateActiveChatsCount();
            }
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    }

    async loadWebsites() {
        try {
            const response = await fetch(`${this.apiBase}/api/websites/list`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.websites = data.websites || [];
                this.renderWebsites();
            }
        } catch (error) {
            console.error('Failed to load websites:', error);
        }
    }

    async loadAgents() {
        try {
            const response = await fetch(`${this.apiBase}/api/agents/list`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.agents = data.agents || [];
                this.renderAgents();
            }
        } catch (error) {
            console.error('Failed to load agents:', error);
        }
    }

    loadSettings() {
        if (this.currentUser) {
            document.getElementById('profileName').value = this.currentUser.name;
            document.getElementById('profileEmail').value = this.currentUser.email;
        }
    }

    renderChats() {
        const chatsList = document.getElementById('chatsList');
        if (!chatsList) return;

        if (this.chats.length === 0) {
            chatsList.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-comments" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">No active chats</p>
                </div>
            `;
            return;
        }

        chatsList.innerHTML = this.chats.map(chat => `
            <div class="chat-item" data-chat-id="${chat.id}" onclick="app.selectChat(${chat.id})">
                <div class="chat-item-header">
                    <div class="chat-customer-info">
                        <div class="chat-customer-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="chat-customer-details">
                            <h4>${chat.customer_name || 'Unknown Customer'}</h4>
                            <p>${chat.customer_email || 'No email'}</p>
                        </div>
                    </div>
                    <div class="chat-status ${chat.status}">${chat.status}</div>
                </div>
                <div class="chat-preview">
                    ${chat.last_message || 'No messages yet'}
                </div>
                <div class="chat-meta">
                    <div class="chat-topic">${chat.topic || 'General'}</div>
                    <div class="chat-time">${this.formatTime(chat.last_activity || chat.started_at)}</div>
                </div>
            </div>
        `).join('');
    }

    renderWebsites() {
        const websitesGrid = document.getElementById('websitesGrid');
        if (!websitesGrid) return;

        if (this.websites.length === 0) {
            websitesGrid.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-globe" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">No websites registered</p>
                </div>
            `;
            return;
        }

        websitesGrid.innerHTML = this.websites.map(website => `
            <div class="website-card">
                <div class="website-header">
                    <div class="website-name">${website.name}</div>
                    <div class="website-status ${website.status}">${website.status}</div>
                </div>
                <div class="website-domain">${website.domain}</div>
                <div class="website-stats">
                    <div class="stat">
                        <div class="stat-value">${website.total_sessions || 0}</div>
                        <div class="stat-label">Total Chats</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${website.active_sessions || 0}</div>
                        <div class="stat-label">Active</div>
                    </div>
                </div>
                <div class="website-actions">
                    <button class="btn btn-secondary" onclick="app.editWebsite(${website.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-secondary" onclick="app.deleteWebsite(${website.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderAgents() {
        const agentsTableBody = document.getElementById('agentsTableBody');
        if (!agentsTableBody) return;

        if (this.agents.length === 0) {
            agentsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-4">
                        <i class="fas fa-users" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <p style="color: var(--text-muted);">No agents found</p>
                    </td>
                </tr>
            `;
            return;
        }

        agentsTableBody.innerHTML = this.agents.map(agent => `
            <tr>
                <td>
                    <div class="agent-name">
                        <div class="agent-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div>${agent.name}</div>
                    </div>
                </td>
                <td>${agent.email}</td>
                <td>
                    <div class="agent-status">
                        <span class="status-indicator ${agent.status}"></span>
                        ${agent.status}
                    </div>
                </td>
                <td>${agent.current_chats || 0} / ${agent.max_concurrent_chats || 5}</td>
                <td>${agent.last_active ? this.formatTime(agent.last_active) : 'Never'}</td>
                <td>
                    <button class="btn btn-secondary" onclick="app.editAgent(${agent.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="app.deleteAgent(${agent.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    selectChat(chatId) {
        console.log('Selecting chat with ID:', chatId);
        console.log('Available chats:', this.chats);
        
        const chat = this.chats.find(c => c.id === chatId);
        console.log('Found chat:', chat);
        
        if (!chat) {
            console.error('Chat not found with ID:', chatId);
            return;
        }

        this.currentChat = chat;
        console.log('Set currentChat to:', this.currentChat);
        
        // Also set the currentChat in chatManager
        if (window.chatManager) {
            window.chatManager.currentChat = chat;
            console.log('Set chatManager.currentChat to:', chat);
        }
        
        // Update active chat item
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-chat-id="${chatId}"]`).classList.add('active');

        // Show chat interface
        this.showChatInterface(chat);
        
        // Auto-assign chat to logged-in agent if it's waiting
        if (chat.status === 'waiting' && this.currentUser?.id) {
            console.log('Auto-assigning waiting chat to agent:', this.currentUser.id);
            this.assignCurrentChat(chat);
        }
    }

    showChatInterface(chat) {
        // Use chatManager to handle the chat interface
        if (window.chatManager) {
            window.chatManager.selectChat(chat);
        } else {
            // Fallback if chatManager is not available
            const chatHeader = document.getElementById('chatHeader');
            const chatMessages = document.getElementById('chatMessages');
            const chatInputContainer = document.getElementById('chatInputContainer');

            // Update chat header
            document.getElementById('customerName').textContent = chat.customer_name || 'Unknown Customer';
            document.getElementById('customerEmail').textContent = chat.customer_email || 'No email';
            document.getElementById('chatTopic').textContent = chat.topic || 'General';
            document.getElementById('chatStatus').textContent = chat.status;

            // Show chat interface
            chatHeader.style.display = 'flex';
            chatInputContainer.style.display = 'block';

            // Load chat messages
            this.loadChatMessages(chat.session_id || chat.id);

            // Setup chat actions
            this.setupChatActions(chat.id);
        }
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
                this.renderMessages(data.messages || []);
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="no-chat-selected">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Start the conversation</p>
                </div>
            `;
            return;
        }

        chatMessages.innerHTML = messages.map(message => `
            <div class="message ${message.sender_type === 'agent' ? 'agent' : 'customer'}">
                <div class="message-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="message-content">
                    <div class="message-text">${message.content}</div>
                    <div class="message-time">${this.formatTime(message.created_at)}</div>
                </div>
            </div>
        `).join('');

        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    setupChatActions(chatId) {
        const closeBtn = document.getElementById('closeChatBtn');
        const deleteBtn = document.getElementById('deleteChatBtn');
        const sendBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('messageInput');

        if (closeBtn) {
            closeBtn.onclick = () => this.closeChat(chatId);
        }

        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteChat(chatId);
        }

        if (sendBtn && messageInput) {
            sendBtn.onclick = () => this.sendMessage(chatId);
            messageInput.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage(chatId);
                }
            };
        }
    }

    async sendMessage(chatId) {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message) return;

        try {
            const response = await fetch(`${this.apiBase}/api/chats/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    session_id: chatId,
                    message: message,
                    sender_type: 'agent'
                })
            });

            if (response.ok) {
                messageInput.value = '';
                // Reload messages
                this.loadChatMessages(chatId);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    async closeChat(chatId) {
        if (!confirm('Are you sure you want to close this chat?')) return;

        try {
            // Use the same delete endpoint but just update status instead of deleting
            console.log('🔄 Attempting to close chat with ID:', chatId);
            console.log('🔄 API Base URL:', this.apiBase);
            console.log('🔄 Full URL:', `${this.apiBase}/api/chats/close-session`);
            
            const response = await fetch(`${this.apiBase}/api/chats/close-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ session_id: chatId })
            });

            console.log('🔄 Response status:', response.status);
            console.log('🔄 Response ok:', response.ok);

            if (response.ok) {
                this.loadChats();
                this.hideChatInterface();
                this.showSuccess('Chat closed successfully');
            } else if (response.status === 401) {
                // Token expired, redirect to login
                localStorage.removeItem('token');
                window.location.href = '/login.html';
            } else {
                const errorData = await response.json();
                console.log('🔄 Error data:', errorData);
                this.showError(errorData.error || 'Failed to close chat');
            }
        } catch (error) {
            console.error('Failed to close chat:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async deleteChat(chatId) {
        if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) return;

        try {
            const response = await fetch(`${this.apiBase}/api/chats/delete`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ session_id: chatId })
            });

            if (response.ok) {
                this.loadChats();
                this.hideChatInterface();
            }
        } catch (error) {
            console.error('Failed to delete chat:', error);
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
    }

    updateActiveChatsCount() {
        const activeCount = this.chats.filter(chat => chat.status === 'active' || chat.status === 'waiting').length;
        const badge = document.getElementById('activeChatsCount');
        if (badge) {
            badge.textContent = activeCount;
        }
    }

    async initializeSocket() {
        console.log('🔌 Initializing Socket.io connection...');
        console.log('🌐 Current URL:', window.location.origin);
        
        // First, test if Socket.io endpoint is accessible
        try {
            const testResponse = await fetch(`${this.apiBase}/socket.io-test`);
            if (testResponse.ok) {
                const testData = await testResponse.json();
                console.log('✅ Socket.io server test successful:', testData);
            } else {
                console.error('❌ Socket.io server test failed:', testResponse.status);
            }
        } catch (error) {
            console.error('❌ Socket.io server test error:', error);
        }
        
        this.socket = io({
            transports: ['polling', 'websocket'],
            timeout: 20000,
            forceNew: true,
            upgrade: true,
            rememberUpgrade: false
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Connected to server with socket ID:', this.socket.id);
            console.log('🔗 Socket transport:', this.socket.io.engine.transport.name);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('❌ Disconnected from server. Reason:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
            console.error('❌ Error details:', {
                message: error.message,
                description: error.description,
                context: error.context,
                type: error.type
            });
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('🔄 Reconnection error:', error);
        });

        this.socket.on('new_message', (data) => {
            if (this.currentChat && this.currentChat.id === data.session_id) {
                this.loadChatMessages(data.session_id);
            }
            this.loadChats();
        });

        this.socket.on('chat_status_changed', (data) => {
            this.loadChats();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    logout() {
        localStorage.removeItem('token');
        this.currentUser = null;
        this.currentChat = null;
        this.showLoginPage();
        
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    formatTime(timestamp) {
        if (!timestamp) return 'Unknown';
        
        const date = new Date(timestamp);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
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

    // Assign current chat to logged-in agent
    async assignCurrentChat(chat) {
        if (!chat || !this.currentUser?.id) return;

        try {
            console.log('Assigning chat to agent:', this.currentUser.id);
            const response = await fetch(`${this.apiBase}/api/chats/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ 
                    session_id: chat.session_id || chat.id,
                    agent_id: this.currentUser.id
                })
            });

            if (response.ok) {
                console.log('Chat assigned successfully');
                // Update chat status locally
                chat.status = 'active';
                this.updateChatHeader(chat);
                
                // Send welcome message
                this.sendWelcomeMessage(chat);
                
                // Refresh chats list
                this.loadChats();
            } else {
                const errorData = await response.json();
                console.error('Failed to assign chat:', errorData);
            }
        } catch (error) {
            console.error('Failed to assign chat:', error);
        }
    }

    // Send welcome message to user
    async sendWelcomeMessage(chat) {
        const welcomeMessage = `You are now connected with ${this.currentUser.name}! How can I help you?`;
        
        try {
            const response = await fetch(`${this.apiBase}/api/chats/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    session_id: chat.session_id || chat.id,
                    message: welcomeMessage,
                    sender_type: 'agent'
                })
            });

            if (response.ok) {
                console.log('Welcome message sent');
                // Add message to UI immediately
                this.addMessageToUI({
                    content: welcomeMessage,
                    sender_type: 'agent',
                    created_at: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('Failed to send welcome message:', error);
        }
    }

    // Add message to UI
    addMessageToUI(message) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender_type}`;
        messageElement.innerHTML = `
            <div class="message-content">${message.content}</div>
            <div class="message-time">${this.formatTime(message.created_at)}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Update chat header with current status
    updateChatHeader(chat) {
        const chatStatus = document.getElementById('chatStatus');
        if (chatStatus) {
            chatStatus.textContent = chat.status;
            chatStatus.className = `chat-status ${chat.status}`;
        }
    }

    // These methods are handled by their respective managers
    editWebsite(id) {
        if (window.websitesManager) {
            window.websitesManager.editWebsite(id);
        }
    }

    deleteWebsite(id) {
        if (window.websitesManager) {
            window.websitesManager.deleteWebsite(id);
        }
    }

    editAgent(id) {
        if (window.agentsManager) {
            window.agentsManager.editAgent(id);
        }
    }

    deleteAgent(id) {
        if (window.agentsManager) {
            window.agentsManager.deleteAgent(id);
        }
    }

    setupSocket(socket) {
        this.socket = socket;

        // Handle agent status updates
        this.socket.on('agent-status-changed', (data) => {
            console.log('Agent status changed:', data);
            // Update agent status in UI if needed
            if (window.agentsManager) {
                window.agentsManager.loadAgents();
            }
        });

        // Handle new chat notifications
        this.socket.on('new-chat-available', (data) => {
            console.log('🔔 NEW CHAT AVAILABLE EVENT RECEIVED:', data);
            
            // Show browser notification
            if (window.notificationService) {
                console.log('📱 Showing browser notification...');
                window.notificationService.showNewChatNotification(data);
            } else {
                console.error('❌ Notification service not available');
            }
            
            // Update notification count
            this.updateNotificationCount();
        });

        // Handle chat status updates
        this.socket.on('chat-status-updated', (data) => {
            console.log('Chat status updated:', data);
            // Refresh chats list
            this.loadChats();
        });

        // Handle new offline message notifications
        this.socket.on('new-offline-message', (data) => {
            console.log('🔔 NEW OFFLINE MESSAGE EVENT RECEIVED:', data);
            
            // Show browser notification
            if (window.notificationService) {
                console.log('📱 Showing offline message notification...');
                window.notificationService.showOfflineMessageNotification(data);
            } else {
                console.error('❌ Notification service not available');
            }
            
            // Update unread count
            if (window.app && window.app.updateUnreadCount) {
                window.app.updateUnreadCount();
            }
            
            // Refresh messages list if we're on the messages section
            const messagesSection = document.getElementById('messagesSection');
            if (messagesSection && messagesSection.classList.contains('active')) {
                if (window.app && window.app.loadMessages) {
                    window.app.loadMessages();
                }
            }
        });
    }

    updateNotificationCount() {
        const notificationBadge = document.getElementById('notificationCount');
        if (notificationBadge) {
            const currentCount = parseInt(notificationBadge.textContent) || 0;
            notificationBadge.textContent = currentCount + 1;
        }
    }

    /**
     * Test notification system
     */
    testNotifications() {
        console.log('Testing notification system...');
        
        if (!window.notificationService) {
            console.error('Notification service not available');
            return;
        }

        // Initialize audio context first
        window.notificationService.initializeAudioContext();

        const status = window.notificationService.getStatus();
        console.log('Notification status:', status);

        if (!status.supported) {
            alert('This browser does not support notifications');
            return;
        }

        if (status.permission !== 'granted') {
            alert('Notification permission not granted. Please allow notifications and try again.');
            return;
        }

        // Test new chat notification
        console.log('Testing new chat notification...');
        window.notificationService.showNewChatNotification({
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            topic: 'Test Chat',
            sessionId: 'test-' + Date.now()
        });

        // Test new message notification after 2 seconds
        setTimeout(() => {
            console.log('Testing new message notification...');
            window.notificationService.showNewMessageNotification({
                customerName: 'Test Customer',
                message: 'This is a test message to verify notifications are working correctly!',
                sessionId: 'test-' + Date.now()
            });
        }, 2000);

        console.log('Notification tests completed!');
    }

    /**
     * Test server-side WebSocket notifications
     */
    async testServerNotifications() {
        console.log('Testing server-side WebSocket notifications...');
        
        try {
            const response = await fetch(`${this.apiBase}/api/chats/test-notifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('Server test response:', data);
                alert('Server notifications sent! Check for WebSocket events in console.');
            } else {
                const error = await response.json();
                console.error('Server test failed:', error);
                alert('Server test failed: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error testing server notifications:', error);
            alert('Error testing server notifications: ' + error.message);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChatDashboard();
    
    // Initialize Socket.io connection
    if (typeof io !== 'undefined') {
        const socket = io();
        
        // Set up socket for chat manager
        if (window.chatManager) {
            window.chatManager.setupSocket(socket);
        }
        
        // Set up socket for app
        window.app.setupSocket(socket);
        
        console.log('Socket.io connected:', socket.id);
    } else {
        console.error('Socket.io not loaded');
    }

    // ==================== MESSAGES SECTION ====================
    
    // Initialize messages section
    function initMessagesSection() {
        console.log('Initializing Messages section...');
        loadMessages();
        updateUnreadCount();
        
        // Set up event listeners
        document.getElementById('messageStatusFilter').addEventListener('change', loadMessages);
        document.getElementById('messagePriorityFilter').addEventListener('change', loadMessages);
        document.getElementById('backToListBtn').addEventListener('click', showMessagesList);
        document.getElementById('replyMessageBtn').addEventListener('click', showReplyForm);
        document.getElementById('closeMessageBtn').addEventListener('click', closeMessage);
        
        // Add delete button event listener with null check
        const deleteBtn = document.getElementById('deleteMessageBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', deleteMessage);
            console.log('✅ Delete button event listener attached');
        } else {
            console.error('❌ Delete button not found');
        }
        
        // Modal event listeners
        document.getElementById('closeReplyModal').addEventListener('click', hideReplyModal);
        document.getElementById('cancelReply').addEventListener('click', hideReplyModal);
        document.getElementById('sendReply').addEventListener('click', handleSendReply);
        
        // Close modal when clicking outside
        document.getElementById('replyModal').addEventListener('click', (e) => {
            if (e.target.id === 'replyModal') {
                hideReplyModal();
            }
        });
    }

    // Load messages from API
    async function loadMessages() {
        try {
            const status = document.getElementById('messageStatusFilter').value;
            const priority = document.getElementById('messagePriorityFilter').value;
            
            const response = await fetch(`/api/chats/offline-messages?status=${status}&priority=${priority}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            if (data.success) {
                displayMessages(data.data.messages);
                updateUnreadCount();
            } else {
                console.error('Failed to load messages:', data.error);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    // Display messages in the list
    function displayMessages(messages) {
        const messagesList = document.getElementById('messagesList');
        
        if (messages.length === 0) {
            messagesList.innerHTML = `
                <div class="no-messages">
                    <i class="fas fa-envelope-open"></i>
                    <h3>No offline messages</h3>
                    <p>When customers send messages while agents are offline, they'll appear here.</p>
                </div>
            `;
            return;
        }

        messagesList.innerHTML = messages.map(message => `
            <div class="message-item ${message.status}" data-message-id="${message.id}">
                <div class="message-header">
                    <div class="message-customer">
                        <h4>${message.customer_name}</h4>
                        <span class="message-email">${message.customer_email}</span>
                    </div>
                    <div class="message-meta">
                        <span class="message-status status-${message.status}">${message.status}</span>
                        <span class="message-priority priority-${message.priority}">${message.priority}</span>
                        <span class="message-time">${formatTime(message.created_at)}</span>
                    </div>
                </div>
                <div class="message-preview">
                    <p>${message.message.substring(0, 100)}${message.message.length > 100 ? '...' : ''}</p>
                </div>
                <div class="message-footer">
                    <span class="message-topic">${message.topic}</span>
                    <span class="message-website">${message.website_name}</span>
                    ${message.reply_count > 0 ? `<span class="reply-count">${message.reply_count} replies</span>` : ''}
                </div>
            </div>
        `).join('');

        // Add click listeners to message items
        document.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', () => {
                const messageId = item.dataset.messageId;
                showMessageDetail(messageId);
            });
        });
    }

    // Show message detail
    async function showMessageDetail(messageId) {
        try {
            const response = await fetch(`/api/chats/offline-messages/${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            if (data.success) {
                displayMessageDetail(data.data);
                document.getElementById('messagesList').style.display = 'none';
                document.getElementById('messageDetail').style.display = 'block';
            } else {
                console.error('Failed to load message detail:', data.error);
            }
        } catch (error) {
            console.error('Error loading message detail:', error);
        }
    }

    // Display message detail
    function displayMessageDetail(data) {
        const { message, replies } = data;
        const messageContent = document.getElementById('messageContent');
        
        // Store message ID for reply/close functions
        messageContent.dataset.messageId = message.id;
        
        messageContent.innerHTML = `
            <div class="message-detail-content">
                <div class="message-info">
                    <div class="customer-info">
                        <h3>${message.customer_name}</h3>
                        <p class="customer-email">${message.customer_email}</p>
                        ${message.customer_phone ? `<p class="customer-phone">${message.customer_phone}</p>` : ''}
                    </div>
                    <div class="message-meta">
                        <span class="status-badge status-${message.status}">${message.status}</span>
                        <span class="priority-badge priority-${message.priority}">${message.priority}</span>
                        <span class="topic-badge">${message.topic}</span>
                        <span class="website-badge">${message.website_name}</span>
                    </div>
                </div>
                
                <div class="original-message">
                    <h4>Original Message</h4>
                    <div class="message-text">${message.message}</div>
                    <div class="message-time">Received: ${formatDateTime(message.created_at)}</div>
                </div>
                
                <div class="replies-section">
                    <h4>Replies (${replies.length})</h4>
                    <div class="replies-list">
                        ${replies.length === 0 ? 
                            '<p class="no-replies">No replies yet</p>' :
                            replies.map(reply => `
                                <div class="reply-item ${reply.is_internal ? 'internal' : ''}">
                                    <div class="reply-header">
                                        <span class="reply-agent">${reply.agent_name}</span>
                                        <span class="reply-time">${formatDateTime(reply.created_at)}</span>
                                        ${reply.is_internal ? '<span class="internal-note">Internal Note</span>' : ''}
                                    </div>
                                    <div class="reply-content">${reply.reply_message}</div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            </div>
        `;
    }

    // Show messages list
    function showMessagesList() {
        document.getElementById('messagesList').style.display = 'block';
        document.getElementById('messageDetail').style.display = 'none';
    }

    // Show reply form
    function showReplyForm() {
        const messageId = getCurrentMessageId();
        if (!messageId) {
            console.error('No message selected for reply');
            return;
        }

        // Get current message data to populate the modal
        const messageContent = document.getElementById('messageContent');
        const customerName = messageContent.querySelector('.customer-info h3')?.textContent || 'Customer';
        const customerEmail = messageContent.querySelector('.customer-email')?.textContent || 'customer@example.com';

        // Populate modal with customer info
        document.getElementById('replyCustomerName').textContent = customerName;
        document.getElementById('replyCustomerEmail').textContent = customerEmail;
        document.getElementById('replyMessage').value = '';
        document.getElementById('isInternalReply').checked = false;

        // Show modal
        document.getElementById('replyModal').style.display = 'flex';
        document.getElementById('replyMessage').focus();
    }

    // Close message
    async function closeMessage() {
        const messageId = getCurrentMessageId();
        if (!messageId) {
            console.error('No message selected to close');
            return;
        }

        if (confirm('Are you sure you want to close this message?')) {
            await updateMessageStatus(messageId, 'closed');
        }
    }

    // Delete message
    async function deleteMessage() {
        console.log('🗑️ Delete message function called');
        const messageId = getCurrentMessageId();
        console.log('Message ID:', messageId);
        if (!messageId) {
            console.error('No message selected to delete');
            return;
        }

        if (confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/chats/offline-messages/${messageId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (response.ok) {
                    alert('Message deleted successfully');
                    showMessagesList(); // Go back to messages list
                    loadMessages(); // Refresh the list
                    updateUnreadCount(); // Update unread count
                } else {
                    const error = await response.json();
                    alert(`Failed to delete message: ${error.error || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error deleting message:', error);
                alert('Failed to delete message. Please try again.');
            }
        }
    }

    // Get current message ID from the detail view
    function getCurrentMessageId() {
        const messageDetail = document.getElementById('messageDetail');
        if (messageDetail && messageDetail.style.display !== 'none') {
            // Try to get message ID from the current message data
            const messageContent = document.getElementById('messageContent');
            if (messageContent && messageContent.dataset.messageId) {
                return messageContent.dataset.messageId;
            }
        }
        return null;
    }

    // Hide reply modal
    function hideReplyModal() {
        document.getElementById('replyModal').style.display = 'none';
        document.getElementById('replyMessage').value = '';
        document.getElementById('isInternalReply').checked = false;
    }

    // Handle send reply from modal
    async function handleSendReply() {
        const messageId = getCurrentMessageId();
        const replyText = document.getElementById('replyMessage').value.trim();
        const isInternal = document.getElementById('isInternalReply').checked;

        if (!replyText) {
            alert('Please enter a reply message');
            return;
        }

        // Disable send button to prevent double submission
        const sendBtn = document.getElementById('sendReply');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        try {
            await sendReply(messageId, replyText, isInternal);
            hideReplyModal();
        } catch (error) {
            console.error('Error sending reply:', error);
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Reply';
        }
    }

    // Send reply to message
    async function sendReply(messageId, replyText, isInternal = false) {
        try {
            const response = await fetch(`/api/chats/offline-messages/${messageId}/reply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    reply_message: replyText,
                    reply_type: 'text',
                    is_internal: isInternal
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('Reply sent successfully!');
                // Refresh the message detail view
                showMessageDetail(messageId);
                // Refresh the messages list
                loadMessages();
            } else {
                alert('Failed to send reply: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            alert('Error sending reply: ' + error.message);
        }
    }

    // Update message status
    async function updateMessageStatus(messageId, status) {
        try {
            const response = await fetch(`/api/chats/offline-messages/${messageId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    status: status,
                    assigned_agent_id: getCurrentAgentId()
                })
            });

            const data = await response.json();

            if (data.success) {
                alert(`Message ${status} successfully!`);
                // Refresh the message detail view
                showMessageDetail(messageId);
                // Refresh the messages list
                loadMessages();
            } else {
                alert('Failed to update message status: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error updating message status:', error);
            alert('Error updating message status: ' + error.message);
        }
    }

    // Get current agent ID
    function getCurrentAgentId() {
        // Try to get from window.app.currentUser
        if (window.app && window.app.currentUser) {
            return window.app.currentUser.id;
        }
        
        // Fallback - try to get from localStorage
        const userData = localStorage.getItem('userData');
        if (userData) {
            try {
                const user = JSON.parse(userData);
                return user.agentId || user.id;
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        
        // Final fallback
        console.error('Could not get agent ID');
        return 1; // Default agent ID
    }

    // Update unread count
    async function updateUnreadCount() {
        try {
            const response = await fetch('/api/chats/offline-messages/unread/count', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            if (data.success) {
                const badge = document.getElementById('unreadMessagesCount');
                badge.textContent = data.data.count;
                badge.style.display = data.data.count > 0 ? 'block' : 'none';
            }
        } catch (error) {
            console.error('Error updating unread count:', error);
        }
    }

    // Format time for display
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    // Format date and time for display
    function formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // Add messages section to the app object
    window.app.initMessagesSection = initMessagesSection;
    window.app.loadMessages = loadMessages;
    window.app.updateUnreadCount = updateUnreadCount;
});
