const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdmin } = require('../middleware/auth');

// Search proverbs (public)
router.get('/search', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.json({ results: [] });
  }

  try {
    // Text-based search
    const result = await db.query(
      `SELECT id, chapter, verse, text
       FROM proverbs
       WHERE text ILIKE $1
       ORDER BY chapter, verse
       LIMIT 20`,
      [`%${query}%`]
    );

    res.json({ results: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Vector similarity search (public)
router.post('/search/similar', async (req, res) => {
  const { vector } = req.body;

  if (!vector || !Array.isArray(vector) || vector.length !== 1536) {
    return res.status(400).json({ error: 'Invalid vector format. Expected array of 1536 floats.' });
  }

  try {
    // Convert array to pgvector format
    const vectorStr = `[${vector.join(',')}]`;

    const result = await db.query(
      `SELECT id, chapter, verse, text,
              1 - (vector <=> $1::vector) as similarity
       FROM proverbs
       WHERE vector IS NOT NULL
       ORDER BY vector <=> $1::vector
       LIMIT 10`,
      [vectorStr]
    );

    res.json({ results: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Similarity search failed' });
  }
});

// Get all proverbs (public)
router.get('/proverbs', async (req, res) => {
  const { chapter } = req.query;

  try {
    let result;
    if (chapter) {
      result = await db.query(
        'SELECT id, chapter, verse, text FROM proverbs WHERE chapter = $1 ORDER BY verse',
        [parseInt(chapter)]
      );
    } else {
      result = await db.query(
        'SELECT id, chapter, verse, text FROM proverbs ORDER BY chapter, verse'
      );
    }

    res.json({ proverbs: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch proverbs' });
  }
});

// Get single proverb (public)
router.get('/proverbs/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, chapter, verse, text FROM proverbs WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proverb not found' });
    }

    res.json({ proverb: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch proverb' });
  }
});

// Update proverb vector (admin only)
router.put('/proverbs/:id/vector', isAdmin, async (req, res) => {
  const { vector } = req.body;

  if (!vector || !Array.isArray(vector) || vector.length !== 1536) {
    return res.status(400).json({ error: 'Invalid vector format. Expected array of 1536 floats.' });
  }

  try {
    const vectorStr = `[${vector.join(',')}]`;

    const result = await db.query(
      'UPDATE proverbs SET vector = $1::vector, updated_at = NOW() WHERE id = $2 RETURNING id',
      [vectorStr, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proverb not found' });
    }

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update vector' });
  }
});

// Bulk update vectors (admin only)
router.post('/proverbs/vectors', isAdmin, async (req, res) => {
  const { updates } = req.body;

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Invalid format. Expected { updates: [{ id, vector }] }' });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    for (const update of updates) {
      if (!update.id || !update.vector || update.vector.length !== 1536) {
        throw new Error(`Invalid update for id ${update.id}`);
      }

      const vectorStr = `[${update.vector.join(',')}]`;
      await client.query(
        'UPDATE proverbs SET vector = $1::vector, updated_at = NOW() WHERE id = $2',
        [vectorStr, update.id]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, updated: updates.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update vectors' });
  } finally {
    client.release();
  }
});

// Get current user info
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.display_name,
      avatarUrl: req.user.avatar_url,
      isAdmin: req.user.is_admin
    }
  });
});

module.exports = router;
