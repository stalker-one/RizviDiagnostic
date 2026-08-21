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

// The update modal shows ONLY the first/current release change. It never displays
// historical release sections or a rolling list of older updates.
function cleanReleaseNotes(notes){
 const raw=String(notes||'').replace(/\r/g,'').trim();
 if(!raw)return ['Latest update: bug fixes and improvements.'];
 const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);
 const versionHeading=/^#{0,6}\s*(?:v(?:ersion)?\s*)?\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?\s*$/i;
 const datedHeading=/^#{0,6}\s*(?:release|version|what'?s new|changes?)\s*[:\-]?\s*(?:v)?\d+\.\d+(?:\.\d+)?/i;
 let start=-1;
 for(let i=0;i<lines.length;i++){if(versionHeading.test(lines[i])||datedHeading.test(lines[i])){start=i;break;}}
 const current=start>=0?lines.slice(start+1):lines;
 for(const line of current){
  if(/^#?\s*(build information|technical information|release information|installation|assets?)\b/i.test(line))break;
  if(/^(package|version code|version name|commit|release-signed apk|automatically rebuilt|release-signed|sha|workflow|github|artifact|download|full changelog)\b/i.test(line))continue;
  if(/^#\s*(what'?s new|changes?|release notes?)\s*$/i.test(line))continue;
  const clean=line.replace(/^[-*•]\s*/,'').replace(/^\d+[.)]\s*/,'').trim();
  if(clean)return [clean];
 }
 return ['Latest update: bug fixes and improvements.'];
}

