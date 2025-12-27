const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdmin } = require('../middleware/auth');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Get embedding from OpenAI using text-embedding-3-small model
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('Error getting embedding:', err);
    return null;
  }
}

// Apply admin middleware to all routes
router.use(isAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
  try {
    const [usersResult, proverbsResult] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM users'),
      db.query('SELECT COUNT(*) as count FROM proverbs')
    ]);

    const stats = {
      users: usersResult.rows[0].count,
      proverbs: proverbsResult.rows[0].count
    };

    res.send(generateAdminDashboard(req.user, stats));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading admin dashboard');
  }
});

// Users management
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM users ORDER BY created_at DESC'
    );
    res.send(generateUsersPage(req.user, result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading users');
  }
});

// Toggle admin status
router.post('/users/:id/toggle-admin', async (req, res) => {
  const userId = parseInt(req.params.id);

  // Prevent self-demotion
  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot change your own admin status' });
  }

  try {
    await db.query(
      'UPDATE users SET is_admin = NOT is_admin, updated_at = NOW() WHERE id = $1',
      [userId]
    );
    res.redirect('/admin/users');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating user');
  }
});

// Proverbs management
router.get('/proverbs', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM proverbs ORDER BY chapter, verse'
    );
    res.send(generateProverbsPage(req.user, result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading proverbs');
  }
});

// Add/Edit proverb form
router.get('/proverbs/new', (req, res) => {
  res.send(generateProverbForm(req.user, null));
});

router.get('/proverbs/:id/edit', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM proverbs WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).send('Proverb not found');
    }
    res.send(generateProverbForm(req.user, result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading proverb');
  }
});

// Create proverb (single)
router.post('/proverbs', async (req, res) => {
  const { chapter, verse, text } = req.body;

  try {
    await db.query(
      `INSERT INTO proverbs (chapter, verse, text)
       VALUES ($1, $2, $3)
       ON CONFLICT (chapter, verse) DO UPDATE SET text = $3, updated_at = NOW()`,
      [parseInt(chapter), parseInt(verse), text]
    );
    res.redirect('/admin/proverbs');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error saving proverb');
  }
});

// Create proverbs in bulk with embeddings
router.post('/proverbs/bulk', async (req, res) => {
  const { chapter, verses } = req.body;
  const chapterNum = parseInt(chapter);

  if (!chapter || !verses) {
    return res.status(400).send('Chapter and verses are required');
  }

  try {
    // Split verses by newlines, each line is a verse
    const lines = verses.split('\n');
    let savedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      const verseNum = i + 1; // Line number = verse number (1-indexed)

      // Skip empty lines
      if (!text) continue;

      try {
        // Get vector embedding from OpenAI
        const vector = await getEmbedding(text);

        if (vector) {
          // Insert with vector
          await db.query(
            `INSERT INTO proverbs (chapter, verse, text, vector)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (chapter, verse) DO UPDATE SET text = $3, vector = $4, updated_at = NOW()`,
            [chapterNum, verseNum, text, JSON.stringify(vector)]
          );
        } else {
          // Insert without vector if embedding failed
          await db.query(
            `INSERT INTO proverbs (chapter, verse, text)
             VALUES ($1, $2, $3)
             ON CONFLICT (chapter, verse) DO UPDATE SET text = $3, updated_at = NOW()`,
            [chapterNum, verseNum, text]
          );
        }
        savedCount++;
      } catch (verseErr) {
        console.error(`Error saving verse ${verseNum}:`, verseErr);
        errorCount++;
      }
    }

    console.log(`Bulk save: ${savedCount} verses saved, ${errorCount} errors for chapter ${chapterNum}`);
    res.redirect('/admin/proverbs');
  } catch (err) {
    console.error('Error in bulk save:', err);
    res.status(500).send('Error saving proverbs');
  }
});

// Update proverb (regenerates embedding)
router.post('/proverbs/:id', async (req, res) => {
  const { chapter, verse, text } = req.body;

  try {
    // Get new embedding for updated text
    const vector = await getEmbedding(text);

    if (vector) {
      await db.query(
        'UPDATE proverbs SET chapter = $1, verse = $2, text = $3, vector = $4, updated_at = NOW() WHERE id = $5',
        [parseInt(chapter), parseInt(verse), text, JSON.stringify(vector), req.params.id]
      );
    } else {
      await db.query(
        'UPDATE proverbs SET chapter = $1, verse = $2, text = $3, updated_at = NOW() WHERE id = $4',
        [parseInt(chapter), parseInt(verse), text, req.params.id]
      );
    }
    res.redirect('/admin/proverbs');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating proverb');
  }
});

