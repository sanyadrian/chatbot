const express = require('express');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../config/database');
const router = express.Router();

// Function to send message to WordPress plugin
async function sendMessageToWordPress(domain, sessionId, message, senderType) {
  try {
    const response = await fetch(`https://${domain}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action: 'ohsi_receive_agent_message',
        session_id: sessionId,
        message: message,
        sender_type: senderType,
        nonce: 'wordpress_nonce' // You might need to implement proper nonce handling
      })
    });

    if (!response.ok) {
      console.error('WordPress plugin response not ok:', response.status);
      return false;
    }

    const result = await response.json();
    console.log('Message sent to WordPress plugin:', result);
    return result.success;
  } catch (error) {
    console.error('Error sending message to WordPress:', error);
    return false;
  }
}

// Function to send assignment notification to WordPress plugin
async function sendAssignmentNotificationToWordPress(domain, sessionId, message) {
  try {
    const response = await fetch(`https://${domain}/wp-admin/admin-ajax.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        action: 'ohsi_receive_agent_message',
        session_id: sessionId,
        message: message,
        sender_type: 'system'
      })
    });

    if (!response.ok) {
      console.error('WordPress notification response not ok:', response.status);
      const errorText = await response.text();
      console.error('WordPress error response:', errorText);
      return false;
    }

    const result = await response.json();
    console.log('Notification sent to WordPress plugin:', result);
    return result.success;
  } catch (error) {
    console.error('Error sending notification to WordPress:', error);
    return false;
  }
}

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

    // Emit WebSocket event to notify agents about new chat
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      const eventData = {
        sessionId: session_id,
        customerName: customer_name || 'Unknown Customer',
        customerEmail: customer_email || 'No email',
        topic: topic || 'General inquiry',
        websiteId: website_id,
        websiteName: website.name,
        websiteDomain: website.domain,
        timestamp: new Date().toISOString()
      };
      
      console.log('🔔 EMITTING new-chat-available event:', eventData);
      io.emit('new-chat-available', eventData);
      console.log('✅ Successfully emitted new-chat-available event for session:', session_id);
    } else {
      console.error('❌ WebSocket not available - cannot emit new-chat-available event');
    }

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

// Debug route to test routing
router.get('/debug', (req, res) => {
  res.json({ message: 'Chat routes are working', timestamp: new Date().toISOString() });
});