function AndroidUpdateModal({update,checking,onUpdate,onClose,busy,error,onRetry,progress}){
 if(!checking&&!update&&!error)return null;
 const appName=IS_SUPERADMIN_APP?'Rizvi Diagnostic Center Superadmin':'Rizvi Diagnostic Center';
 const percent=Math.max(0,Math.min(100,Number(progress?.percent||0)));
 const changes=cleanReleaseNotes(update?.releaseNotes);
 const close=()=>{if(!busy)onClose?.();};
 return <div style={{position:'fixed',inset:0,zIndex:999999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(15,23,42,.72)',backdropFilter:'blur(8px)',padding:12}}>
  <div style={{position:'relative',width:'100%',maxWidth:480,height:'min(92vh,760px)',display:'flex',flexDirection:'column',borderRadius:24,background:'#fff',boxShadow:'0 30px 90px rgba(0,0,0,.35)',overflow:'hidden'}}>
   {checking?<div style={{padding:28,textAlign:'center',margin:'auto'}}><div style={{width:46,height:46,borderRadius:'50%',border:'4px solid #e5e7eb',borderTopColor:'#2563eb',margin:'0 auto 16px',animation:'spin 1s linear infinite'}}/><h2 style={{margin:'0 0 6px',fontSize:22,fontWeight:800,color:'#0f172a'}}>Checking for updates</h2><p style={{margin:0,color:'#64748b'}}>Checking the latest {appName} version.</p></div>
   :update?<>
    <div style={{position:'relative',flex:'0 0 auto',padding:'22px 58px 18px 22px',background:'linear-gradient(135deg,#eff6ff,#f8fafc)',borderBottom:'1px solid #e2e8f0'}}>
     <button type="button" aria-label="Close update modal" title="Close" onClick={close} disabled={busy} style={{position:'absolute',top:12,right:12,width:38,height:38,border:'1px solid #cbd5e1',borderRadius:'50%',background:'#fff',color:'#334155',fontSize:24,lineHeight:1,cursor:busy?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 10px rgba(15,23,42,.08)',opacity:busy?.55:1}}>×</button>
     <div style={{fontSize:12,fontWeight:800,color:'#2563eb',textTransform:'uppercase',letterSpacing:1}}>New version available</div><h2 style={{margin:'7px 0 5px',fontSize:25,fontWeight:850,color:'#0f172a'}}>Update required</h2><p style={{margin:0,color:'#475569',fontSize:14}}>A newer version of {appName} is ready to install.</p>
    </div>
    <div style={{flex:'1 1 auto',minHeight:0,overflowY:'auto',padding:'20px 22px 8px',WebkitOverflowScrolling:'touch'}}>
     <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}><div style={{padding:13,borderRadius:14,border:'1px solid #e2e8f0',background:'#f8fafc'}}><div style={{fontSize:11,fontWeight:700,color:'#64748b'}}>CURRENT</div><div style={{fontSize:17,fontWeight:800,color:'#0f172a',marginTop:4}}>{update.installedVersionName||'Unknown'}</div><div style={{fontSize:12,color:'#64748b'}}>Build {update.installedVersionCode??'—'}</div></div><div style={{padding:13,borderRadius:14,border:'1px solid #bfdbfe',background:'#eff6ff'}}><div style={{fontSize:11,fontWeight:700,color:'#2563eb'}}>NEW</div><div style={{fontSize:17,fontWeight:800,color:'#0f172a',marginTop:4}}>{update.versionName}</div><div style={{fontSize:12,color:'#475569'}}>Build {update.versionCode}</div></div></div>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><h3 style={{margin:0,fontSize:17,fontWeight:800,color:'#0f172a'}}>What’s New</h3><span style={{fontSize:11,fontWeight:700,color:'#2563eb',background:'#dbeafe',padding:'5px 9px',borderRadius:999}}>Latest update only</span></div>
     <div style={{display:'grid',gap:8,marginBottom:16}}>{changes.map((change,i)=><div key={i} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',borderRadius:12,background:'#f8fafc',border:'1px solid #eef2f7'}}><span style={{flex:'0 0 22px',height:22,borderRadius:'50%',background:'#dbeafe',color:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800}}>✓</span><span style={{fontSize:14,lineHeight:1.45,color:'#334155'}}>{change}</span></div>)}</div>
     <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 12px',borderRadius:12,background:'#f8fafc',marginBottom:12}}><span style={{fontSize:13,color:'#64748b'}}>Download size</span><strong style={{fontSize:13,color:'#0f172a'}}>{formatBytes(update.sizeBytes)||`${update.sizeMB||'—'} MB`}</strong></div>
    </div>
    <div style={{flex:'0 0 auto',padding:'12px 22px 18px',borderTop:'1px solid #e2e8f0',background:'#fff',boxShadow:'0 -8px 20px rgba(15,23,42,.06)'}}>{busy&&<div style={{marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:'#475569',marginBottom:6}}><span>Downloading update</span><strong>{percent}%</strong></div><div style={{height:9,width:'100%',background:'#e2e8f0',borderRadius:999,overflow:'hidden'}}><div style={{height:'100%',width:`${percent}%`,background:'linear-gradient(90deg,#2563eb,#06b6d4)',transition:'width .2s ease'}}/></div><div style={{fontSize:11,color:'#64748b',marginTop:5}}>{formatBytes(progress?.downloadedBytes)}{progress?.totalBytes>0?` / ${formatBytes(progress.totalBytes)}`:''}</div></div>}{error&&<p style={{margin:'0 0 10px',color:'#b91c1c',fontSize:13,wordBreak:'break-word'}}>{error}</p>}<button type="button" onClick={onUpdate} disabled={busy} style={{width:'100%',border:0,borderRadius:13,padding:'14px 16px',background:busy?'#64748b':'#2563eb',color:'#fff',fontWeight:800,fontSize:15,boxShadow:'0 8px 20px rgba(37,99,235,.22)'}}>{busy?`Updating ${percent}%…`:'Update now'}</button></div>
   </>
   :<div style={{position:'relative',padding:24,margin:'auto'}}><button type="button" aria-label="Close update error" title="Close" onClick={close} style={{position:'absolute',top:0,right:0,width:36,height:36,border:'1px solid #cbd5e1',borderRadius:'50%',background:'#fff',color:'#334155',fontSize:23,lineHeight:1,cursor:'pointer'}}>×</button><h2 style={{margin:'0 0 8px',fontSize:22,fontWeight:800}}>Update check failed</h2><p style={{margin:'0 0 16px',color:'#64748b'}}>The latest application version could not be verified.</p><p style={{margin:'0 0 16px',color:'#b91c1c',fontSize:13,wordBreak:'break-word'}}>{error}</p><button type="button" onClick={onRetry} style={{width:'100%',border:0,borderRadius:12,padding:'12px 16px',background:'#0f172a',color:'#fff',fontWeight:700}}>Check again</button></div>}
  </div>
 </div>;
}

function StaffEntryRoute(){const token=localStorage.getItem('rdc_token');if(token)return <Navigate to="/dashboard" replace/>;return <Home/>;}

export default function App(){
 const[refreshKey,setRefreshKey]=useState(0);const[androidUpdate,setAndroidUpdate]=useState(null);const[androidUpdateBusy,setAndroidUpdateBusy]=useState(false);const[androidUpdateError,setAndroidUpdateError]=useState('');const[androidUpdateChecking,setAndroidUpdateChecking]=useState(false);const[androidUpdateProgress,setAndroidUpdateProgress]=useState({percent:0,downloadedBytes:0,totalBytes:0});
 const checkingAndroidUpdate=useRef(false);const retryCheckRef=useRef(null);const lastVersionRef=useRef(null);const dismissedUpdateCodeRef=useRef(null);
 useEffect(()=>{let stopped=false;const checkVersion=async()=>{if(stopped)return;try{const response=await api.get('/sync/version',{params:{_:Date.now()},headers:{'Cache-Control':'no-cache'}});const version=Number(response.data?.version||0);if(lastVersionRef.current!==null&&version!==lastVersionRef.current)setRefreshKey(v=>v+1);lastVersionRef.current=version;}catch{}};checkVersion();const timer=window.setInterval(checkVersion,REALTIME_INTERVAL_MS);return()=>{stopped=true;window.clearInterval(timer);};},[]);
 useEffect(()=>{if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android')return undefined;let cancelled=false;let progressListener;
  const checkAndroidUpdate=async()=>{if(cancelled||checkingAndroidUpdate.current)return;checkingAndroidUpdate.current=true;setAndroidUpdateChecking(true);setAndroidUpdateError('');try{if(typeof AndroidUpdate.checkForUpdate!=='function')throw new Error('Android update service is not available in this app version.');const result=await AndroidUpdate.checkForUpdate();if(cancelled)return;if(result?.available&&result?.url){const code=Number(result.versionCode);if(dismissedUpdateCodeRef.current===code){setAndroidUpdate(null);}else{setAndroidUpdate({versionCode:code,versionName:result.versionName||`1.0.${Math.max(0,code)}`,url:result.url,packageName:result.packageName,releaseName:result.releaseName,releaseNotes:result.releaseNotes||'',installedVersionCode:Number(result.installedVersionCode),installedVersionName:result.installedVersionName||'',sizeBytes:Number(result.sizeBytes||0),sizeMB:Number(result.sizeMB||0)});}}else setAndroidUpdate(null);}catch(error){if(!cancelled)setAndroidUpdateError(error?.message||String(error)||'Unable to check the latest application version.');}finally{checkingAndroidUpdate.current=false;if(!cancelled)setAndroidUpdateChecking(false);}};
  retryCheckRef.current=checkAndroidUpdate;AndroidUpdate.addListener('updateProgress',(event)=>{if(!cancelled)setAndroidUpdateProgress(event||{percent:0});}).then(listener=>{progressListener=listener;});checkAndroidUpdate();const onResume=()=>{if(document.visibilityState==='visible')checkAndroidUpdate();};document.addEventListener('visibilitychange',onResume);window.addEventListener('focus',onResume);const timer=window.setInterval(checkAndroidUpdate,ANDROID_UPDATE_INTERVAL_MS);return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',onResume);window.removeEventListener('focus',onResume);retryCheckRef.current=null;progressListener?.remove?.();};
 },[]);
 const closeAndroidUpdate=()=>{if(androidUpdateBusy)return;if(androidUpdate?.versionCode)dismissedUpdateCodeRef.current=Number(androidUpdate.versionCode);setAndroidUpdate(null);setAndroidUpdateError('');setAndroidUpdateProgress({percent:0,downloadedBytes:0,totalBytes:0});};
 const installAndroidUpdate=async()=>{if(!androidUpdate?.url||androidUpdateBusy)return;setAndroidUpdateBusy(true);setAndroidUpdateError('');setAndroidUpdateProgress({percent:0,downloadedBytes:0,totalBytes:androidUpdate.sizeBytes||0});try{await AndroidUpdate.installApk({url:androidUpdate.url});}catch(error){setAndroidUpdateError(error?.message||'Unable to start the Android update. Please allow installation and try again.');}finally{setAndroidUpdateBusy(false);}};
 const protectedRoutes=<><Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/><Route path="/patients" element={<ProtectedRoute><Patients/></ProtectedRoute>}/><Route path="/patients/:id" element={<ProtectedRoute><PatientDetail/></ProtectedRoute>}/><Route path="/invoices/create" element={<ProtectedRoute><CreateInvoice/></ProtectedRoute>}/><Route path="/invoices" element={<ProtectedRoute><Invoices/></ProtectedRoute>}/><Route path="/invoices/:id/print" element={<ProtectedRoute><InvoicePrint/></ProtectedRoute>}/><Route path="/radiology-reports" element={<ProtectedRoute><RadiologyReports/></ProtectedRoute>}/><Route path="/analytics" element={<ProtectedRoute><Analytics/></ProtectedRoute>}/><Route path="/referrals" element={<ProtectedRoute><Referrals/></ProtectedRoute>}/><Route path="/doctors" element={<ProtectedRoute><Doctors/></ProtectedRoute>}/><Route path="/procedures" element={<ProtectedRoute><Procedures/></ProtectedRoute>}/><Route path="/users" element={<ProtectedRoute adminOnly><Users/></ProtectedRoute>}/><Route path="/settings" element={<ProtectedRoute adminOnly><Settings/></ProtectedRoute>}/><Route path="/site-control" element={<ProtectedRoute superadminOnly><SiteControl/></ProtectedRoute>}/><Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>}/></>;
 const routes=IS_SUPERADMIN_APP?<Routes><Route path="/adminlogin" element={<AdminLogin/>}/>{protectedRoutes}<Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>:<Routes><Route path="/" element={<StaffEntryRoute/>}/><Route path="/login" element={<Login/>}/><Route path="/adminlogin" element={<AdminLogin/>}/>{protectedRoutes}<Route path="*" element={<Navigate to="/" replace/>}/></Routes>;
 return <><style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style><SiteLockGate/>{IS_SUPERADMIN_APP&&<SuperadminGuard/>}<div key={refreshKey} className="contents">{routes}</div><AndroidUpdateModal update={androidUpdate} checking={androidUpdateChecking} busy={androidUpdateBusy} error={androidUpdateError} progress={androidUpdateProgress} onUpdate={installAndroidUpdate} onClose={closeAndroidUpdate} onRetry={()=>retryCheckRef.current?.()}/></>;
}
