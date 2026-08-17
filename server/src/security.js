const jwt = require('jsonwebtoken');
const { User, Audit } = require('./models');

function sign(user) { return jwt.sign({ sub: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }); }
async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user?.active) return res.status(401).json({ message: 'Account unavailable' });
    req.user = user; next();
  } catch { res.status(401).json({ message: 'Invalid or expired session' }); }
}
const permit = (...roles) => (req, res, next) => {
  const effectiveRole = req.user.role === 'user' ? 'manager' : req.user.role;
  return roles.includes(req.user.role) || roles.includes(effectiveRole) ? next() : res.status(403).json({ message: 'Insufficient permission' });
};
const audit = async (req, action, entity, entityId, metadata = {}) => Audit.create({ actor: req.user?._id, action, entity, entityId, metadata, ip: req.ip });
module.exports = { sign, auth, permit, audit };
