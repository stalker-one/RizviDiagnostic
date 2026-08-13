const express = require('express');
const bcrypt = require('bcryptjs');
const { readTable, writeTable, generateId } = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
// Both admin and superadmin can reach this router; individual handlers below
// narrow down what each of them is actually allowed to do.
router.use(authenticate, requireRole('admin', 'superadmin'));

function sanitize(u) {
  const { password, ...rest } = u;
  return rest;
}

// An admin may only ever create/edit/deactivate/delete "staff" accounts.
// Only the superadmin can manage admin (and other superadmin) accounts, and
// even the superadmin can never deactivate, delete, or change the role of an
// account flagged `permanent` — that's the one account that must always be
// able to get back into the system.
function canManage(actor, target) {
  if (target.permanent) return false;
  if (actor.role === 'superadmin') return true;
  if (actor.role === 'admin') return target.role === 'staff';
  return false;
}

// The superadmin account never appears in the Users list — it isn't managed
// alongside ordinary admin/staff accounts, it can't be edited or removed
// from here, and it signs in through the separate /adminlogin portal only.
router.get('/', (req, res) => {
  const users = readTable('users');
  res.json(users.filter((u) => u.role !== 'superadmin').map(sanitize));
});

router.post('/', (req, res) => {
  const { name, email, phone, role, password } = req.body;
  if (!name || !email || !role || !password) {
    return res.status(400).json({ message: 'Name, email, role and password are required.' });
  }

  // Both admin and superadmin may create staff or admin accounts. Only the
  // superadmin role itself can never be assigned here — that one account is
  // permanent and managed separately via the /adminlogin portal.
  const allowedRoles = ['admin', 'staff'];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ message: 'Role must be admin or staff.' });
  }

  const users = readTable('users');
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ message: 'A user with this email already exists.' });
  }
  const newUser = {
    id: generateId('user'),
    name,
    email,
    phone: phone || '',
    role,
    password: bcrypt.hashSync(password, 10),
    active: true,
    permanent: false,
    createdAt: new Date().toISOString(),
    lastSignedIn: null,
  };
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
  if (!isSelf && !canManage(req.user, user)) {
    return res.status(403).json({ message: 'You do not have permission to edit this account.' });
  }

  // Role changes and activation toggles are never allowed on a permanent
  // account. Both admin and superadmin can promote/demote between "admin"
  // and "staff" — but an admin can only do this for accounts they're
  // otherwise allowed to manage (i.e. staff accounts, per canManage above),
  // so an admin can promote a staff member to admin, but can't touch an
  // existing admin/superadmin account, and can't act on their own role.
  if (role !== undefined && role !== user.role) {
    if (user.permanent) {
      return res.status(400).json({ message: 'The superadmin account\'s role cannot be changed.' });
    }
    if (isSelf) {
      return res.status(403).json({ message: 'You cannot change your own role.' });
    }
    if (!['admin', 'staff'].includes(role)) {
      return res.status(400).json({ message: 'Role must be admin or staff.' });
    }
    user.role = role;
  }

  if (active !== undefined && active !== user.active) {
    if (user.permanent) {
      return res.status(400).json({ message: 'The superadmin account can never be deactivated.' });
    }
    user.active = active;
  }

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (password) user.password = bcrypt.hashSync(password, 10);

  writeTable('users', users);
  res.json(sanitize(user));
});

router.delete('/:id', (req, res) => {
  const users = readTable('users');
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: 'User not found.' });
  const user = users[idx];

  if (req.user.id === req.params.id) {
    return res.status(400).json({ message: 'You cannot delete your own account while logged in.' });
  }
  if (user.permanent) {
    return res.status(400).json({ message: 'The superadmin account is permanent and cannot be deleted.' });
  }
  if (!canManage(req.user, user)) {
    return res.status(403).json({ message: 'You do not have permission to delete this account.' });
  }

  users.splice(idx, 1);
  writeTable('users', users);
  res.json({ message: 'User deleted.' });
});

module.exports = router;
