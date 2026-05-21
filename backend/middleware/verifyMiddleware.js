/**
 * Middleware to restrict access to users who have verified their email addresses.
 */
const verifyMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  if (!req.user.is_verified) {
    return res.status(403).json({ error: 'Access denied. Please verify your email first.' });
  }

  next();
};

module.exports = verifyMiddleware;
