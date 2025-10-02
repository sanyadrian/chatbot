/**
 * Notification Service for Central Chat Dashboard
 * Handles browser notifications, sound alerts, and visual indicators
 */

class NotificationService {
    constructor() {
        this.permission = 'default';
        this.soundEnabled = true;
        this.notificationCount = 0;
        this.isPageVisible = true;
        this.audioContext = null;
        this.audioContextResumed = false;
        
        this.initialize();
    }

    /**
     * Initialize the notification service
     */
    initialize() {
        console.log('Initializing Notification Service...');
        
        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return;
        }

        // Check current permission
        this.permission = Notification.permission;
        console.log('Current notification permission:', this.permission);

        // Request permission if not granted
        if (this.permission === 'default') {
            this.requestPermission();
        }

        // Listen for page visibility changes
        this.setupVisibilityListener();
        
        // Setup notification click handler
        this.setupNotificationClickHandler();
        
        // Setup audio context initialization
        this.setupAudioContext();
    }

    /**
     * Request notification permission from user
     */
    async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            console.log('Notification permission:', permission);
            
            if (permission === 'granted') {
                this.showWelcomeNotification();
            } else {
                console.warn('Notification permission denied');
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
    }

    /**
     * Show welcome notification when permission is granted
     */
    showWelcomeNotification() {
        this.showNotification(
            'Central Chat Dashboard',
            'You will now receive notifications for new chats and messages!',
            'success'
        );
    }

    /**
     * Show a browser notification
     */
    showNotification(title, message, type = 'info', options = {}) {
        // Don't show notifications if permission is not granted
        if (this.permission !== 'granted') {
            console.log('Cannot show notification - permission not granted');
            return;
        }

        // Don't show notifications if page is visible (optional behavior)
        if (this.isPageVisible && options.onlyWhenHidden !== false) {
            console.log('Page is visible, skipping notification');
            return;
        }

        const defaultOptions = {
            body: message,
            icon: '/favicon.ico', // You can add a custom icon
            badge: '/favicon.ico',
            tag: 'central-chat', // Prevents duplicate notifications
            requireInteraction: false,
            silent: false
        };

        const notificationOptions = { ...defaultOptions, ...options };

        try {
            const notification = new Notification(title, notificationOptions);
            
            // Auto-close after 5 seconds
            setTimeout(() => {
                notification.close();
            }, 5000);

            // Handle notification click
            notification.onclick = () => {
                window.focus();
                notification.close();
                
                // Emit custom event for handling click
                window.dispatchEvent(new CustomEvent('notification-clicked', {
                    detail: { title, message, type, options }
                }));
            };

            console.log('Notification shown:', title);
            return notification;
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }

    /**
     * Show notification for new chat
     */
    showNewChatNotification(chatData) {
        console.log('🔔 showNewChatNotification called with data:', chatData);
        const { customerName, customerEmail, topic, sessionId } = chatData;
        
        console.log('📱 Creating notification for:', customerName, customerEmail, topic);
        
        this.showNotification(
            'New Chat Available!',
            `${customerName} (${customerEmail}) - ${topic || 'General Inquiry'}`,
            'success',
            {
                requireInteraction: true,
                onlyWhenHidden: false // Always show for new chats
            }
        );

        // Play sound
        console.log('🔊 Playing notification sound...');
        this.playNotificationSound('new-chat');

        // Update visual indicators
        console.log('📊 Updating visual indicators...');
        this.updateNotificationCount();
        this.updatePageTitle('New Chat!');
        
        console.log('✅ New chat notification completed');
    }

    /**
     * Show notification for new message
     */
    showNewMessageNotification(messageData) {
        const { customerName, message, sessionId } = messageData;
        
        this.showNotification(
            `New Message from ${customerName}`,
            message.length > 100 ? message.substring(0, 100) + '...' : message,
            'info',
            {
                requireInteraction: false,
                onlyWhenHidden: false
            }
        );

        // Play sound
        this.playNotificationSound('new-message');

        // Update visual indicators
        this.updateNotificationCount();
    }

    /**
     * Setup audio context for sound notifications
     */
    setupAudioContext() {
        // Create audio context on first user interaction
        document.addEventListener('click', () => {
            if (!this.audioContext) {
                try {
                    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    console.log('Audio context created');
                } catch (error) {
                    console.error('Error creating audio context:', error);
                }
            }
            
            // Resume audio context if suspended
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume().then(() => {
                    this.audioContextResumed = true;
                    console.log('Audio context resumed');
                }).catch(error => {
                    console.error('Error resuming audio context:', error);
                });
            }
        }, { once: true });
    }

    /**
     * Play notification sound
     */
    playNotificationSound(type = 'default') {
        if (!this.soundEnabled) return;

        try {
            // Check if audio context is available and resumed
            if (!this.audioContext || this.audioContext.state === 'suspended') {
                console.log('Audio context not ready, attempting to resume...');
                if (this.audioContext) {
                    this.audioContext.resume().then(() => {
                        this.playNotificationSound(type);
                    }).catch(error => {
                        console.error('Error resuming audio context:', error);
                    });
                }
                return;
            }
            
            // Different sounds for different types
            const soundFrequencies = {
                'new-chat': [800, 1000, 1200], // Higher pitch for new chats
                'new-message': [400, 600], // Lower pitch for messages
                'default': [600, 800] // Default sound
            };

            const frequencies = soundFrequencies[type] || soundFrequencies.default;
            
            frequencies.forEach((freq, index) => {
                setTimeout(() => {
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                }, index * 100);
            });

            console.log('Notification sound played:', type);
        } catch (error) {
            console.error('Error playing notification sound:', error);
        }
    }

    /**
     * Update notification count badge
     */
    updateNotificationCount() {
        this.notificationCount++;
        
        const notificationBadge = document.getElementById('notificationCount');
        if (notificationBadge) {
            notificationBadge.textContent = this.notificationCount;
            notificationBadge.style.display = this.notificationCount > 0 ? 'block' : 'none';
        }

        // Also update the active chats count if it exists
        const activeChatsBadge = document.getElementById('activeChatsCount');
        if (activeChatsBadge) {
            const currentCount = parseInt(activeChatsBadge.textContent) || 0;
            activeChatsBadge.textContent = currentCount + 1;
        }
    }

    /**
     * Clear notification count
     */
    clearNotificationCount() {
        this.notificationCount = 0;
        
        const notificationBadge = document.getElementById('notificationCount');
        if (notificationBadge) {
            notificationBadge.textContent = '0';
            notificationBadge.style.display = 'none';
        }
    }

    /**
     * Update page title to show notifications
     */
    updatePageTitle(message = 'New Notification') {
        const originalTitle = document.title;
        
        // Add notification indicator to title
        if (!document.title.includes('●')) {
            document.title = `● ${originalTitle}`;
        }

        // Flash the title
        let flashCount = 0;
        const flashInterval = setInterval(() => {
            document.title = document.title.includes('●') ? originalTitle : `● ${originalTitle}`;
            flashCount++;
            
            if (flashCount >= 6) { // Flash 3 times
                clearInterval(flashInterval);
                document.title = `● ${originalTitle}`;
            }
        }, 500);
    }

    /**
     * Reset page title
     */
    resetPageTitle() {
        document.title = document.title.replace('● ', '');
    }

    /**
     * Setup page visibility listener
     */
    setupVisibilityListener() {
        document.addEventListener('visibilitychange', () => {
            this.isPageVisible = !document.hidden;
            
            if (this.isPageVisible) {
                // Page became visible, clear notifications
                this.clearNotificationCount();
                this.resetPageTitle();
            }
        });
    }

    /**
     * Setup notification click handler
     */
    setupNotificationClickHandler() {
        window.addEventListener('notification-clicked', (event) => {
            console.log('Notification clicked:', event.detail);
            
            // Clear notification count when user interacts
            this.clearNotificationCount();
            this.resetPageTitle();
            
            // Focus on the dashboard
            if (window.app) {
                window.app.showSection('chats');
            }
        });
    }

    /**
     * Toggle sound on/off
     */
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        console.log('Sound notifications:', this.soundEnabled ? 'enabled' : 'disabled');
        return this.soundEnabled;
    }

    /**
     * Check if notifications are supported and enabled
     */
    isSupported() {
        return 'Notification' in window && this.permission === 'granted';
    }

    /**
     * Manually initialize audio context (call this on user interaction)
     */
    initializeAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Audio context manually initialized');
            } catch (error) {
                console.error('Error creating audio context:', error);
            }
        }
        
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.audioContextResumed = true;
                console.log('Audio context manually resumed');
            }).catch(error => {
                console.error('Error resuming audio context:', error);
            });
        }
    }

    /**
     * Get current notification status
     */
    getStatus() {
        return {
            supported: 'Notification' in window,
            permission: this.permission,
            soundEnabled: this.soundEnabled,
            notificationCount: this.notificationCount,
            isPageVisible: this.isPageVisible,
            audioContextReady: this.audioContext && this.audioContext.state === 'running'
        };
    }
}

// Initialize notification service
window.notificationService = new NotificationService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
}
