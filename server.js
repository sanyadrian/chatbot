const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chats');
const websiteRoutes = require('./routes/websites');
const agentRoutes = require('./routes/agents');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting - DISABLED for development
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // limit each IP to 1000 requests per windowMs
//   message: 'Too many requests from this IP, please try again later.'
// });

// Stricter rate limiting for auth endpoints - DISABLED for development
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 50, // limit each IP to 50 login attempts per windowMs
//   message: 'Too many login attempts from this IP, please try again later.'
// });

// app.use('/api/', limiter);
// app.use('/api/auth/login', authLimiter);

// Routes (before static files to avoid conflicts)
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/agents', agentRoutes);

// Serve static files (after API routes)
app.use(express.static('public'));

// Root endpoint - serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Central Chat Dashboard API',
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      chats: '/api/chats',
      websites: '/api/websites',
      agents: '/api/agents'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join agent to their room
  socket.on('agent-join', (agentId) => {
    socket.join(`agent-${agentId}`);
    console.log(`Agent ${agentId} joined their room`);
  });

  // Join chat session
  socket.on('join-chat', (sessionId) => {
    socket.join(`chat-${sessionId}`);
    console.log(`User joined chat session: ${sessionId}`);
  });

  // Handle new message
  socket.on('new-message', (data) => {
    const { sessionId, message, senderType, senderId } = data;
    
    // Broadcast to all users in this chat session
    io.to(`chat-${sessionId}`).emit('message-received', {
      sessionId,
      message,
      senderType,
      senderId,
      timestamp: new Date().toISOString()
    });

    // Notify agents about new customer message
    if (senderType === 'customer') {
      io.emit('new-customer-message', {
        sessionId,
        message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    socket.to(`chat-${data.sessionId}`).emit('user-typing', {
      sessionId: data.sessionId,
      userId: data.userId,
      isTyping: true
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`chat-${data.sessionId}`).emit('user-typing', {
      sessionId: data.sessionId,
      userId: data.userId,
      isTyping: false
    });
  });

  // Handle new chat session
  socket.on('new-chat-session', (data) => {
    const { sessionId, customerName, customerEmail, topic, websiteId } = data;
    
    // Notify all agents about new chat
    io.emit('new-chat-available', {
      sessionId,
      customerName,
      customerEmail,
      topic,
      websiteId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`New chat session created: ${sessionId} for ${customerName}`);
  });

  // Handle agent status updates
  socket.on('agent-status-update', (data) => {
    const { agentId, status } = data;
    
    // Broadcast agent status to all connected clients
    io.emit('agent-status-changed', {
      agentId,
      status,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Agent ${agentId} status changed to: ${status}`);
  });

  // Handle chat session status updates
  socket.on('chat-status-update', (data) => {
    const { sessionId, status, agentId } = data;
    
    // Broadcast to all users in this chat session
    io.to(`chat-${sessionId}`).emit('chat-status-changed', {
      sessionId,
      status,
      agentId,
      timestamp: new Date().toISOString()
    });
    
    // Notify all agents about status change
    io.emit('chat-status-updated', {
      sessionId,
      status,
      agentId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Chat ${sessionId} status changed to: ${status}`);
  });

  // Handle agent assignment
  socket.on('assign-agent', (data) => {
    const { sessionId, agentId } = data;
    
    // Join the agent to this specific chat
    socket.join(`chat-${sessionId}`);
    
    // Notify all users in this chat about agent assignment
    io.to(`chat-${sessionId}`).emit('agent-assigned', {
      sessionId,
      agentId,
      timestamp: new Date().toISOString()
    });
    
    console.log(`Agent ${agentId} assigned to chat ${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Central Chat Dashboard running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS origins: ${process.env.ALLOWED_ORIGINS || 'all'}`);
});

module.exports = { app, io };
