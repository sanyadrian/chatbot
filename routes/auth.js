const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const router = express.Router();

// Agent login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find agent by email
    const result = await query(
      'SELECT id, name, email, password_hash, status, max_concurrent_chats, current_chats FROM agents WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const agent = result.rows[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, agent.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update agent status to online
    await query(
      'UPDATE agents SET status = $1, last_active = NOW() WHERE id = $2',
      ['online', agent.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        agentId: agent.id, 
        email: agent.email,
        name: agent.name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        status: 'online',
        maxConcurrentChats: agent.max_concurrent_chats,
        currentChats: agent.current_chats
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Agent logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      // If JWT is invalid, we can't identify the agent, so just return success
      // The frontend will clear the token anyway
      return res.json({ success: true, message: 'Logged out successfully' });
    }
    
    // Update agent status to offline
    await query(
      'UPDATE agents SET status = $1 WHERE id = $2',
      ['offline', decoded.agentId]
    );

    res.json({ success: true, message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get agent details
    const result = await query(
      'SELECT id, name, email, status, max_concurrent_chats, current_chats FROM agents WHERE id = $1',
      [decoded.agentId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        status: agent.status,
        maxConcurrentChats: agent.max_concurrent_chats,
        currentChats: agent.current_chats
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Get current user profile (alias for /verify)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get agent details
    const result = await query(
      'SELECT id, name, email, status, max_concurrent_chats, current_chats FROM agents WHERE id = $1',
      [decoded.agentId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Agent not found' });
    }

    const agent = result.rows[0];

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        status: agent.status,
        maxConcurrentChats: agent.max_concurrent_chats,
        currentChats: agent.current_chats
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Register new agent (admin only)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, maxConcurrentChats = 5 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if agent already exists
    const existingAgent = await query(
      'SELECT id FROM agents WHERE email = $1',
      [email]
    );

    if (existingAgent.rows.length > 0) {
      return res.status(400).json({ error: 'Agent with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new agent
    const result = await query(
      'INSERT INTO agents (name, email, password_hash, max_concurrent_chats) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status',
      [name, email, passwordHash, maxConcurrentChats]
    );

    const newAgent = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        email: newAgent.email,
        status: newAgent.status
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
