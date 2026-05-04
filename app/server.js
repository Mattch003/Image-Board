// Image Board — Express server entry point
// Wires up sessions, flash messages, auth, and route handlers.

require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');

const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const interactionRoutes = require('./routes/interactions');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
}));
app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = {
    error: req.flash('error'),
    success: req.flash('success'),
  };
  next();
});
app.use(attachUser);

app.use('/', authRoutes);
app.use('/', postRoutes);
app.use('/', interactionRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).send('Something went wrong.');
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`ImageBoard running on http://localhost:${port}`);
});
