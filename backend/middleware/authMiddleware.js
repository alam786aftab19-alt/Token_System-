const jwt = require('jsonwebtoken');
const supabase = require('../config/supabaseClient');

/**
 * Middleware to verify JWT and authenticate users.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access denied. Invalid token format.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_jwt_secret');

    // Retrieve user details from Supabase database
    const { data: user, error } = await supabase
      .from('token_system_users')
      .select('id, email, full_name, is_verified, is_admin')
      .eq('id', decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'User does not exist or session is invalid.' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Authentication failed. Invalid token.' });
  }
};

module.exports = authMiddleware;
