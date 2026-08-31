const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { readTable, writeTable, generateId, DATA_DIR } = require('../db');
const { getDb } = require('../mongo-table');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const SESSION_TABLE = 'biometricSessions';
const LOCAL_CHALLENGE_FILE = path.join(DATA_DIR, 'biometricChallenges.json');
const CHALLENGE_TTL_MS = 2 * 60 * 1000;

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const challengeValue = () => crypto.randomBytes(32).toString('base64url');
const deviceHash = (value) => hash(value);
const credentialHash = (value) => hash(value);
const deviceId = (req) => String(req.get('x-rizvi-device-id') || req.body?.deviceId || '').trim();
const credentialId = (value) => String(value || '').trim();

function portalAllowsRole(portal, role) { return portal === 'admin' ? role === 'superadmin' : role !== 'superadmin'; }
function issueToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });
}
function localChallenges() {
  try { if (!fs.existsSync(LOCAL_CHALLENGE_FILE)) fs.writeFileSync(LOCAL_CHALLENGE_FILE, '[]'); const value = JSON.parse(fs.readFileSync(LOCAL_CHALLENGE_FILE, 'utf8') || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; }
}
function writeLocalChallenges(rows) { fs.writeFileSync(LOCAL_CHALLENGE_FILE, JSON.stringify(rows, null, 2)); }
function pruneLocalChallenges() { const rows = localChallenges().filter((x) => !x.usedAt && new Date(x.expiresAt).getTime() > Date.now()); writeLocalChallenges(rows); return rows; }

async function users() {
  const db = await getDb();
  if (db) { const doc = await db.collection('tables').findOne({ _id: 'users' }); if (Array.isArray(doc?.data)) return doc.data; }
  return readTable('users');
}
async function findSession(filter) {
  const db = await getDb();
  if (db) return db.collection('biometric_sessions').findOne({ ...filter, active: true });
  return readTable(SESSION_TABLE).find((x) => x.active && Object.entries(filter).every(([key, value]) => x[key] === value)) || null;
}
async function saveSession(record) {
  const db = await getDb();
  if (db) { await db.collection('biometric_sessions').updateOne({ userId: record.userId, deviceIdHash: record.deviceIdHash }, { $set: record }, { upsert: true }); return; }
  const rows = readTable(SESSION_TABLE); const i = rows.findIndex((x) => x.userId === record.userId && x.deviceIdHash === record.deviceIdHash); if (i >= 0) rows[i] = record; else rows.push(record); writeTable(SESSION_TABLE, rows);
}
async function revokeSession(userId, deviceHashValue) {
  const now = new Date().toISOString(); const db = await getDb();
  if (db) { await db.collection('biometric_sessions').updateOne({ userId, deviceIdHash: deviceHashValue }, { $set: { active: false, revokedAt: now, updatedAt: now } }); return; }
  const rows = readTable(SESSION_TABLE); let changed = false; rows.forEach((row) => { if (row.userId === userId && row.deviceIdHash === deviceHashValue && row.active) { row.active = false; row.revokedAt = now; row.updatedAt = now; changed = true; } }); if (changed) writeTable(SESSION_TABLE, rows);
}
async function addChallenge(record) {
  const db = await getDb();
  if (db) { await db.collection('biometric_challenges').insertOne(record); return; }
  const rows = pruneLocalChallenges(); rows.push(record); writeLocalChallenges(rows);
}
async function consumeChallenge(id, type) {
  const db = await getDb();
  if (db) {
    const now = new Date();
    const result = await db.collection('biometric_challenges').findOneAndUpdate({ _id: id, type, usedAt: { $exists: false }, expiresAt: { $gt: now } }, { $set: { usedAt: now } }, { returnDocument: 'after' });
    return result?.value || result || null;
  }
  const rows = pruneLocalChallenges(); const i = rows.findIndex((row) => row.id === id && row.type === type && !row.usedAt && new Date(row.expiresAt).getTime() > Date.now()); if (i < 0) return null; rows[i].usedAt = new Date().toISOString(); writeLocalChallenges(rows); return rows[i];
}
function verify(publicKeyBase64, text, signatureBase64) {
  try { const publicKey = crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' }); const verifier = crypto.createVerify('SHA256'); verifier.update(Buffer.from(text, 'utf8')); verifier.end(); return verifier.verify(publicKey, Buffer.from(signatureBase64, 'base64')); } catch (_) { return false; }
}

router.post('/enroll/challenge', authenticate, async (req, res) => {
  try {
    const d = deviceId(req); const c = credentialId(req.body?.credentialId); const publicKey = credentialId(req.body?.publicKey); const portal = req.body?.portal === 'admin' ? 'admin' : 'staff';
    if (!d || !c || !publicKey) return res.status(400).json({ message: 'Device, credential ID, and public key are required.' });
    if (!portalAllowsRole(portal, req.user.role)) return res.status(403).json({ message: 'This biometric portal does not match your account.' });
    const allUsers = await users(); const user = allUsers.find((row) => row.id === req.user.id); if (!user || !user.active) return res.status(401).json({ message: 'User account is not available.' });
    const challenge = challengeValue(); const id = generateId('bio_challenge'); const now = new Date();
    await addChallenge({ _id: id, id, type: 'enroll', userId: user.id, role: user.role, portal, deviceIdHash: deviceHash(d), credentialIdHash: credentialHash(c), publicKey, challenge, createdAt: now, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) });
    res.json({ challengeId: id, challenge, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString() });
  } catch (err) { console.error('[biometric] enroll challenge:', err); res.status(503).json({ message: 'Biometric database is temporarily unavailable. Please try again.' }); }
});

router.post('/enroll/complete', authenticate, async (req, res) => {
  try {
    const challengeId = credentialId(req.body?.challengeId); const d = deviceId(req); const c = credentialId(req.body?.credentialId); const signature = credentialId(req.body?.signature);
    if (!challengeId || !d || !c || !signature) return res.status(400).json({ message: 'Biometric enrollment data is incomplete.' });
    const challenge = await consumeChallenge(challengeId, 'enroll');
    if (!challenge || challenge.userId !== req.user.id || challenge.deviceIdHash !== deviceHash(d) || challenge.credentialIdHash !== credentialHash(c)) return res.status(401).json({ message: 'Biometric enrollment challenge is invalid or expired.' });
    if (!verify(challenge.publicKey, challenge.challenge, signature)) return res.status(401).json({ message: 'Android biometric signature verification failed. Fingerprint login was not enabled.' });
    const now = new Date().toISOString();
    await saveSession({ id: generateId('bio'), userId: req.user.id, role: req.user.role, portal: challenge.portal, deviceIdHash: challenge.deviceIdHash, credentialIdHash: challenge.credentialIdHash, publicKey: challenge.publicKey, active: true, createdAt: now, updatedAt: now, lastUsedAt: null });
    res.json({ enabled: true, verified: true });
  } catch (err) { console.error('[biometric] enroll complete:', err); res.status(503).json({ message: 'Biometric database is temporarily unavailable. Please try again.' }); }
});

router.post('/login/challenge', async (req, res) => {
  try {
    const d = deviceId(req); const c = credentialId(req.body?.credentialId); const portal = req.body?.portal === 'admin' ? 'admin' : 'staff';
    if (!d || !c) return res.status(400).json({ message: 'Device and biometric credential are required.' });
    const session = await findSession({ deviceIdHash: deviceHash(d), credentialIdHash: credentialHash(c) });
    if (!session) return res.status(404).json({ message: 'Fingerprint login is not registered on this device. Continue with your email and password.' });
    if (!portalAllowsRole(portal, session.role)) return res.status(403).json({ message: 'This fingerprint is registered for a different login portal.' });
    const challenge = challengeValue(); const id = generateId('bio_login_challenge'); const now = new Date();
    await addChallenge({ _id: id, id, type: 'login', userId: session.userId, role: session.role, portal, deviceIdHash: deviceHash(d), credentialIdHash: credentialHash(c), challenge, createdAt: now, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) });
    res.json({ challengeId: id, challenge, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString() });
  } catch (err) { console.error('[biometric] login challenge:', err); res.status(503).json({ message: 'Biometric database is temporarily unavailable. Please continue with email and password.' }); }
});

