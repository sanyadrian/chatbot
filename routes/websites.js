const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const router = express.Router();

// Register new website (for plugin integration)
router.post('/register', async (req, res) => {
  try {
    const { name, domain, contact_email } = req.body;

    if (!name || !domain) {
      return res.status(400).json({ error: 'Name and domain are required' });
    }

    // Check if domain already exists
    const existingWebsite = await query(
      'SELECT id FROM websites WHERE domain = $1',
      [domain]
    );

    if (existingWebsite.rows.length > 0) {
      return res.status(400).json({ error: 'Website with this domain already registered' });
    }

    // Generate unique API key
    const apiKey = uuidv4();

    // Create new website
    const result = await query(
      'INSERT INTO websites (name, domain, api_key) VALUES ($1, $2, $3) RETURNING id, name, domain, api_key, created_at',
      [name, domain, apiKey]
    );

    const newWebsite = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Website registered successfully',
      website: {
        id: newWebsite.id,
        name: newWebsite.name,
        domain: newWebsite.domain,
        apiKey: newWebsite.api_key,
        createdAt: newWebsite.created_at
      }
    });

  } catch (error) {
    console.error('Register website error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all websites
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        id, 
        name, 
        domain, 
        status, 
        created_at,
        (SELECT COUNT(*) FROM chat_sessions WHERE website_id = w.id) as total_sessions,
        (SELECT COUNT(*) FROM chat_sessions WHERE website_id = w.id AND status = 'active') as active_sessions
      FROM websites w 
      ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      websites: result.rows
    });

  } catch (error) {
    console.error('Get websites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        id, 
        name, 
        domain, 
        status, 
        created_at,
        (SELECT COUNT(*) FROM chat_sessions WHERE website_id = $1) as total_sessions,
        (SELECT COUNT(*) FROM chat_sessions WHERE website_id = $1 AND status = 'active') as active_sessions,
        (SELECT COUNT(*) FROM chat_sessions WHERE website_id = $1 AND status = 'waiting') as waiting_sessions
      FROM websites 
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({
      success: true,
      website: result.rows[0]
    });

  } catch (error) {
    console.error('Get website error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update website
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    const result = await query(
      'UPDATE websites SET name = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name, domain, status',
      [name, status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({
      success: true,
      message: 'Website updated successfully',
      website: result.rows[0]
    });

  } catch (error) {
    console.error('Update website error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Regenerate API key
router.post('/:id/regenerate-key', async (req, res) => {
  try {
    const { id } = req.params;
    const newApiKey = uuidv4();

    const result = await query(
      'UPDATE websites SET api_key = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, domain, api_key',
      [newApiKey, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({
      success: true,
      message: 'API key regenerated successfully',
      website: result.rows[0]
    });

  } catch (error) {
    console.error('Regenerate API key error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get website statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.query;

    const result = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_sessions,
        COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_sessions,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_sessions,
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '${days} days' THEN 1 END) as sessions_last_${days}_days,
        AVG(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))/60) as avg_session_duration_minutes
      FROM chat_sessions 
      WHERE website_id = $1`,
      [id]
    );

    // Get daily session counts for the last 30 days
    const dailyStats = await query(
      `SELECT 
        DATE(started_at) as date,
        COUNT(*) as sessions
      FROM chat_sessions 
      WHERE website_id = $1 AND started_at >= NOW() - INTERVAL '${days} days'
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
    console.error('Get website stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete website
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if website has active sessions
    const activeSessions = await query(
      'SELECT COUNT(*) as count FROM chat_sessions WHERE website_id = $1 AND status IN ($2, $3)',
      [id, 'active', 'waiting']
    );

    if (parseInt(activeSessions.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete website with active or waiting chat sessions' 
      });
    }

    const result = await query(
      'DELETE FROM websites WHERE id = $1 RETURNING id, name, domain',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({
      success: true,
      message: 'Website deleted successfully',
      website: result.rows[0]
    });

  } catch (error) {
    console.error('Delete website error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