// Delete proverb
router.post('/proverbs/:id/delete', async (req, res) => {
  try {
    await db.query('DELETE FROM proverbs WHERE id = $1', [req.params.id]);
    res.redirect('/admin/proverbs');
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting proverb');
  }
});

// Admin dashboard HTML
function generateAdminDashboard(user, stats) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Proverbs</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar navbar-admin">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
      <span class="badge">Admin</span>
    </div>
    <div class="nav-links">
      <a href="/admin" class="active">Dashboard</a>
      <a href="/admin/users">Users</a>
      <a href="/admin/proverbs">Proverbs</a>
      <span class="user-info">
        ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar" class="avatar">` : ''}
        ${user.display_name}
      </span>
      <a href="/auth/logout" class="btn btn-outline">Logout</a>
    </div>
  </nav>

  <main class="container admin-container">
    <h1>Admin Dashboard</h1>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Users</h3>
        <p class="stat-number">${stats.users}</p>
        <a href="/admin/users">Manage Users</a>
      </div>
      <div class="stat-card">
        <h3>Total Proverbs</h3>
        <p class="stat-number">${stats.proverbs}</p>
        <a href="/admin/proverbs">Manage Proverbs</a>
      </div>
    </div>

    <section class="quick-actions">
      <h2>Quick Actions</h2>
      <div class="actions-grid">
        <a href="/admin/proverbs/new" class="btn btn-primary">Add New Proverb</a>
        <a href="/admin/users" class="btn btn-secondary">Manage Admins</a>
      </div>
    </section>
  </main>
</body>
</html>
  `;
}

// Users page HTML
function generateUsersPage(user, users) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Users - Admin - Proverbs</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar navbar-admin">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
      <span class="badge">Admin</span>
    </div>
    <div class="nav-links">
      <a href="/admin">Dashboard</a>
      <a href="/admin/users" class="active">Users</a>
      <a href="/admin/proverbs">Proverbs</a>
      <a href="/auth/logout" class="btn btn-outline">Logout</a>
    </div>
  </nav>

  <main class="container admin-container">
    <h1>User Management</h1>

    <table class="data-table">
      <thead>
        <tr>
          <th>Avatar</th>
          <th>Name</th>
          <th>Email</th>
          <th>Admin</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr>
            <td>${u.avatar_url ? `<img src="${u.avatar_url}" alt="Avatar" class="avatar-small">` : '-'}</td>
            <td>${u.display_name || '-'}</td>
            <td>${u.email}</td>
            <td>${u.is_admin ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-muted">No</span>'}</td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
              ${u.id !== user.id ? `
                <form action="/admin/users/${u.id}/toggle-admin" method="POST" style="display:inline">
                  <button type="submit" class="btn btn-small ${u.is_admin ? 'btn-danger' : 'btn-success'}">
                    ${u.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </form>
              ` : '<span class="text-muted">Current User</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </main>
</body>
</html>
  `;
}

