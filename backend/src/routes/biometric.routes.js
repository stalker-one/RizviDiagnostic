const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { readTable, writeTable, generateId } = require('../db');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const TABLE = 'biometricSessions';
const hash = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const deviceId = (req) => String(req.get('x-rizvi-device-id') || req.body?.deviceId || '').trim();
const issueToken = (u) => jwt.sign({ id:u.id,name:u.name,email:u.email,role:u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '12h' });

// Called after normal password login, before Android biometric verification.
// A random opaque credential is generated server-side and only its hash is stored.
router.post('/enroll', authenticate, (req,res)=>{
 const d=deviceId(req); if(!d)return res.status(400).json({message:'Biometric device information is required.'});
 const u=readTable('users').find(x=>x.id===req.user.id); if(!u||!u.active)return res.status(401).json({message:'User account is not available.'});
 const rows=readTable(TABLE), now=new Date().toISOString();
 // One active biometric registration per user/device. Re-enabling replaces the old credential.
 const old=rows.find(x=>x.userId===u.id&&x.deviceIdHash===hash(d));
 const credential=crypto.randomBytes(32).toString('base64url');
 const record={id:old?.id||generateId('bio'),userId:u.id,role:u.role,deviceIdHash:hash(d),credentialHash:hash(credential),active:true,createdAt:old?.createdAt||now,updatedAt:now,lastUsedAt:old?.lastUsedAt||null};
 if(old)Object.assign(old,record);else rows.push(record); writeTable(TABLE,rows);
 res.json({registered:true,credential,deviceId:d,sessionId:record.id});
});

// Android calls this only after its local system biometric prompt succeeds.
// A successful match returns a fresh JWT, so no expiring JWT is stored as the biometric secret.
router.post('/login',(req,res)=>{
 const d=deviceId(req), c=String(req.body?.credential||req.body?.credentialId||'').trim();
 if(!d||!c)return res.status(400).json({message:'Biometric device information is required.'});
 const rows=readTable(TABLE), r=rows.find(x=>x.active&&x.deviceIdHash===hash(d)&&x.credentialHash===hash(c));
 if(!r)return res.status(401).json({message:'This fingerprint is not registered for this Android device. Please continue with your email and password.'});
 const u=readTable('users').find(x=>x.id===r.userId);
 if(!u||!u.active){r.active=false;r.updatedAt=new Date().toISOString();writeTable(TABLE,rows);return res.status(401).json({message:'This account is unavailable. Please continue with your email and password.'});}
 r.lastUsedAt=new Date().toISOString();r.updatedAt=r.lastUsedAt;writeTable(TABLE,rows);
 res.json({verified:true,token:issueToken(u),user:{id:u.id,name:u.name,email:u.email,role:u.role,phone:u.phone}});
});

// Disable only this user's registration on this exact device.
router.delete('/:deviceId',authenticate,(req,res)=>{
 const d=String(req.params.deviceId||'').trim(); if(!d)return res.status(400).json({message:'Biometric device information is required.'});
 const rows=readTable(TABLE); writeTable(TABLE,rows.filter(x=>!(x.userId===req.user.id&&x.deviceIdHash===hash(d)))); res.json({disabled:true});
});

module.exports=router;
