const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../db');

// Home page
router.get('/', async (req, res) => {
  try {
    // Get all chapters for navigation
    const chaptersResult = await db.query(
      'SELECT DISTINCT chapter FROM proverbs ORDER BY chapter'
    );
    const chapters = chaptersResult.rows.map(r => r.chapter);

    res.send(generateHomePage(req.user, chapters));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading page');
  }
});

// Chapter page
router.get('/chapter/:num', async (req, res) => {
  const chapter = parseInt(req.params.num);

  if (isNaN(chapter) || chapter < 1 || chapter > 31) {
    return res.status(404).send('Chapter not found');
  }

  try {
    const result = await db.query(
      'SELECT * FROM proverbs WHERE chapter = $1 ORDER BY verse',
      [chapter]
    );

    res.send(generateChapterPage(req.user, chapter, result.rows));
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading chapter');
  }
});

// Generate home page HTML
function generateHomePage(user, chapters) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proverbs - Vector Embedded Wisdom</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
    </div>
    <div class="nav-links">
      ${user ? `
        <span class="user-info">
          ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar" class="avatar">` : ''}
          ${user.display_name}
        </span>
        ${user.is_admin ? '<a href="/admin" class="btn btn-secondary">Admin</a>' : ''}
        <a href="/auth/logout" class="btn btn-outline">Logout</a>
      ` : `
        <a href="/auth/login" class="btn btn-primary">Login</a>
      `}
    </div>
  </nav>

  <main class="container">
    <header class="hero">
      <h1>Proverbs</h1>
      <p class="tagline">Vector Embedded Wisdom</p>
    </header>

    <section class="search-section">
      <form action="/api/search" method="GET" class="search-form">
        <input type="text" name="q" placeholder="Search for wisdom..." class="search-input">
        <button type="submit" class="btn btn-primary">Search</button>
      </form>
    </section>

    <section class="chapters-grid">
      <h2>Chapters</h2>
      <div class="grid">
        ${Array.from({length: 31}, (_, i) => i + 1).map(num => `
          <a href="/chapter/${num}" class="chapter-card ${chapters.includes(num) ? '' : 'empty'}">
            <span class="chapter-num">${num}</span>
          </a>
        `).join('')}
      </div>
    </section>
  </main>

  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} Proverbs - Vector Embedded Wisdom</p>
  </footer>
</body>
</html>
  `;
}

// Generate chapter page HTML
function generateChapterPage(user, chapter, verses) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proverbs ${chapter} - Vector Embedded Wisdom</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <nav class="navbar">
    <div class="nav-brand">
      <a href="/">Proverbs</a>
    </div>
    <div class="nav-links">
      ${user ? `
        <span class="user-info">
          ${user.avatar_url ? `<img src="${user.avatar_url}" alt="Avatar" class="avatar">` : ''}
          ${user.display_name}
        </span>
        ${user.is_admin ? '<a href="/admin" class="btn btn-secondary">Admin</a>' : ''}
        <a href="/auth/logout" class="btn btn-outline">Logout</a>
      ` : `
        <a href="/auth/login" class="btn btn-primary">Login</a>
      `}
    </div>
  </nav>

  <main class="container">
    <nav class="breadcrumb">
      <a href="/">Home</a> &raquo; <span>Chapter ${chapter}</span>
    </nav>

    <header class="chapter-header">
      <div class="chapter-nav">
        ${chapter > 1 ? `<a href="/chapter/${chapter - 1}" class="btn btn-outline">&laquo; Chapter ${chapter - 1}</a>` : '<span></span>'}
        <h1>Proverbs ${chapter}</h1>
        ${chapter < 31 ? `<a href="/chapter/${chapter + 1}" class="btn btn-outline">Chapter ${chapter + 1} &raquo;</a>` : '<span></span>'}
      </div>
    </header>

    <section class="verses">
      ${verses.length > 0 ? verses.map(v => `
        <div class="verse" id="v${v.verse}">
          <span class="verse-num">${v.verse}</span>
          <span class="verse-text">${v.text}</span>
        </div>
      `).join('') : `
        <p class="no-content">No verses available for this chapter yet.</p>
      `}
    </section>
  </main>

  <footer class="footer">
    <p>&copy; ${new Date().getFullYear()} Proverbs - Vector Embedded Wisdom</p>
  </footer>
</body>
</html>
  `;
}

module.exports = router;
