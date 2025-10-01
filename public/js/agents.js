// Agents Management Module
class AgentsManager {
    constructor() {
        this.apiBase = window.location.origin;
        this.agents = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add agent button
        const addBtn = document.getElementById('addAgentBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddAgentModal();
            });
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
                return this.agents;
            }
        } catch (error) {
            console.error('Failed to load agents:', error);
        }
        return [];
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
                        <button class="btn btn-primary mt-4" onclick="agentsManager.showAddAgentModal()">
                            <i class="fas fa-plus"></i>
                            Add Your First Agent
                        </button>
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
                        <div>${this.escapeHtml(agent.name)}</div>
                    </div>
                </td>
                <td>${this.escapeHtml(agent.email)}</td>
                <td>
                    <div class="agent-status">
                        <span class="status-indicator ${agent.status}"></span>
                        <span class="status-text">${agent.status}</span>
                        <button class="status-toggle" onclick="agentsManager.toggleAgentStatus(${agent.id})" title="Toggle Status">
                            <i class="fas fa-power-off"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div class="chat-count">
                        <span class="current">${agent.current_chats || 0}</span>
                        <span class="separator">/</span>
                        <span class="max">${agent.max_concurrent_chats || 5}</span>
                    </div>
                </td>
                <td>${agent.last_active ? this.formatTime(agent.last_active) : 'Never'}</td>
                <td>
                    <div class="agent-actions">
                        <button class="btn btn-secondary" onclick="agentsManager.editAgent(${agent.id})" title="Edit Agent">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="agentsManager.resetPassword(${agent.id})" title="Reset Password">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="btn btn-secondary" onclick="agentsManager.deleteAgent(${agent.id})" title="Delete Agent">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    showAddAgentModal() {
        const modal = this.createModal('Add Agent', this.getAddAgentForm());
        document.body.appendChild(modal);
        this.setupModalEvents(modal);
    }

    showEditAgentModal(agent) {
        const modal = this.createModal('Edit Agent', this.getEditAgentForm(agent));
        document.body.appendChild(modal);
        this.setupModalEvents(modal);
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        return modal;
    }

    getAddAgentForm() {
        return `
            <form id="agentForm">
                <div class="form-group">
                    <label for="agentName">Full Name</label>
                    <input type="text" id="agentName" name="name" required>
                </div>
                <div class="form-group">
                    <label for="agentEmail">Email</label>
                    <input type="email" id="agentEmail" name="email" required>
                </div>
                <div class="form-group">
                    <label for="agentPassword">Password</label>
                    <input type="password" id="agentPassword" name="password" required minlength="6">
                </div>
                <div class="form-group">
                    <label for="agentMaxChats">Max Concurrent Chats</label>
                    <input type="number" id="agentMaxChats" name="max_concurrent_chats" value="5" min="1" max="20">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Agent</button>
                </div>
            </form>
        `;
    }

    getEditAgentForm(agent) {
        return `
            <form id="agentForm">
                <input type="hidden" id="agentId" value="${agent.id}">
                <div class="form-group">
                    <label for="agentName">Full Name</label>
                    <input type="text" id="agentName" name="name" value="${this.escapeHtml(agent.name)}" required>
                </div>
                <div class="form-group">
                    <label for="agentEmail">Email</label>
                    <input type="email" id="agentEmail" name="email" value="${this.escapeHtml(agent.email)}" required>
                </div>
                <div class="form-group">
                    <label for="agentMaxChats">Max Concurrent Chats</label>
                    <input type="number" id="agentMaxChats" name="max_concurrent_chats" value="${agent.max_concurrent_chats || 5}" min="1" max="20">
                </div>
                <div class="form-group">
                    <label for="agentStatus">Status</label>
                    <select id="agentStatus" name="status">
                        <option value="online" ${agent.status === 'online' ? 'selected' : ''}>Online</option>
                        <option value="offline" ${agent.status === 'offline' ? 'selected' : ''}>Offline</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Agent</button>
                </div>
            </form>
        `;
    }

    setupModalEvents(modal) {
        const form = modal.querySelector('#agentForm');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAgentSubmit(modal);
        });

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    async handleAgentSubmit(modal) {
        const form = modal.querySelector('#agentForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const agentId = form.querySelector('#agentId')?.value;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            let response;
            if (agentId) {
                // Update existing agent
                response = await fetch(`${this.apiBase}/api/agents/${agentId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(data)
                });
            } else {
                // Create new agent
                response = await fetch(`${this.apiBase}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(data)
                });
            }

            if (response.ok) {
                modal.remove();
                this.loadAgents();
                this.showSuccess(agentId ? 'Agent updated successfully' : 'Agent added successfully');
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Failed to save agent');
            }
        } catch (error) {
            console.error('Agent save error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async editAgent(id) {
        const agent = this.agents.find(a => a.id === id);
        if (agent) {
            this.showEditAgentModal(agent);
        }
    }

    async toggleAgentStatus(id) {
        const agent = this.agents.find(a => a.id === id);
        if (!agent) return;

        const newStatus = agent.status === 'online' ? 'offline' : 'online';

        try {
            const response = await fetch(`${this.apiBase}/api/agents/${id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                this.loadAgents();
                this.showSuccess(`Agent ${newStatus === 'online' ? 'activated' : 'deactivated'} successfully`);
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Failed to update agent status');
            }
        } catch (error) {
            console.error('Agent status update error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async resetPassword(id) {
        const agent = this.agents.find(a => a.id === id);
        if (!agent) return;

        const newPassword = prompt(`Enter new password for ${agent.name}:`);
        if (!newPassword || newPassword.length < 6) {
            this.showError('Password must be at least 6 characters long');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/agents/${id}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ password: newPassword })
            });

            if (response.ok) {
                this.showSuccess('Password reset successfully');
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Failed to reset password');
            }
        } catch (error) {
            console.error('Password reset error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async deleteAgent(id) {
        const agent = this.agents.find(a => a.id === id);
        if (!agent) return;

        if (!confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/api/agents/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                this.loadAgents();
                this.showSuccess('Agent deleted successfully');
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Failed to delete agent');
            }
        } catch (error) {
            console.error('Agent delete error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    async toggleAgentStatus(id) {
        const agent = this.agents.find(a => a.id === id);
        if (!agent) return;

        const newStatus = agent.status === 'online' ? 'offline' : 'online';

        try {
            const response = await fetch(`${this.apiBase}/api/agents/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                // Update local agent status
                agent.status = newStatus;
                this.renderAgents();
                this.showSuccess(`Agent ${agent.name} is now ${newStatus}`);
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Failed to update agent status');
            }
        } catch (error) {
            console.error('Agent status toggle error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    escapeHtml(text) {
        if (!text) return '';
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

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
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

        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize agents manager
window.agentsManager = new AgentsManager();
