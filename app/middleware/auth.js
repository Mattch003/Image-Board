// Auth middleware — requireLogin guards protected routes,
// attachUser exposes currentUser to all EJS templates.

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    req.flash('error', 'Please log in first.');
    return res.redirect('/login');
  }
  next();
}

function attachUser(req, res, next) {
  res.locals.currentUser = req.session.userId
    ? { id: req.session.userId, username: req.session.username }
    : null;
  next();
}

module.exports = { requireLogin, attachUser };
