// Posts routes: home feed, upload form, single-post detail.
// Uploads handled by multer (8 MB cap, image types only).

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'public', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  },
});

router.get('/', async (req, res) => {
  const [posts] = await db.query(`
    SELECT p.id, p.caption, p.image_path, p.created_at,
           u.username,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
           (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
           ${req.session.userId
             ? `EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me`
             : `0 AS liked_by_me`}
    FROM posts p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  `, req.session.userId ? [req.session.userId] : []);

  const [topUsers] = await db.query(`
    SELECT u.username, COUNT(p.id) AS post_count
    FROM users u
    LEFT JOIN posts p ON p.user_id = u.id
    GROUP BY u.id, u.username
    HAVING post_count > 0
    ORDER BY post_count DESC, u.username ASC
    LIMIT 5
  `);

  const [[stats]] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM posts) AS total_posts,
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM likes) AS total_likes
  `);

  let myStats = null;
  if (req.session.userId) {
    const [[mine]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS my_posts,
        (SELECT COUNT(*) FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.user_id = ?) AS likes_received,
        (SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.user_id = ?) AS comments_received
    `, [req.session.userId, req.session.userId, req.session.userId]);
    myStats = mine;
  }

  res.render('index', { posts, topUsers, stats, myStats });
});

router.get('/upload', requireLogin, (req, res) => {
  res.render('upload');
});

router.post('/upload', requireLogin, upload.single('image'), async (req, res) => {
  if (!req.file) {
    req.flash('error', 'Please choose an image file.');
    return res.redirect('/upload');
  }
  const caption = (req.body.caption || '').trim().slice(0, 500);
  await db.execute(
    'INSERT INTO posts (user_id, caption, image_path) VALUES (?, ?, ?)',
    [req.session.userId, caption, `/uploads/${req.file.filename}`]
  );
  res.redirect('/');
});

router.get('/posts/:id', async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isInteger(postId)) return res.status(404).send('Not found');

  const [postRows] = await db.query(`
    SELECT p.id, p.caption, p.image_path, p.created_at,
           u.username, p.user_id,
           (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
           ${req.session.userId
             ? `EXISTS(SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS liked_by_me`
             : `0 AS liked_by_me`}
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `, req.session.userId ? [req.session.userId, postId] : [postId]);

  const post = postRows[0];
  if (!post) return res.status(404).send('Post not found');

  const [comments] = await db.query(`
    SELECT c.id, c.body, c.created_at, u.username
    FROM comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `, [postId]);

  res.render('post', { post, comments });
});

module.exports = router;
