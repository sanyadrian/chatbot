class SurveysManager {
    constructor() {
        this.apiBase = window.location.origin;
        this.surveys = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.filters = {
            status: '',
            agent_id: '',
            date_from: '',
            date_to: ''
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSurveys();
        this.loadStats();
    }
    
    setupEventListeners() {
        // Filter change events
        document.getElementById('surveyStatusFilter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.currentPage = 1;
            this.loadSurveys();
        });
        
        document.getElementById('surveyAgentFilter')?.addEventListener('change', (e) => {
            this.filters.agent_id = e.target.value;
            this.currentPage = 1;
            this.loadSurveys();
        });
        
        document.getElementById('surveyDateFrom')?.addEventListener('change', (e) => {
            this.filters.date_from = e.target.value;
            this.currentPage = 1;
            this.loadSurveys();
        });
        
        document.getElementById('surveyDateTo')?.addEventListener('change', (e) => {
            this.filters.date_to = e.target.value;
            this.currentPage = 1;
            this.loadSurveys();
        });
    }
    
    async loadSurveys() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 20,
                ...this.filters
            });
            
            const response = await fetch(`${this.apiBase}/api/surveys/list?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load surveys');
            }
            
            const data = await response.json();
            this.surveys = data.surveys;
            this.totalPages = data.pagination.pages;
            
            this.renderSurveys();
            this.renderPagination();
            
        } catch (error) {
            console.error('Error loading surveys:', error);
            this.showError('Failed to load surveys');
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch(`${this.apiBase}/api/surveys/stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            
            const data = await response.json();
            this.renderStats(data.stats);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    renderSurveys() {
        const tbody = document.getElementById('surveysTableBody');
        
        if (this.surveys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No surveys found</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.surveys.map(survey => `
            <tr>
                <td>
                    <div class="customer-info">
                        <strong>${survey.customer_name || 'Anonymous'}</strong>
                        ${survey.customer_email ? `<br><small>${survey.customer_email}</small>` : ''}
                    </div>
                </td>
                <td>${survey.agent_name || 'N/A'}</td>
                <td>
                    <span class="status-badge ${survey.problem_solved ? 'solved' : 'not-solved'}">
                        ${survey.problem_solved ? '✅ Solved' : '❌ Not Solved'}
                    </span>
                </td>
                <td>
                    ${survey.rating ? this.renderStars(survey.rating) : 'N/A'}
                </td>
                <td>
                    ${survey.feedback ? 
                        `<div class="feedback-text" title="${survey.feedback}">${this.truncateText(survey.feedback, 50)}</div>` : 
                        'No feedback'
                    }
                </td>
                <td>${this.formatDate(survey.created_at)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="surveysManager.viewSurvey(${survey.id})" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    renderStats(stats) {
        document.getElementById('totalSurveys').textContent = stats.total_surveys;
        document.getElementById('satisfactionRate').textContent = `${stats.satisfaction_rate}%`;
        document.getElementById('averageRating').textContent = stats.average_rating;
    }
    
    renderStars(rating) {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(i <= rating ? '⭐' : '☆');
        }
        return stars.join('');
    }
    
    renderPagination() {
        const pagination = document.getElementById('surveysPagination');
        
        if (this.totalPages <= 1) {
            pagination.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination-controls">';
        
        // Previous button
        if (this.currentPage > 1) {
            html += `<button class="btn btn-sm btn-secondary" onclick="surveysManager.goToPage(${this.currentPage - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>`;
        }
        
        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="btn btn-sm ${i === this.currentPage ? 'btn-primary' : 'btn-secondary'}" 
                onclick="surveysManager.goToPage(${i})">${i}</button>`;
        }
        
        // Next button
        if (this.currentPage < this.totalPages) {
            html += `<button class="btn btn-sm btn-secondary" onclick="surveysManager.goToPage(${this.currentPage + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>`;
        }
        
        html += '</div>';
        pagination.innerHTML = html;
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.loadSurveys();
    }
    
    async viewSurvey(surveyId) {
        try {
            const response = await fetch(`${this.apiBase}/api/surveys/${surveyId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load survey details');
            }
            
            const data = await response.json();
            this.showSurveyModal(data.survey);
            
        } catch (error) {
            console.error('Error loading survey:', error);
            this.showError('Failed to load survey details');
        }
    }
    
    showSurveyModal(survey) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Survey Details</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="survey-details">
                        <div class="detail-row">
                            <label>Customer:</label>
                            <span>${survey.customer_name || 'Anonymous'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Email:</label>
                            <span>${survey.customer_email || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Agent:</label>
                            <span>${survey.agent_name || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Website:</label>
                            <span>${survey.website_name || 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Problem Solved:</label>
                            <span class="status-badge ${survey.problem_solved ? 'solved' : 'not-solved'}">
                                ${survey.problem_solved ? '✅ Yes' : '❌ No'}
                            </span>
                        </div>
                        <div class="detail-row">
                            <label>Rating:</label>
                            <span>${survey.rating ? this.renderStars(survey.rating) + ` (${survey.rating}/5)` : 'N/A'}</span>
                        </div>
                        <div class="detail-row">
                            <label>Feedback:</label>
                            <div class="feedback-content">${survey.feedback || 'No feedback provided'}</div>
                        </div>
                        <div class="detail-row">
                            <label>Date:</label>
                            <span>${this.formatDate(survey.created_at)}</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    async refreshSurveys() {
        await this.loadSurveys();
        await this.loadStats();
        this.showSuccess('Surveys refreshed');
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
    
    showSuccess(message) {
        // You can implement a toast notification here
        console.log('Success:', message);
    }
    
    showError(message) {
        // You can implement a toast notification here
        console.error('Error:', message);
        alert(message);
    }
}

// Initialize surveys manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.surveysManager = new SurveysManager();
});
