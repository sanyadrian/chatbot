const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const router = express.Router();

// Get all agents (specific route before parameterized route)
router.get('/list', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, 
        name, 
        email, 
        status, 
        max_concurrent_chats,
        current_chats,
        last_active,
        created_at,
        (SELECT COUNT(*) FROM chat_sessions WHERE agent_id = a.id) as total_sessions,
        (SELECT COUNT(*) FROM chat_sessions WHERE agent_id = a.id AND status = 'active') as active_sessions
      FROM agents a 
      ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      agents: result.rows
    });

  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all agents (root route)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, 
        name, 
        email, 
        status, 
        max_concurrent_chats,
        current_chats,
        last_active,
        created_at,
        (SELECT COUNT(*) FROM chat_sessions WHERE agent_id = a.id) as total_sessions,
        (SELECT COUNT(*) FROM chat_sessions WHERE agent_id = a.id AND status = 'active') as active_sessions
      FROM agents a 
      ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      agents: result.rows
    });

  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get agent by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        id, 
        name, 
        email, 
        status, 
        max_concurrent_chats,
        current_chats,
        last_active,
        created_at,
        (SELECT COUNT(*) FROM chat_sessions WHERE agent_id = $1) as total_sessions,
        (SELECT COUNT(*) FROM chat_sessions WHERE agent_id = $1 AND status = 'active') as active_sessions
      FROM agents 
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      agent: result.rows[0]
    });

  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new agent
router.post('/', async (req, res) => {
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
      'INSERT INTO agents (name, email, password_hash, max_concurrent_chats) VALUES ($1, $2, $3, $4) RETURNING id, name, email, status, max_concurrent_chats, created_at',
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
        status: newAgent.status,
        maxConcurrentChats: newAgent.max_concurrent_chats,
        createdAt: newAgent.created_at
      }
    });

  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update agent
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, maxConcurrentChats, status } = req.body;

    // Check if agent exists
    const existingAgent = await query(
      'SELECT id FROM agents WHERE id = $1',
      [id]
    );

    if (existingAgent.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email) {
      const emailCheck = await query(
        'SELECT id FROM agents WHERE email = $1 AND id != $2',
        [email, id]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already taken by another agent' });
      }
    }

    const result = await query(
      'UPDATE agents SET name = $1, email = $2, max_concurrent_chats = $3, status = $4, updated_at = NOW() WHERE id = $5 RETURNING id, name, email, status, max_concurrent_chats',
      [name, email, maxConcurrentChats, status, id]
    );

    res.json({
      success: true,
      message: 'Agent updated successfully',
      agent: result.rows[0]
    });

  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change agent password
router.post('/:id/change-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    const result = await query(
      'UPDATE agents SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email',
      [passwordHash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get agent statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const result = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_sessions,
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '${days} days' THEN 1 END) as sessions_last_${days}_days,
        AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))/60) as avg_session_duration_minutes
      FROM chat_sessions 
      WHERE agent_id = $1`,
      [id]
    );

    // Get daily session counts for the last 30 days
    const dailyStats = await query(
      `SELECT 
        DATE(started_at) as date,
        COUNT(*) as sessions
      FROM chat_sessions 
      WHERE agent_id = $1 AND started_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(started_at)
      ORDER BY date ASC`,
      [id]
    );

    res.json({
      success: true,
      stats: result.rows[0],
      dailyStats: dailyStats.rows
    });

  } catch (error) {
    console.error('Get agent stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete agent
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if agent has active sessions
    const activeSessions = await query(
      'SELECT COUNT(*) as count FROM chat_sessions WHERE agent_id = $1 AND status = $2',
      [id, 'active']
    );

    if (parseInt(activeSessions.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete agent with active chat sessions' 
      });
    }

    const result = await query(
      'DELETE FROM agents WHERE id = $1 RETURNING id, name, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({
      success: true,
      message: 'Agent deleted successfully',
      agent: result.rows[0]
    });

  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
