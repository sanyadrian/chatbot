const express = require('express');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const router = express.Router();

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Submit survey response
router.post('/submit', async (req, res) => {
  try {
    const {
      session_id,
      customer_name,
      customer_email,
      problem_solved,
      feedback,
      rating
    } = req.body;

    // Validate required fields
    if (!session_id || problem_solved === undefined) {
      return res.status(400).json({ error: 'Session ID and problem_solved are required' });
    }

    // Get session details to populate agent and website info
    const sessionResult = await query(`
      SELECT 
        cs.agent_id,
        a.name as agent_name,
        cs.website_id,
        w.name as website_name
      FROM chat_sessions cs
      LEFT JOIN agents a ON cs.agent_id = a.id
      LEFT JOIN websites w ON cs.website_id = w.id
      WHERE cs.session_id = $1
    `, [session_id]);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = sessionResult.rows[0];

    // Insert survey response
    const result = await query(`
      INSERT INTO chat_surveys (
        session_id,
        customer_name,
        customer_email,
        agent_id,
        agent_name,
        website_id,
        website_name,
        problem_solved,
        feedback,
        rating,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id, created_at
    `, [
      session_id,
      customer_name || null,
      customer_email || null,
      session.agent_id,
      session.agent_name,
      session.website_id,
      session.website_name,
      problem_solved,
      feedback || null,
      rating || null
    ]);

    console.log('✅ Survey submitted successfully:', result.rows[0]);

    res.json({
      success: true,
      message: 'Survey submitted successfully',
      survey_id: result.rows[0].id
    });

  } catch (error) {
    console.error('Error submitting survey:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all surveys (for dashboard)
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, status, agent_id, problem_solved } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    // Filter by problem solved status
    if (problem_solved !== undefined) {
      whereClause += ` AND problem_solved = $${paramCount}`;
      params.push(problem_solved === 'true');
      paramCount++;
    }

    // Filter by agent
    if (agent_id) {
      whereClause += ` AND agent_id = $${paramCount}`;
      params.push(agent_id);
      paramCount++;
    }

    // Get surveys with pagination
    const surveysResult = await query(`
      SELECT 
        id,
        session_id,
        customer_name,
        customer_email,
        agent_name,
        website_name,
        problem_solved,
        feedback,
        rating,
        created_at
      FROM chat_surveys
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...params, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM chat_surveys
      ${whereClause}
    `, params);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      surveys: surveysResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching surveys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get survey statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { agent_id, website_id, date_from, date_to } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (agent_id) {
      whereClause += ` AND agent_id = $${paramCount}`;
      params.push(agent_id);
      paramCount++;
    }

    if (website_id) {
      whereClause += ` AND website_id = $${paramCount}`;
      params.push(website_id);
      paramCount++;
    }

    if (date_from) {
      whereClause += ` AND created_at >= $${paramCount}`;
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereClause += ` AND created_at <= $${paramCount}`;
      params.push(date_to);
      paramCount++;
    }

    // Get statistics
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_surveys,
        COUNT(CASE WHEN problem_solved = true THEN 1 END) as problem_solved_count,
        COUNT(CASE WHEN problem_solved = false THEN 1 END) as problem_not_solved_count,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as high_rating_count,
        COUNT(CASE WHEN rating <= 2 THEN 1 END) as low_rating_count
      FROM chat_surveys
      ${whereClause}
    `, params);

    const stats = statsResult.rows[0];
    const satisfactionRate = stats.total_surveys > 0 
      ? ((stats.problem_solved_count / stats.total_surveys) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      stats: {
        total_surveys: parseInt(stats.total_surveys),
        problem_solved_count: parseInt(stats.problem_solved_count),
        problem_not_solved_count: parseInt(stats.problem_not_solved_count),
        satisfaction_rate: parseFloat(satisfactionRate),
        average_rating: parseFloat(stats.average_rating || 0).toFixed(1),
        high_rating_count: parseInt(stats.high_rating_count),
        low_rating_count: parseInt(stats.low_rating_count)
      }
    });

  } catch (error) {
    console.error('Error fetching survey stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get survey by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        id,
        session_id,
        customer_name,
        customer_email,
        agent_name,
        website_name,
        problem_solved,
        feedback,
        rating,
        created_at
      FROM chat_surveys
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    res.json({
      success: true,
      survey: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