router.post('/login/complete', async (req, res) => {
  try {
    const challengeId = credentialId(req.body?.challengeId); const d = deviceId(req); const c = credentialId(req.body?.credentialId); const signature = credentialId(req.body?.signature);
    if (!challengeId || !d || !c || !signature) return res.status(400).json({ message: 'Biometric verification data is incomplete.' });
    const challenge = await consumeChallenge(challengeId, 'login');
    if (!challenge || challenge.deviceIdHash !== deviceHash(d) || challenge.credentialIdHash !== credentialHash(c)) return res.status(401).json({ message: 'Fingerprint login verification expired. Continue with your email and password.' });
    const session = await findSession({ userId: challenge.userId, deviceIdHash: challenge.deviceIdHash, credentialIdHash: challenge.credentialIdHash });
    if (!session || !verify(session.publicKey, challenge.challenge, signature)) return res.status(401).json({ message: 'Fingerprint verification failed. Continue with your email and password.' });
    const allUsers = await users(); const user = allUsers.find((row) => row.id === session.userId);
    if (!user || !user.active || !portalAllowsRole(challenge.portal, user.role)) { await revokeSession(session.userId, session.deviceIdHash); return res.status(401).json({ message: 'This fingerprint account is no longer available. Continue with your email and password.' }); }
    if (user.role !== 'superadmin') { const settings = readTable('settings'); if (settings.siteDisabled) return res.status(423).json({ locked: true, reason: settings.siteDisabledReason || 'service_error', message: settings.siteDisabledMessage || 'Service temporarily unavailable.' }); }
    const now = new Date().toISOString(); const db = await getDb();
    if (db) await db.collection('biometric_sessions').updateOne({ _id: session._id }, { $set: { lastUsedAt: now, updatedAt: now } });
    else { const rows = readTable(SESSION_TABLE); const row = rows.find((x) => x.id === session.id); if (row) { row.lastUsedAt = now; row.updatedAt = now; writeTable(SESSION_TABLE, rows); } }
    res.json({ verified: true, token: issueToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone } });
  } catch (err) { console.error('[biometric] login complete:', err); res.status(503).json({ message: 'Biometric database is temporarily unavailable. Continue with email and password.' }); }
});

router.delete('/:deviceId', authenticate, async (req, res) => {
  try { const d = String(req.params.deviceId || '').trim(); if (!d) return res.status(400).json({ message: 'Device information is required.' }); await revokeSession(req.user.id, deviceHash(d)); res.json({ disabled: true }); }
  catch (err) { console.error('[biometric] disable:', err); res.status(503).json({ message: 'Biometric database is temporarily unavailable.' }); }
});

module.exports = router;
