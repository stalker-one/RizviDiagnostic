const bcrypt = require('bcryptjs');
const { readTable, writeTable, generateId } = require('./db');

// Vercel does not run the desktop seed script automatically. On a brand-new
// production database, create the same safe initial staff accounts that the
// existing seed script provides. Existing users are never modified.
function ensureBootstrapUsers() {
  const users = readTable('users');
  if (users.length > 0) return false;

  const now = new Date().toISOString();
  const makeUser = (name, email, password, role, permanent = false) => ({
    id: generateId('user'),
    name,
    email,
    phone: '0320-2616216',
    role,
    password: bcrypt.hashSync(password, 10),
    active: true,
    permanent,
    createdAt: now,
    lastSignedIn: null,
  });

  writeTable('users', [
    makeUser('Super Administrator', 'superadmin@rizvidiagnostic.com', 'SuperAdmin@123', 'superadmin', true),
    makeUser('Administrator', 'admin@rizvidiagnostic.com', 'Admin@123', 'admin'),
    makeUser('Front Desk Staff', 'staff@rizvidiagnostic.com', 'Staff@123', 'staff'),
  ]);

  console.log('[bootstrap] Created initial Rizvi Diagnostic staff accounts.');
  return true;
}

module.exports = { ensureBootstrapUsers };
