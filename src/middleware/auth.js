// Check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/login');
}

// Check if user is an admin
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.is_admin) {
    return next();
  }
  res.status(403).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Access Denied</title>
      <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
      <div class="container">
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <a href="/" class="btn">Return Home</a>
      </div>
    </body>
    </html>
  `);
}

// Attach user to request for API routes
function attachUser(req, res, next) {
  res.locals.user = req.user || null;
  next();
}

module.exports = {
  isAuthenticated,
  isAdmin,
  attachUser
};