// Proverbs management page HTML
function generateProverbsPage(user, proverbs) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proverbs - Admin - Proverbs</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar navbar-admin">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
      <span class="badge">Admin</span>
    </div>
    <div class="nav-links">
      <a href="/admin">Dashboard</a>
      <a href="/admin/users">Users</a>
      <a href="/admin/proverbs" class="active">Proverbs</a>
      <a href="/auth/logout" class="btn btn-outline">Logout</a>
    </div>
  </nav>

  <main class="container admin-container">
    <div class="page-header">
      <h1>Proverbs Management</h1>
      <a href="/admin/proverbs/new" class="btn btn-primary">Add New Proverb</a>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Chapter</th>
          <th>Verse</th>
          <th>Text</th>
          <th>Has Vector</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${proverbs.map(p => `
          <tr>
            <td>${p.chapter}</td>
            <td>${p.verse}</td>
            <td class="text-truncate">${p.text.substring(0, 100)}${p.text.length > 100 ? '...' : ''}</td>
            <td>${p.vector ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-muted">No</span>'}</td>
            <td class="actions">
              <a href="/admin/proverbs/${p.id}/edit" class="btn btn-small btn-secondary">Edit</a>
              <form action="/admin/proverbs/${p.id}/delete" method="POST" style="display:inline" onsubmit="return confirm('Are you sure?')">
                <button type="submit" class="btn btn-small btn-danger">Delete</button>
              </form>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </main>
</body>
</html>
  `;
}

// Proverb form HTML (for editing single proverb)
function generateProverbForm(user, proverb) {
  const isEdit = !!proverb;

  // If editing, show single proverb edit form
  if (isEdit) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Proverb - Admin - Proverbs</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar navbar-admin">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
      <span class="badge">Admin</span>
    </div>
    <div class="nav-links">
      <a href="/admin">Dashboard</a>
      <a href="/admin/users">Users</a>
      <a href="/admin/proverbs" class="active">Proverbs</a>
      <a href="/auth/logout" class="btn btn-outline">Logout</a>
    </div>
  </nav>

  <main class="container admin-container">
    <h1>Edit Proverb</h1>

    <form action="/admin/proverbs/${proverb.id}" method="POST" class="form">
      <div class="form-row">
        <div class="form-group">
          <label for="chapter">Chapter</label>
          <input type="number" id="chapter" name="chapter" min="1" max="31" required value="${proverb.chapter}">
        </div>
        <div class="form-group">
          <label for="verse">Verse</label>
          <input type="number" id="verse" name="verse" min="1" required value="${proverb.verse}">
        </div>
      </div>

      <div class="form-group">
        <label for="text">Text</label>
        <textarea id="text" name="text" rows="4" required>${proverb.text}</textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Update Proverb</button>
        <a href="/admin/proverbs" class="btn btn-outline">Cancel</a>
      </div>
    </form>
  </main>
</body>
</html>
    `;
  }

  // For new proverbs, show bulk entry form
  const chapterOptions = Array.from({length: 31}, (_, i) => i + 1)
    .map(n => `<option value="${n}">Chapter ${n}</option>`)
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add Proverbs - Admin - Proverbs</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .help-text {
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
      margin-top: 0.5rem;
    }
    .verses-textarea {
      font-family: monospace;
      line-height: 1.6;
    }
    .info-box {
      background: var(--bg-secondary, #f5f5f5);
      border-left: 4px solid var(--primary, #007bff);
      padding: 1rem;
      margin-bottom: 1.5rem;
      border-radius: 0 4px 4px 0;
    }
  </style>
</head>
<body>
  <nav class="navbar navbar-admin">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
      <span class="badge">Admin</span>
    </div>
    <div class="nav-links">
      <a href="/admin">Dashboard</a>
      <a href="/admin/users">Users</a>
      <a href="/admin/proverbs" class="active">Proverbs</a>
      <a href="/auth/logout" class="btn btn-outline">Logout</a>
    </div>
  </nav>

  <main class="container admin-container">
    <h1>Add Proverbs</h1>

    <div class="info-box">
      <strong>Bulk Entry Mode:</strong> Enter multiple verses at once. Each line becomes a separate verse,
      with the line number determining the verse number. Empty lines are skipped.
      Vector embeddings will be generated automatically for each verse.
    </div>

    <form action="/admin/proverbs/bulk" method="POST" class="form">
      <div class="form-group">
        <label for="chapter">Chapter</label>
        <select id="chapter" name="chapter" required>
          <option value="">Select a chapter...</option>
          ${chapterOptions}
        </select>
      </div>

      <div class="form-group">
        <label for="verses">Verses</label>
        <textarea id="verses" name="verses" rows="20" class="verses-textarea" required
          placeholder="Line 1 = Verse 1&#10;Line 2 = Verse 2&#10;Line 3 = Verse 3&#10;..."></textarea>
        <p class="help-text">
          Enter one verse per line. The line number corresponds to the verse number.
          Leave a line blank to skip that verse number.
        </p>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Save Proverbs</button>
        <a href="/admin/proverbs" class="btn btn-outline">Cancel</a>
      </div>
    </form>
  </main>
</body>
</html>
  `;
}

module.exports = router;
