const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAdmin } = require('../middleware/auth');

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

// Create proverb
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

// Update proverb
router.post('/proverbs/:id', async (req, res) => {
  const { chapter, verse, text } = req.body;

  try {
    await db.query(
      'UPDATE proverbs SET chapter = $1, verse = $2, text = $3, updated_at = NOW() WHERE id = $4',
      [parseInt(chapter), parseInt(verse), text, req.params.id]
    );
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

// Proverb form HTML
function generateProverbForm(user, proverb) {
  const isEdit = !!proverb;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isEdit ? 'Edit' : 'New'} Proverb - Admin - Proverbs</title>
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
    <h1>${isEdit ? 'Edit' : 'New'} Proverb</h1>

    <form action="/admin/proverbs${isEdit ? '/' + proverb.id : ''}" method="POST" class="form">
      <div class="form-row">
        <div class="form-group">
          <label for="chapter">Chapter</label>
          <input type="number" id="chapter" name="chapter" min="1" max="31" required value="${isEdit ? proverb.chapter : ''}">
        </div>
        <div class="form-group">
          <label for="verse">Verse</label>
          <input type="number" id="verse" name="verse" min="1" required value="${isEdit ? proverb.verse : ''}">
        </div>
      </div>

      <div class="form-group">
        <label for="text">Text</label>
        <textarea id="text" name="text" rows="4" required>${isEdit ? proverb.text : ''}</textarea>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'} Proverb</button>
        <a href="/admin/proverbs" class="btn btn-outline">Cancel</a>
      </div>
    </form>
  </main>
</body>
</html>
  `;
}

module.exports = router;
