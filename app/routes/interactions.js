// Interaction routes: post comments, like/unlike toggles.
// Likes use a composite primary key (user_id, post_id) to enforce one per user.

const express = require('express');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.post('/posts/:id/comments', requireLogin, async (req, res) => {
  const postId = Number(req.params.id);
  const body = (req.body.body || '').trim();
  if (!Number.isInteger(postId) || !body) return res.redirect(`/posts/${postId}`);

  await db.execute(
    'INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)',
    [postId, req.session.userId, body.slice(0, 2000)]
  );
  res.redirect(`/posts/${postId}`);
});

router.post('/posts/:id/like', requireLogin, async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) return res.redirect('/');

  await db.execute(
    'INSERT IGNORE INTO likes (user_id, post_id) VALUES (?, ?)',
    [req.session.userId, postId]
  );
  res.redirect(req.get('Referer') || '/');
});

router.post('/posts/:id/unlike', requireLogin, async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) return res.redirect('/');

  await db.execute(
    'DELETE FROM likes WHERE user_id = ? AND post_id = ?',
    [req.session.userId, postId]
  );
  res.redirect(req.get('Referer') || '/');
});

module.exports = router;