// Test route to trigger WebSocket events
router.post('/test-notifications', (req, res) => {
  try {
    if (req.app && req.app.get('io')) {
      const io = req.app.get('io');
      
      // Test new chat notification
      io.emit('new-chat-available', {
        sessionId: 'test-' + Date.now(),
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        topic: 'Test Notification',
        websiteId: 1,
        websiteName: 'Test Website',
        websiteDomain: 'test.com',
        timestamp: new Date().toISOString()
      });

      // Test new message notification after 1 second
      setTimeout(() => {
        io.emit('new-customer-message', {
          sessionId: 'test-' + Date.now(),
          message: 'This is a test message from a customer',
          timestamp: new Date().toISOString()
        });
      }, 1000);

      res.json({ 
        success: true, 
        message: 'Test notifications sent',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ error: 'WebSocket not available' });
    }
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check assignment status for a specific session (WordPress plugin endpoint - no auth required)
router.get('/assignment/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    console.log('Assignment check for session:', sessionId);

    // Get session info
    const sessionResult = await query(
      `SELECT 
        cs.id,
        cs.session_id,
        cs.status,
        cs.agent_id,
        a.name as agent_name
      FROM chat_sessions cs
      LEFT JOIN agents a ON cs.agent_id = a.id
      WHERE cs.session_id = $1`,
      [sessionId]
    );

    console.log('Session query result:', sessionResult.rows);

    if (sessionResult.rows.length === 0) {
      console.log('Session not found:', sessionId);
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];
    const assigned = session.status === 'active' && session.agent_id;

    console.log('Assignment result:', {
      assigned,
      agent_name: session.agent_name,
      status: session.status,
      agent_id: session.agent_id
    });

    res.json({
      success: true,
      data: {
        assigned: assigned,
        agent_name: session.agent_name || null,
        status: session.status,
        agent_id: session.agent_id
      }
    });

  } catch (error) {
    console.error('Check assignment error:', error);
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

    // Send assignment notification to WordPress plugin
    try {
      // Get website info for this session
      const websiteResult = await query(
        'SELECT w.domain FROM chat_sessions cs JOIN websites w ON cs.website_id = w.id WHERE cs.session_id = $1',
        [sessionId]
      );
      
      if (websiteResult.rows.length > 0) {
        const website = websiteResult.rows[0];
        await sendAssignmentNotificationToWordPress(website.domain, sessionId, `Connected with agent: ${agent.name}`);
      }
    } catch (error) {
      console.error('Failed to send assignment notification to WordPress:', error);
    }

    res.json({
      success: true,
      message: 'Agent assigned successfully'
    });

  } catch (error) {
    console.error('Assign agent error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get messages for a session (WordPress plugin endpoint - no auth required)
router.get('/messages', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Verify session exists
    const sessionResult = await query(
      'SELECT id FROM chat_sessions WHERE session_id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get messages
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
      [session_id]
    );

    res.json({
      success: true,
      messages: messagesResult.rows
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message from WordPress plugin (no auth required)
router.post('/message', async (req, res) => {
  try {
    const { session_id, message, sender_type = 'agent' } = req.body;

    if (!session_id || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    // Verify session exists
    const sessionResult = await query(
      'SELECT id, agent_id, status FROM chat_sessions WHERE session_id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Insert message
    const messageResult = await query(
      'INSERT INTO messages (session_id, sender_type, sender_id, content, message_type) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at',
      [session_id, sender_type, session.agent_id || null, message, 'text']
    );

    // Update session last activity
    await query(
      'UPDATE chat_sessions SET last_activity = NOW() WHERE session_id = $1',
      [session_id]
    );

    const messageData = {
      id: messageResult.rows[0].id,
      content: message,
      sender_type: sender_type,
      created_at: messageResult.rows[0].created_at
    };

    // Emit socket event for real-time updates
    if (req.app && req.app.get('io')) {
      req.app.get('io').emit('new-message', {
        session_id: session_id,
        message: messageData
      });

      // Emit customer message notification for agents
      if (sender_type === 'user' || sender_type === 'customer') {
        req.app.get('io').emit('new-customer-message', {
          sessionId: session_id,
          message: message,
          timestamp: messageData.created_at
        });
        console.log('Emitted new-customer-message event for session:', session_id);
      }
    }

    // Send message to WordPress plugin if it's from an agent
    // Temporarily disabled due to nonce validation issues
    // The WordPress plugin will poll for messages instead
    /*
    if (sender_type === 'agent') {
      try {
        // Get website info for this session
        const websiteResult = await query(
          'SELECT w.domain, w.api_key FROM chat_sessions cs JOIN websites w ON cs.website_id = w.id WHERE cs.session_id = $1',
          [session_id]
        );
        
        if (websiteResult.rows.length > 0) {
          const website = websiteResult.rows[0];
          // Send message to WordPress plugin
          await sendMessageToWordPress(website.domain, session_id, message, sender_type);
        }
      } catch (error) {
        console.error('Failed to send message to WordPress:', error);
      }
    }
    */

    res.json({
      success: true,
      message: messageData
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send message (detailed endpoint)
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

    // Send notification to WordPress plugin
    try {
      // Get website info for this session
      const websiteResult = await query(
        'SELECT w.domain FROM chat_sessions cs JOIN websites w ON cs.website_id = w.id WHERE cs.session_id = $1',
        [sessionId]
      );
      
      console.log('Website query result for session', sessionId, ':', websiteResult.rows);
      
      if (websiteResult.rows.length > 0) {
        const website = websiteResult.rows[0];
        console.log('Sending chat closure notification to website:', website.domain);
        const result = await sendAssignmentNotificationToWordPress(website.domain, sessionId, 'Chat session closed by agent');
        console.log('Chat closure notification result:', result);
      } else {
        console.log('No website found for session:', sessionId);
      }
    } catch (error) {
      console.error('Failed to send chat closure notification to WordPress:', error);
    }

    res.json({
      success: true,
      message: 'Session closed successfully'
    });

  } catch (error) {
    console.error('Close session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get chat messages
router.get('/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await query(
      `SELECT 
        id,
        session_id,
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
      messages: result.rows
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign agent to chat
router.post('/assign', authenticateToken, async (req, res) => {
  try {
    const { session_id, agent_id } = req.body;

    if (!session_id || !agent_id) {
      return res.status(400).json({ error: 'Session ID and agent ID are required' });
    }

    await query(
      'UPDATE chat_sessions SET agent_id = $1, status = $2, last_activity = NOW() WHERE session_id = $3',
      [agent_id, 'active', session_id]
    );

    res.json({
      success: true,
      message: 'Agent assigned successfully'
    });

  } catch (error) {
    console.error('Assign agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete chat session
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    console.log('=== DELETE CHAT DEBUG ===');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    
    const { session_id } = req.body;
    console.log('Extracted session_id:', session_id);
    console.log('Session ID type:', typeof session_id);

    if (!session_id) {
      console.log('ERROR: No session_id provided');
      return res.status(400).json({ error: 'Session ID is required' });
    }

    // Check if session exists first
    console.log('Checking if session exists...');
    const sessionCheck = await query(
      'SELECT id, session_id FROM chat_sessions WHERE session_id = $1',
      [session_id]
    );
    
    console.log('Session check result:', sessionCheck.rows);

    if (sessionCheck.rows.length === 0) {
      console.log('ERROR: Session not found in database');
      return res.status(404).json({ error: 'Chat session not found' });
    }

    console.log('Session found, proceeding with deletion...');
    
    // Send closure notification BEFORE deleting the session
    try {
      // Get website info for this session
      const websiteResult = await query(
        'SELECT w.domain FROM chat_sessions cs JOIN websites w ON cs.website_id = w.id WHERE cs.session_id = $1',
        [session_id]
      );
      
      console.log('Website query result for session', session_id, ':', websiteResult.rows);
      
      if (websiteResult.rows.length > 0) {
        const website = websiteResult.rows[0];
        console.log('Sending chat closure notification to website:', website.domain);
        const result = await sendAssignmentNotificationToWordPress(website.domain, session_id, 'Chat session closed by agent');
        console.log('Chat closure notification result:', result);
      } else {
        console.log('No website found for session:', session_id);
      }
    } catch (error) {
      console.error('Failed to send chat closure notification to WordPress:', error);
    }
    
    await transaction(async (client) => {
      // Delete messages first
      console.log('Deleting messages...');
      const messagesResult = await client.query('DELETE FROM messages WHERE session_id = $1', [session_id]);
      console.log('Messages deleted:', messagesResult.rowCount);
      
      // Delete session
      console.log('Deleting session...');
      const sessionResult = await client.query('DELETE FROM chat_sessions WHERE session_id = $1', [session_id]);
      console.log('Session deleted:', sessionResult.rowCount);
    });

    console.log('Deletion completed successfully');
    res.json({
      success: true,
      message: 'Chat session deleted successfully'
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close chat session (alternative endpoint)
router.post('/close', authenticateToken, async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await query(
      'UPDATE chat_sessions SET status = $1, ended_at = NOW(), last_activity = NOW() WHERE session_id = $2',
      ['closed', session_id]
    );

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
