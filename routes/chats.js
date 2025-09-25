const express = require('express');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.agent = decoded;
    next();
  });
};

// Start new chat session (called by plugin)
router.post('/start', async (req, res) => {
  try {
    const { 
      website_id, 
      session_id, 
      customer_name, 
      customer_email, 
      customer_phone,
      topic,
      customer_ip 
    } = req.body;

    if (!website_id || !session_id) {
      return res.status(400).json({ error: 'Website ID and session ID are required' });
    }

    // Verify website exists and is active
    const websiteResult = await query(
      'SELECT id, name, domain FROM websites WHERE id = $1 AND status = $2',
      [website_id, 'active']
    );

    if (websiteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Website not found or inactive' });
    }

    const website = websiteResult.rows[0];

    // Check if session already exists
    const existingSession = await query(
      'SELECT id FROM chat_sessions WHERE session_id = $1',
      [session_id]
    );

    if (existingSession.rows.length > 0) {
      return res.status(400).json({ error: 'Session already exists' });
    }

    // Create new chat session
    const result = await query(
      `INSERT INTO chat_sessions 
       (website_id, session_id, customer_name, customer_email, customer_phone, topic, customer_ip, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, session_id, status, started_at`,
      [website_id, session_id, customer_name, customer_email, customer_phone, topic, customer_ip, 'waiting']
    );

    const newSession = result.rows[0];

    // Add system message
    await query(
      'INSERT INTO messages (session_id, sender_type, content) VALUES ($1, $2, $3)',
      [session_id, 'system', `New chat session started. Topic: ${topic || 'General inquiry'}`]
    );

    res.status(201).json({
      success: true,
      session: {
        id: newSession.id,
        sessionId: newSession.session_id,
        status: newSession.status,
        startedAt: newSession.started_at,
        website: {
          id: website.id,
          name: website.name,
          domain: website.domain
        }
      }
    });

  } catch (error) {
    console.error('Start chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all chat sessions (for agent dashboard)
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const { status, website_id, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND cs.status = $${paramCount}`;
      params.push(status);
    }

    if (website_id) {
      paramCount++;
      whereClause += ` AND cs.website_id = $${paramCount}`;
      params.push(website_id);
    }

    const result = await query(
      `SELECT 
        cs.id,
        cs.session_id,
        cs.customer_name,
        cs.customer_email,
        cs.customer_phone,
        cs.status,
        cs.topic,
        cs.priority,
        cs.agent_id,
        cs.started_at,
        cs.last_activity,
        w.name as website_name,
        w.domain as website_domain,
        a.name as agent_name
      FROM chat_sessions cs
      LEFT JOIN websites w ON cs.website_id = w.id
      LEFT JOIN agents a ON cs.agent_id = a.id
      ${whereClause}
      ORDER BY cs.started_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      sessions: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      }
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get specific chat session with messages
router.get('/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session details
    const sessionResult = await query(
      `SELECT 
        cs.id,
        cs.session_id,
        cs.customer_name,
        cs.customer_email,
        cs.customer_phone,
        cs.status,
        cs.topic,
        cs.priority,
        cs.agent_id,
        cs.started_at,
        cs.last_activity,
        w.name as website_name,
        w.domain as website_domain,
        a.name as agent_name
      FROM chat_sessions cs
      LEFT JOIN websites w ON cs.website_id = w.id
      LEFT JOIN agents a ON cs.agent_id = a.id
      WHERE cs.session_id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get messages for this session
    const messagesResult = await query(
      `SELECT 
        id,
        sender_type,
        sender_id,
        content,
        message_type,
        metadata,
        created_at
      FROM messages 
      WHERE session_id = $1 
      ORDER BY created_at ASC`,
      [sessionId]
    );

    res.json({
      success: true,
      session: sessionResult.rows[0],
      messages: messagesResult.rows
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign agent to chat session
router.post('/sessions/:sessionId/assign', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: 'Agent ID is required' });
    }

    await transaction(async (client) => {
      // Check if agent exists and is available
      const agentResult = await client.query(
        'SELECT id, name, max_concurrent_chats, current_chats FROM agents WHERE id = $1 AND status = $2',
        [agentId, 'online']
      );

      if (agentResult.rows.length === 0) {
        throw new Error('Agent not found or offline');
      }

      const agent = agentResult.rows[0];
      if (agent.current_chats >= agent.max_concurrent_chats) {
        throw new Error('Agent has reached maximum concurrent chats');
      }

      // Update session with agent assignment
      await client.query(
        'UPDATE chat_sessions SET agent_id = $1, status = $2, last_activity = NOW() WHERE session_id = $3',
        [agentId, 'active', sessionId]
      );

      // Add assignment record
      await client.query(
        'INSERT INTO chat_assignments (session_id, agent_id, assignment_type) VALUES ($1, $2, $3)',
        [sessionId, agentId, 'manual']
      );

      // Add system message
      await client.query(
        'INSERT INTO messages (session_id, sender_type, content) VALUES ($1, $2, $3)',
        [sessionId, 'system', `Chat assigned to agent: ${agent.name}`]
      );
    });

    res.json({
      success: true,
      message: 'Agent assigned successfully'
    });

  } catch (error) {
    console.error('Assign agent error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Send message
router.post('/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, messageType = 'text', metadata } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify session exists and agent has access
    const sessionResult = await query(
      'SELECT id, agent_id, status FROM chat_sessions WHERE session_id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Add message
    const result = await query(
      'INSERT INTO messages (session_id, sender_type, sender_id, content, message_type, metadata) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at',
      [sessionId, 'agent', req.agent.agentId, content, messageType, metadata]
    );

    // Update session last activity
    await query(
      'UPDATE chat_sessions SET last_activity = NOW() WHERE session_id = $1',
      [sessionId]
    );

    const newMessage = result.rows[0];

    res.json({
      success: true,
      message: {
        id: newMessage.id,
        sessionId,
        senderType: 'agent',
        senderId: req.agent.agentId,
        content,
        messageType,
        metadata,
        createdAt: newMessage.created_at
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close chat session
router.post('/sessions/:sessionId/close', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await transaction(async (client) => {
      // Update session status
      await client.query(
        'UPDATE chat_sessions SET status = $1, ended_at = NOW(), last_activity = NOW() WHERE session_id = $2',
        ['closed', sessionId]
      );

      // Add system message
      await client.query(
        'INSERT INTO messages (session_id, sender_type, content) VALUES ($1, $2, $3)',
        [sessionId, 'system', 'Chat session closed by agent']
      );
    });

    res.json({
      success: true,
      message: 'Session closed successfully'
    });

  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
