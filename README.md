# Central Chat Dashboard

A centralized chat dashboard for managing live chat sessions from multiple websites.

## 🚀 Features

- **Multi-website support** - Handle chats from multiple websites
- **Real-time messaging** - WebSocket-based real-time communication
- **Agent management** - Add, edit, and manage agents
- **Session management** - Assign, close, and delete chat sessions
- **Analytics** - Track performance and usage statistics
- **RESTful API** - Easy integration with WordPress plugins

## 🏗️ Architecture

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **Socket.io** for real-time features
- **JWT** authentication
- **Rate limiting** and security

### Frontend (Coming Soon)
- **React** dashboard
- **Real-time updates**
- **Mobile responsive**

## 📦 Installation

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- AWS Lightsail account (recommended)

### 1. Clone and Install
```bash
git clone <repository-url>
cd central-chat-dashboard
npm install
```

### 2. Environment Setup
```bash
cp env.example .env
# Edit .env with your database credentials
```

### 3. Database Setup
```bash
# Connect to your PostgreSQL database
psql -h your-host -U your-username -d your-database

# Run the schema
\i database/schema.sql
```

### 4. Start the Server
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Configuration

### Environment Variables
```env
# Database
DB_HOST=your-lightsail-db-host
DB_PORT=5432
DB_NAME=chat_dashboard
DB_USER=your-db-username
DB_PASSWORD=your-db-password

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Server
PORT=3000
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://anotherdomain.com
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Agent login
- `POST /api/auth/logout` - Agent logout
- `GET /api/auth/verify` - Verify token
- `POST /api/auth/register` - Register new agent

### Chat Sessions
- `POST /api/chats/start` - Start new chat session
- `GET /api/chats/sessions` - Get all sessions
- `GET /api/chats/sessions/:id` - Get specific session
- `POST /api/chats/sessions/:id/assign` - Assign agent
- `POST /api/chats/sessions/:id/messages` - Send message
- `POST /api/chats/sessions/:id/close` - Close session

### Websites
- `POST /api/websites/register` - Register new website
- `GET /api/websites` - Get all websites
- `GET /api/websites/:id` - Get website details
- `PUT /api/websites/:id` - Update website
- `DELETE /api/websites/:id` - Delete website

### Agents
- `GET /api/agents` - Get all agents
- `POST /api/agents` - Create new agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent

## 🔌 Plugin Integration

### 1. Register Website
```javascript
// Register your website with the central dashboard
const response = await fetch('https://your-dashboard.com/api/websites/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Your Website Name',
    domain: 'yourdomain.com',
    contact_email: 'admin@yourdomain.com'
  })
});

const { website } = await response.json();
// Save website.apiKey for future requests
```

### 2. Start Chat Session
```javascript
// When customer starts a chat
const response = await fetch('https://your-dashboard.com/api/chats/start', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${website.apiKey}`
  },
  body: JSON.stringify({
    website_id: website.id,
    session_id: 'unique-session-id',
    customer_name: 'John Doe',
    customer_email: 'john@example.com',
    topic: 'Billing Support'
  })
});
```

### 3. Send Messages
```javascript
// Send customer message
const response = await fetch('https://your-dashboard.com/api/chats/sessions/session-id/messages', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${website.apiKey}`
  },
  body: JSON.stringify({
    content: 'Customer message here',
    sender_type: 'customer'
  })
});
```

## 🚀 Deployment on AWS Lightsail

### 1. Create Lightsail Instance
- Choose "Node.js" blueprint
- Select $10/month instance (1GB RAM)
- Configure networking (open ports 80, 443, 3000)

### 2. Create Database
- Add managed PostgreSQL database
- Note connection details

### 3. Deploy Application
```bash
# Connect to your Lightsail instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Clone and setup
git clone <your-repo>
cd central-chat-dashboard
npm install

# Setup environment
cp env.example .env
# Edit .env with your database credentials

# Setup database
psql -h your-db-host -U your-username -d your-database < database/schema.sql

# Start with PM2
npm install -g pm2
pm2 start server.js --name "chat-dashboard"
pm2 startup
pm2 save
```

### 4. Configure Domain
- Point your domain to Lightsail instance
- Setup SSL certificate
- Configure reverse proxy (nginx)

## 📊 Monitoring

### Health Check
```bash
curl https://your-dashboard.com/api/health
```

### Logs
```bash
pm2 logs chat-dashboard
```

## 🔒 Security

- **JWT authentication** for agents
- **API key authentication** for websites
- **Rate limiting** on all endpoints
- **CORS** configuration
- **Helmet** security headers
- **Input validation** and sanitization

## 🧪 Testing

```bash
# Run tests
npm test

# Test API endpoints
curl -X POST https://your-dashboard.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"password"}'
```

## 📈 Scaling

For high traffic:
- Upgrade Lightsail instance
- Add load balancer
- Use Redis for session storage
- Implement database clustering

## 🤝 Support

For issues and questions:
- Check the logs: `pm2 logs chat-dashboard`
- Monitor database connections
- Verify environment variables
- Test API endpoints with Postman

## 📝 License

MIT License - see LICENSE file for details.
