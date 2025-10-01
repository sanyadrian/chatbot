// Websites Management Module
class WebsitesManager {
    constructor() {
        this.apiBase = window.location.origin;
        this.websites = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Add website button
        const addBtn = document.getElementById('addWebsiteBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddWebsiteModal();
            });
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
                return this.websites;
            }
        } catch (error) {
            console.error('Failed to load websites:', error);
        }
        return [];
    }

    renderWebsites() {
        const websitesGrid = document.getElementById('websitesGrid');
        if (!websitesGrid) return;

        if (this.websites.length === 0) {
            websitesGrid.innerHTML = `
                <div class="text-center p-4">
                    <i class="fas fa-globe" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p style="color: var(--text-muted);">No websites registered</p>
                    <button class="btn btn-primary mt-4" onclick="websitesManager.showAddWebsiteModal()">
                        <i class="fas fa-plus"></i>
                        Add Your First Website
                    </button>
                </div>
            `;
            return;
        }

        websitesGrid.innerHTML = this.websites.map(website => `
            <div class="website-card">
                <div class="website-header">
                    <div class="website-name">${this.escapeHtml(website.name)}</div>
                    <div class="website-status ${website.status}">${website.status}</div>
                </div>
                <div class="website-domain">${this.escapeHtml(website.domain)}</div>
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
                    <button class="btn btn-secondary" onclick="websitesManager.editWebsite(${website.id})">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-secondary" onclick="websitesManager.showApiKey(${website.id})">
                        <i class="fas fa-key"></i>
                        API Key
                    </button>
                    <button class="btn btn-secondary" onclick="websitesManager.deleteWebsite(${website.id})" data-website-id="${website.id}">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    showAddWebsiteModal() {
        const modal = this.createModal('Add Website', this.getAddWebsiteForm());
        document.body.appendChild(modal);
        this.setupModalEvents(modal);
    }

    showEditWebsiteModal(website) {
        const modal = this.createModal('Edit Website', this.getEditWebsiteForm(website));
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

    getAddWebsiteForm() {
        return `
            <form id="websiteForm">
                <div class="form-group">
                    <label for="websiteName">Website Name</label>
                    <input type="text" id="websiteName" name="name" required>
                </div>
                <div class="form-group">
                    <label for="websiteDomain">Domain</label>
                    <input type="text" id="websiteDomain" name="domain" placeholder="example.com" required>
                </div>
                <div class="form-group">
                    <label for="websiteEmail">Contact Email (Optional)</label>
                    <input type="email" id="websiteEmail" name="contact_email">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Add Website</button>
                </div>
            </form>
        `;
    }

    getEditWebsiteForm(website) {
        return `
            <form id="websiteForm">
                <input type="hidden" id="websiteId" value="${website.id}">
                <div class="form-group">
                    <label for="websiteName">Website Name</label>
                    <input type="text" id="websiteName" name="name" value="${this.escapeHtml(website.name)}" required>
                </div>
                <div class="form-group">
                    <label for="websiteDomain">Domain</label>
                    <input type="text" id="websiteDomain" name="domain" value="${this.escapeHtml(website.domain)}" required>
                </div>
                <div class="form-group">
                    <label for="websiteEmail">Contact Email</label>
                    <input type="email" id="websiteEmail" name="contact_email" value="${this.escapeHtml(website.contact_email || '')}">
                </div>
                <div class="form-group">
                    <label for="websiteStatus">Status</label>
                    <select id="websiteStatus" name="status">
                        <option value="active" ${website.status === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${website.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary modal-cancel">Cancel</button>
                    <button type="submit" class="btn btn-primary">Update Website</button>
                </div>
            </form>
        `;
    }

    setupModalEvents(modal) {
        const form = modal.querySelector('#websiteForm');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = modal.querySelector('.modal-cancel');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleWebsiteSubmit(modal);
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.remove();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.remove();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    async handleWebsiteSubmit(modal) {
        const form = modal.querySelector('#websiteForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const websiteId = form.querySelector('#websiteId')?.value;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

        try {
            let response;
            if (websiteId) {
                // Update existing website
                response = await fetch(`${this.apiBase}/api/websites/${websiteId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(data)
                });
            } else {
                // Create new website
                response = await fetch(`${this.apiBase}/api/websites/register`, {
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
                this.loadWebsites();
                this.showSuccess(websiteId ? 'Website updated successfully' : 'Website added successfully');
            } else {
                const errorData = await response.json();
                this.showError(errorData.error || 'Failed to save website');
            }
        } catch (error) {
            console.error('Website save error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }

    async editWebsite(id) {
        const website = this.websites.find(w => w.id === id);
        if (website) {
            this.showEditWebsiteModal(website);
        }
    }

    async deleteWebsite(id) {
        console.log('deleteWebsite called with ID:', id);
        
        const website = this.websites.find(w => w.id === id);
        if (!website) {
            console.log('Website not found in local array');
            return;
        }

        console.log('Found website:', website);

        if (!confirm(`Are you sure you want to delete "${website.name}"? This action cannot be undone.`)) {
            console.log('User cancelled deletion');
            return;
        }

        try {
            console.log('Deleting website with ID:', id);
            console.log('API URL:', `${this.apiBase}/api/websites/${id}`);
            console.log('Token:', localStorage.getItem('token') ? 'exists' : 'missing');
            
            const response = await fetch(`${this.apiBase}/api/websites/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Delete response status:', response.status);
            console.log('Delete response headers:', response.headers);

            if (response.ok) {
                const result = await response.json();
                console.log('Delete successful:', result);
                this.loadWebsites();
                this.showSuccess('Website deleted successfully');
            } else {
                const errorData = await response.json();
                console.log('Delete error:', errorData);
                this.showError(errorData.error || 'Failed to delete website');
            }
        } catch (error) {
            console.error('Website delete error:', error);
            this.showError('Network error. Please try again.');
        }
    }

    showApiKey(id) {
        const website = this.websites.find(w => w.id === id);
        if (!website) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>API Key</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="api-key-display">
                        <p>Use this API key to integrate your website with the chat system:</p>
                        <div class="api-key-container">
                            <input type="text" value="${website.api_key}" readonly class="api-key-input">
                            <button class="btn btn-secondary" onclick="websitesManager.copyApiKey('${website.api_key}')">
                                <i class="fas fa-copy"></i>
                                Copy
                            </button>
                        </div>
                        <div class="api-key-info">
                            <h4>Integration Instructions:</h4>
                            <ol>
                                <li>Add this API key to your WordPress plugin settings</li>
                                <li>Configure the chat endpoint: <code>${this.apiBase}/api/chats/start</code></li>
                                <li>Test the integration by starting a chat from your website</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.setupModalEvents(modal);
    }

    copyApiKey(apiKey) {
        navigator.clipboard.writeText(apiKey).then(() => {
            this.showSuccess('API key copied to clipboard');
        }).catch(() => {
            this.showError('Failed to copy API key');
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

// Initialize websites manager
window.websitesManager = new WebsitesManager();
