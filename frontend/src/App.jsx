import React, { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor, registerPlugin } from '@capacitor/core';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import SiteLockGate from './components/SiteLockGate.jsx';
import api from './api/axios';
import Login from './pages/Login.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import CreateInvoice from './pages/CreateInvoice.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoicePrint from './pages/InvoicePrint.jsx';
import RadiologyReports from './pages/RadiologyReports.jsx';
import Analytics from './pages/Analytics.jsx';
import Referrals from './pages/Referrals.jsx';
import Doctors from './pages/Doctors.jsx';
import Procedures from './pages/Procedures.jsx';
import Users from './pages/Users.jsx';
import Settings from './pages/Settings.jsx';
import Profile from './pages/Profile.jsx';
import SiteControl from './pages/SiteControl.jsx';

const REALTIME_INTERVAL_MS = 1500;
const ANDROID_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const AndroidUpdate = registerPlugin('AndroidUpdate');
const IS_SUPERADMIN_APP = import.meta.env.VITE_SUPERADMIN_APP === 'true';

function SuperadminGuard(){const location=useLocation();const navigate=useNavigate();const token=localStorage.getItem('rdc_token');useEffect(()=>{if(!IS_SUPERADMIN_APP)return;if(!token&&location.pathname!=='/adminlogin')navigate('/adminlogin',{replace:true});},[location.pathname,navigate,token]);return null;}
function formatBytes(bytes){if(!Number.isFinite(bytes)||bytes<=0)return '';if(bytes<1024*1024)return `${(bytes/1024).toFixed(0)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`;}
function cleanReleaseNotes(notes){const lines=String(notes||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);const result=[];for(const line of lines){if(/^#?\s*(build information|technical information|release information)/i.test(line))break;if(/^(package|version code|version name|commit|release-signed apk|automatically rebuilt|release-signed|sha|workflow|github)/i.test(line))continue;if(/^#\s*(what'?s new|changes?|release notes?)/i.test(line))continue;const clean=line.replace(/^[-*•]\s*/,'').replace(/^\d+[.)]\s*/,'').trim();if(clean&&!result.includes(clean))result.push(clean);if(result.length>=8)break;}return result.length?result:['Bug fixes, performance improvements and application updates.'];}
function AndroidUpdateModal({update,checking,onUpdate,busy,error,onRetry,progress}){
  if(!checking&&!update&&!error)return null;
  const appName=IS_SUPERADMIN_APP?'Rizvi Diagnostic Center Superadmin':'Rizvi Diagnostic Center';
  const percent=Math.max(0,Math.min(100,Number(progress?.percent||0)));
  // update.releaseNotes always comes from exactly one GitHub release (the
  // "android-latest" tag, which the build workflow overwrites in place on
  // every publish), so this is already scoped to the current latest build
  // only — cleanReleaseNotes() then trims it down to just the "What's New"
  // bullets, dropping the build/version metadata section underneath.
  const changes=cleanReleaseNotes(update?.releaseNotes);
  const overlayStyle={position:'fixed',inset:0,zIndex:999999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(8,15,30,.78)',backdropFilter:'blur(10px)',padding:16};
  const cardStyle={width:'100%',maxWidth:440,maxHeight:'min(92vh,720px)',display:'flex',flexDirection:'column',borderRadius:28,background:'#fff',boxShadow:'0 32px 80px rgba(2,6,23,.45)',overflow:'hidden'};

  if(checking){
    return <div style={overlayStyle}><div style={{...cardStyle,alignItems:'center',justifyContent:'center',padding:36,textAlign:'center'}}>
      <div style={{width:52,height:52,borderRadius:'50%',border:'4px solid #e2e8f0',borderTopColor:'#4f46e5',margin:'0 auto 18px',animation:'spin .9s linear infinite'}}/>
      <h2 style={{margin:'0 0 6px',fontSize:20,fontWeight:800,color:'#0f172a'}}>Checking for updates</h2>
      <p style={{margin:0,color:'#64748b',fontSize:14}}>Looking up the latest {appName} release…</p>
    </div></div>;
  }

  if(update){
    return <div style={overlayStyle}><div style={cardStyle}>
      <div style={{flex:'0 0 auto',padding:'28px 24px 22px',background:'linear-gradient(140deg,#4338ca,#4f46e5 45%,#0891b2)',position:'relative'}}>
        <div style={{width:56,height:56,borderRadius:16,background:'rgba(255,255,255,.16)',border:'1px solid rgba(255,255,255,.35)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:14}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 19h14" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </div>
        <span style={{display:'inline-block',fontSize:11,fontWeight:800,color:'#0f172a',background:'#fde047',padding:'4px 10px',borderRadius:999,letterSpacing:.4,marginBottom:10}}>UPDATE REQUIRED</span>
        <h2 style={{margin:'0 0 4px',fontSize:23,fontWeight:850,color:'#fff'}}>{appName}</h2>
        <p style={{margin:0,color:'rgba(255,255,255,.85)',fontSize:13.5}}>A new version is available and must be installed to continue.</p>
      </div>

      <div style={{flex:'1 1 auto',minHeight:0,overflowY:'auto',padding:'20px 24px 6px',WebkitOverflowScrolling:'touch'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20}}>
          <div style={{flex:1,padding:'11px 13px',borderRadius:14,border:'1px solid #e2e8f0',background:'#f8fafc'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#94a3b8',letterSpacing:.5}}>INSTALLED</div>
            <div style={{fontSize:16,fontWeight:800,color:'#0f172a',marginTop:2}}>{update.installedVersionName||'Unknown'}</div>
            <div style={{fontSize:11,color:'#94a3b8'}}>Build {update.installedVersionCode??'—'}</div>
          </div>
          <div style={{flex:'0 0 auto',width:30,height:30,borderRadius:'50%',background:'#eef2ff',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m0 0-5-5m5 5-5 5" stroke="#4f46e5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{flex:1,padding:'11px 13px',borderRadius:14,border:'1px solid #c7d2fe',background:'#eef2ff'}}>
            <div style={{fontSize:10,fontWeight:800,color:'#4f46e5',letterSpacing:.5}}>LATEST</div>
            <div style={{fontSize:16,fontWeight:800,color:'#0f172a',marginTop:2}}>{update.versionName}</div>
            <div style={{fontSize:11,color:'#4338ca'}}>Build {update.versionCode}</div>
          </div>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800,color:'#0f172a'}}>What's new in {update.versionName}</h3>
          <span style={{fontSize:10.5,fontWeight:800,color:'#4f46e5',background:'#eef2ff',padding:'4px 9px',borderRadius:999,whiteSpace:'nowrap'}}>Current release only</span>
        </div>
        <div style={{display:'grid',gap:7,marginBottom:16}}>
          {changes.map((change,i)=><div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',borderRadius:12,background:'#f8fafc',border:'1px solid #eef2f7'}}>
            <span style={{flex:'0 0 20px',height:20,marginTop:1,borderRadius:'50%',background:'#e0e7ff',color:'#4338ca',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>✓</span>
            <span style={{fontSize:13.5,lineHeight:1.45,color:'#334155'}}>{change}</span>
          </div>)}
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:12,background:'#f8fafc',marginBottom:12}}>
          <span style={{fontSize:12.5,color:'#64748b'}}>Download size</span>
          <strong style={{fontSize:12.5,color:'#0f172a'}}>{formatBytes(update.sizeBytes)||`${update.sizeMB||'—'} MB`}</strong>
        </div>
      </div>

      <div style={{flex:'0 0 auto',padding:'14px 24px 20px',borderTop:'1px solid #e2e8f0',background:'#fff',boxShadow:'0 -8px 20px rgba(15,23,42,.06)'}}>
        {busy&&<div style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,color:'#475569',marginBottom:6}}><span>Downloading update</span><strong>{percent}%</strong></div>
          <div style={{height:9,width:'100%',background:'#e2e8f0',borderRadius:999,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${percent}%`,background:'linear-gradient(90deg,#4f46e5,#0891b2)',transition:'width .2s ease'}}/>
          </div>
          <div style={{fontSize:11,color:'#94a3b8',marginTop:5}}>{formatBytes(progress?.downloadedBytes)}{progress?.totalBytes>0?` / ${formatBytes(progress.totalBytes)}`:''}</div>
        </div>}
        {error&&<p style={{margin:'0 0 10px',color:'#b91c1c',fontSize:12.5,wordBreak:'break-word'}}>{error}</p>}
        <button type="button" onClick={onUpdate} disabled={busy} style={{width:'100%',border:0,borderRadius:14,padding:'15px 16px',background:busy?'#94a3b8':'linear-gradient(120deg,#4f46e5,#4338ca)',color:'#fff',fontWeight:800,fontSize:15,boxShadow:busy?'none':'0 10px 24px rgba(79,70,229,.35)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {!busy&&<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 4v11m0 0 4-4m-4 4-4-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 19h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"/></svg>}
          {busy?`Updating… ${percent}%`:'Update now'}
        </button>
      </div>
    </div></div>;
  }

  return <div style={overlayStyle}><div style={{...cardStyle,alignItems:'stretch',justifyContent:'center',padding:28}}>
    <div style={{width:48,height:48,borderRadius:14,background:'#fee2e2',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:16}}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 8v5m0 3.5h.01" stroke="#b91c1c" strokeWidth="2.4" strokeLinecap="round"/><circle cx="12" cy="12" r="9" stroke="#b91c1c" strokeWidth="2"/></svg>
    </div>
    <h2 style={{margin:'0 0 8px',fontSize:19,fontWeight:800,color:'#0f172a'}}>Update check failed</h2>
    <p style={{margin:'0 0 14px',color:'#64748b',fontSize:13.5}}>The latest {appName} version could not be verified.</p>
    <p style={{margin:'0 0 16px',color:'#b91c1c',fontSize:12.5,wordBreak:'break-word'}}>{error}</p>
    <button type="button" onClick={onRetry} style={{width:'100%',border:0,borderRadius:13,padding:'13px 16px',background:'#0f172a',color:'#fff',fontWeight:700,fontSize:14.5}}>Check again</button>
  </div></div>;
}
function StaffEntryRoute(){const token=localStorage.getItem('rdc_token');if(token)return <Navigate to="/dashboard" replace/>;return <Home/>;}

export default function App(){const[refreshKey,setRefreshKey]=useState(0);const[androidUpdate,setAndroidUpdate]=useState(null);const[androidUpdateBusy,setAndroidUpdateBusy]=useState(false);const[androidUpdateError,setAndroidUpdateError]=useState('');const[androidUpdateChecking,setAndroidUpdateChecking]=useState(false);const[androidUpdateProgress,setAndroidUpdateProgress]=useState({percent:0,downloadedBytes:0,totalBytes:0});const checkingAndroidUpdate=useRef(false);const retryCheckRef=useRef(null);const lastVersionRef=useRef(null);
 useEffect(()=>{let stopped=false;const checkVersion=async()=>{if(stopped)return;try{const response=await api.get('/sync/version',{params:{_:Date.now()},headers:{'Cache-Control':'no-cache'}});const version=Number(response.data?.version||0);if(lastVersionRef.current!==null&&version!==lastVersionRef.current)setRefreshKey(v=>v+1);lastVersionRef.current=version;}catch{}};checkVersion();const timer=window.setInterval(checkVersion,REALTIME_INTERVAL_MS);return()=>{stopped=true;window.clearInterval(timer);};},[]);
 useEffect(()=>{if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android')return undefined;let cancelled=false;let progressListener;const checkAndroidUpdate=async()=>{if(cancelled||checkingAndroidUpdate.current)return;checkingAndroidUpdate.current=true;setAndroidUpdateChecking(true);setAndroidUpdateError('');try{if(typeof AndroidUpdate.checkForUpdate!=='function')throw new Error('Android update service is not available in this app version.');const result=await AndroidUpdate.checkForUpdate();if(cancelled)return;if(result?.available&&result?.url){setAndroidUpdate({versionCode:Number(result.versionCode),versionName:result.versionName||`1.0.${Math.max(0,Number(result.versionCode)-1)}`,url:result.url,packageName:result.packageName,releaseName:result.releaseName,releaseNotes:result.releaseNotes||'',installedVersionCode:Number(result.installedVersionCode),installedVersionName:result.installedVersionName||'',sizeBytes:Number(result.sizeBytes||0),sizeMB:Number(result.sizeMB||0)});}else setAndroidUpdate(null);}catch(error){if(!cancelled)setAndroidUpdateError(error?.message||String(error)||'Unable to check the latest application version.');}finally{checkingAndroidUpdate.current=false;if(!cancelled)setAndroidUpdateChecking(false);}};retryCheckRef.current=checkAndroidUpdate;AndroidUpdate.addListener('updateProgress',(event)=>{if(!cancelled)setAndroidUpdateProgress(event||{percent:0});}).then(listener=>{progressListener=listener;});checkAndroidUpdate();const onResume=()=>{if(document.visibilityState==='visible')checkAndroidUpdate();};document.addEventListener('visibilitychange',onResume);window.addEventListener('focus',onResume);const timer=window.setInterval(checkAndroidUpdate,ANDROID_UPDATE_INTERVAL_MS);return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',onResume);window.removeEventListener('focus',onResume);retryCheckRef.current=null;progressListener?.remove?.();};},[]);
 const installAndroidUpdate=async()=>{if(!androidUpdate?.url||androidUpdateBusy)return;setAndroidUpdateBusy(true);setAndroidUpdateError('');setAndroidUpdateProgress({percent:0,downloadedBytes:0,totalBytes:androidUpdate.sizeBytes||0});try{await AndroidUpdate.installApk({url:androidUpdate.url});}catch(error){setAndroidUpdateError(error?.message||'Unable to start the Android update. Please allow installation and try again.');}finally{setAndroidUpdateBusy(false);}};
 const protectedRoutes=<><Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/><Route path="/patients" element={<ProtectedRoute><Patients/></ProtectedRoute>}/><Route path="/patients/:id" element={<ProtectedRoute><PatientDetail/></ProtectedRoute>}/><Route path="/invoices/create" element={<ProtectedRoute><CreateInvoice/></ProtectedRoute>}/><Route path="/invoices" element={<ProtectedRoute><Invoices/></ProtectedRoute>}/><Route path="/invoices/:id/print" element={<ProtectedRoute><InvoicePrint/></ProtectedRoute>}/><Route path="/radiology-reports" element={<ProtectedRoute><RadiologyReports/></ProtectedRoute>}/><Route path="/analytics" element={<ProtectedRoute><Analytics/></ProtectedRoute>}/><Route path="/referrals" element={<ProtectedRoute><Referrals/></ProtectedRoute>}/><Route path="/doctors" element={<ProtectedRoute><Doctors/></ProtectedRoute>}/><Route path="/procedures" element={<ProtectedRoute><Procedures/></ProtectedRoute>}/><Route path="/users" element={<ProtectedRoute adminOnly><Users/></ProtectedRoute>}/><Route path="/settings" element={<ProtectedRoute adminOnly><Settings/></ProtectedRoute>}/><Route path="/site-control" element={<ProtectedRoute superadminOnly><SiteControl/></ProtectedRoute>}/><Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>}/></>;
 const routes=IS_SUPERADMIN_APP?<Routes><Route path="/adminlogin" element={<AdminLogin/>}/>{protectedRoutes}<Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>:<Routes><Route path="/" element={<StaffEntryRoute/>}/><Route path="/login" element={<Login/>}/><Route path="/adminlogin" element={<AdminLogin/>}/>{protectedRoutes}<Route path="*" element={<Navigate to="/" replace/>}/></Routes>;
 return <><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style><SiteLockGate/>{IS_SUPERADMIN_APP&&<SuperadminGuard/>}<div key={refreshKey} className="contents">{routes}</div><AndroidUpdateModal update={androidUpdate} checking={androidUpdateChecking} busy={androidUpdateBusy} error={androidUpdateError} progress={androidUpdateProgress} onUpdate={installAndroidUpdate} onRetry={()=>retryCheckRef.current?.()}/></>;
}
