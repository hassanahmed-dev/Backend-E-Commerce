const jwt = require('jsonwebtoken'); // Make sure to import jwt
const User = require('../models/User');

// Strict: Require token
async function verifyToken(req, res, next) {
  // In production, verify JWT or session here
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id); // or decoded._id
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token is not valid' });
  }
}

// Optional: Attach user if token present, else just next()
async function optional(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
  } catch (err) {
    // ignore error, treat as guest
  }
  next();
}

verifyToken.optional = optional;

// Admin-only middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access only' });
}

module.exports = verifyToken;
module.exports.requireAdmin = requireAdmin;