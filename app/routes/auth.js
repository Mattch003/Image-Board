// Auth routes: /register, /login, /logout
// Passwords are bcrypt-hashed (cost 12) and validated for strength.

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

router.get('/register', (req, res) => {
  res.render('register');
});

router.post('/register', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (username.length < 3 || username.length > 32) {
    req.flash('error', 'Username must be 3-32 characters.');
    return res.redirect('/register');
  }
  const passwordErrors = [];
  if (password.length < 6) passwordErrors.push('at least 6 characters');
  if (!/[A-Z]/.test(password)) passwordErrors.push('one uppercase letter');
  if (!/[0-9]/.test(password)) passwordErrors.push('one number');
  if (!/[^A-Za-z0-9]/.test(password)) passwordErrors.push('one special symbol');
  if (passwordErrors.length) {
    req.flash('error', 'Password must contain ' + passwordErrors.join(', ') + '.');
    return res.redirect('/register');
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, hash]
    );
    req.session.userId = result.insertId;
    req.session.username = username;
    res.redirect('/');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      req.flash('error', 'Username already taken.');
      return res.redirect('/register');
    }
    throw err;
  }
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  const [rows] = await db.execute(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    req.flash('error', 'Invalid username or password.');
    return res.redirect('/login');
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
