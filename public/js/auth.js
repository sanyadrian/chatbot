// Authentication Module
class AuthManager {
    constructor() {
        this.apiBase = window.location.origin;
        this.setupLoginForm();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.querySelector('.login-btn');
        const btnText = loginBtn.querySelector('.btn-text');
        const btnLoader = loginBtn.querySelector('.btn-loader');
        const errorDiv = document.getElementById('loginError');

        // Show loading state
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
        errorDiv.style.display = 'none';

        try {
            const response = await fetch(`${this.apiBase}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Store token
                localStorage.setItem('token', data.token);
                
                // Update user info
                if (window.app) {
                    window.app.currentUser = data.agent;
                    window.app.showDashboard();
                    window.app.initializeSocket();
                    window.app.loadInitialData();
                }
            } else {
                // Show error
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        } finally {
            // Reset button state
            loginBtn.disabled = false;
            btnText.style.display = 'block';
            btnLoader.style.display = 'none';
        }
    }

    async registerAgent(agentData) {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(agentData)
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateProfile(profileData) {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(profileData)
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('Profile update error:', error);
            return { success: false, error: error.message };
        }
    }

    async changePassword(currentPassword, newPassword) {
        try {
            const response = await fetch(`${this.apiBase}/api/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();
            return { success: response.ok, data };
        } catch (error) {
            console.error('Password change error:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            await fetch(`${this.apiBase}/api/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            if (window.app) {
                window.app.logout();
            }
        }
    }

    isAuthenticated() {
        return !!localStorage.getItem('token');
    }

    getToken() {
        return localStorage.getItem('token');
    }

    getCurrentUser() {
        // This would typically be stored in a more secure way
        // For now, we'll get it from the app instance
        return window.app ? window.app.currentUser : null;
    }
}

// Initialize auth manager
window.authManager = new AuthManager();
