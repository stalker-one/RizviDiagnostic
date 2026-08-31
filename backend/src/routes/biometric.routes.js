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
router.post('/register', authenticate, (req,res)=>{
 const d=deviceId(req), c=String(req.body?.credentialId||'').trim(); if(!d||!c)return res.status(400).json({message:'Biometric device information is required.'});
 const u=readTable('users').find(x=>x.id===req.user.id); if(!u||!u.active)return res.status(401).json({message:'User account is not available.'});
 const rows=readTable(TABLE), now=new Date().toISOString(), key=`${u.id}:${d}`; let r=rows.find(x=>x.key===key);
 const next={id:r?.id||generateId('bio'),key,userId:u.id,role:u.role,deviceIdHash:hash(d),credentialHash:hash(c),active:true,createdAt:r?.createdAt||now,updatedAt:now,lastUsedAt:r?.lastUsedAt||null};
 if(r)Object.assign(r,next);else rows.push(next); writeTable(TABLE,rows); res.json({registered:true,sessionId:next.id});
});
router.post('/login',(req,res)=>{
 const d=deviceId(req), c=String(req.body?.credentialId||'').trim(); if(!d||!c)return res.status(400).json({message:'Biometric device information is required.'});
 const rows=readTable(TABLE), r=rows.find(x=>x.active&&x.deviceIdHash===hash(d)&&x.credentialHash===hash(c)); if(!r)return res.status(401).json({message:'This fingerprint is not registered for this Android device. Please continue with your email and password.'});
 const u=readTable('users').find(x=>x.id===r.userId); if(!u||!u.active){r.active=false;r.updatedAt=new Date().toISOString();writeTable(TABLE,rows);return res.status(401).json({message:'This account is unavailable. Please continue with your email and password.'});}
 r.lastUsedAt=new Date().toISOString();r.updatedAt=r.lastUsedAt;writeTable(TABLE,rows);res.json({verified:true,token:issueToken(u),user:{id:u.id,name:u.name,email:u.email,role:u.role,phone:u.phone}});
});
router.delete('/register',authenticate,(req,res)=>{const d=deviceId(req);if(!d)return res.status(400).json({message:'Biometric device information is required.'});const rows=readTable(TABLE);writeTable(TABLE,rows.filter(x=>!(x.userId===req.user.id&&x.deviceIdHash===hash(d))));res.json({disabled:true});});
module.exports=router;
