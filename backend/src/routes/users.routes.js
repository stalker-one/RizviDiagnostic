const express = require('express');
const bcrypt = require('bcryptjs');
const { readTable, writeTable, generateId } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const { getFreshTable } = require('../mongo-table');

const router = express.Router();
router.use(authenticate, requireRole('admin', 'superadmin'));

function sanitize(u) { const { password, ...rest } = u; return rest; }

function canManage(actor, target) {
  if (target.permanent) return false;
  if (actor.role === 'superadmin') return true;
  if (actor.role === 'admin') return target.role === 'staff';
  return false;
}

router.get('/', (req, res) => {
  const users = readTable('users');
  res.json(users.filter((u) => u.role !== 'superadmin').map(sanitize));
});

router.post('/', (req, res) => {
  const { name, email, phone, role, password } = req.body;
  if (!name || !email || !role || !password) return res.status(400).json({ message: 'Name, email, role and password are required.' });
  if (!['admin', 'staff'].includes(role)) return res.status(403).json({ message: 'Role must be admin or staff.' });
  const users = readTable('users');
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'A user with this email already exists.' });
  const newUser = { id: generateId('user'), name, email, phone: phone || '', role, password: bcrypt.hashSync(password, 10), active: true, permanent: false, createdAt: new Date().toISOString(), lastSignedIn: null };
  users.push(newUser);
  writeTable('users', users);
  res.status(201).json(sanitize(newUser));
});

router.put('/:id', (req, res) => {
  const { name, email, phone, role, active, password } = req.body;
  const users = readTable('users');
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  const isSelf = req.user.id === user.id;
  if (!isSelf && !canManage(req.user, user)) return res.status(403).json({ message: 'You do not have permission to edit this account.' });
  if (role !== undefined && role !== user.role) {
    if (user.permanent) return res.status(400).json({ message: 'The superadmin account\'s role cannot be changed.' });
    if (isSelf) return res.status(403).json({ message: 'You cannot change your own role.' });
    if (!['admin', 'staff'].includes(role)) return res.status(400).json({ message: 'Role must be admin or staff.' });
    user.role = role;
  }
  if (active !== undefined && active !== user.active) {
    if (user.permanent) return res.status(400).json({ message: 'The superadmin account can never be deactivated.' });
    user.active = active;
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (password) user.password = bcrypt.hashSync(password, 10);
  writeTable('users', users);
  res.json(sanitize(user));
});

router.delete('/:id', async (req, res) => {
  const users = await getFreshTable('users', readTable('users'));
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'User not found.' });
  const user = users[idx];
  if (req.user.id === req.params.id) return res.status(400).json({ message: 'You cannot delete your own account while logged in.' });
  if (user.permanent) return res.status(400).json({ message: 'The superadmin account is permanent and cannot be deleted.' });
  if (!canManage(req.user, user)) return res.status(403).json({ message: 'You do not have permission to delete this account.' });
  users.splice(idx, 1);
  writeTable('users', users);
  res.json({ message: 'User deleted.' });
});

module.exports = router;
