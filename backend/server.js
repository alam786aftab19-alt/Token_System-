const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Route files
const authRoutes = require('./routes/authRoutes');
const tokenRoutes = require('./routes/tokenRoutes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: '*', // Allow all origins for WebSocket connections in dev
    methods: ['GET', 'POST']
  }
});

// Store io instance on app context to make it accessible in controllers
app.set('io', io);

// Security Middleware
app.use(cors());
app.use(
  helmet({
    // Disable Content Security Policy (CSP) in development to allow loading
    // external scripts (Socket.io client, fonts) and inline styles smoothly.
    contentSecurityPolicy: false
  })
);

// Rate Limiter to prevent brute force and API spamming
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// JSON and URL-encoded body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokenRoutes);

// Catch-all route for static frontend file mapping (SPA-like or direct index fallback)
app.get('*', (req, res, next) => {
  // If request is for api routes, let it go to 404
  if (req.url.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`Client connected to real-time sync: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Token System Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`=========================================`);
});
