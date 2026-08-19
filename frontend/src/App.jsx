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

function SuperadminGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('rdc_token');
  useEffect(() => {
    if (!IS_SUPERADMIN_APP) return;
    if (!token && location.pathname !== '/adminlogin') navigate('/adminlogin', { replace: true });
  }, [location.pathname, navigate, token]);
  return null;
}

function AndroidUpdateModal({ update, checking, onUpdate, busy, error }) {
  if (!checking && !update) return null;
  return <div style={{position:'fixed',inset:0,zIndex:999999,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,.68)',padding:20}}>
    <div style={{width:'100%',maxWidth:430,borderRadius:18,background:'#fff',padding:24,boxShadow:'0 20px 60px rgba(0,0,0,.35)'}}>
      {checking ? <><h2 style={{margin:'0 0 8px',fontSize:22,fontWeight:700}}>Checking for updates…</h2><p style={{margin:0,color:'#555'}}>Checking the official Rizvi Diagnostic Center release.</p></> : <>
        <h2 style={{margin:'0 0 8px',fontSize:22,fontWeight:700}}>Update required</h2>
        <p style={{margin:'0 0 8px',color:'#555'}}>A newer version of {IS_SUPERADMIN_APP ? 'Rizvi Diagnostic Center Superadmin' : 'Rizvi Diagnostic Center'} is available.</p>
        <p style={{margin:'0 0 16px',fontWeight:600}}>Version {update.versionName} (build {update.versionCode})</p>
        <p style={{margin:'0 0 16px',color:'#555',fontSize:14}}>Please update before continuing. Your login and application data remain on this device.</p>
        {busy && <p style={{margin:'0 0 12px',color:'#555'}}>Downloading update…</p>}
        {error && <p style={{margin:'0 0 12px',color:'#b91c1c',fontSize:14}}>{error}</p>}
        <button type="button" onClick={onUpdate} disabled={busy} style={{width:'100%',border:0,borderRadius:10,padding:'12px 16px',background:'#111827',color:'#fff',fontWeight:700}}>{busy?'Updating…':'Update now'}</button>
      </>}
    </div>
  </div>;
}

export default function App() {
  const [refreshKey,setRefreshKey]=useState(0);
  const [androidUpdate,setAndroidUpdate]=useState(null);
  const [androidUpdateBusy,setAndroidUpdateBusy]=useState(false);
  const [androidUpdateError,setAndroidUpdateError]=useState('');
  const [androidUpdateChecking,setAndroidUpdateChecking]=useState(false);
  const lastVersion=useRef(null);
  const checkingAndroidUpdate=useRef(false);

  useEffect(()=>{
    let stopped=false;
    const checkVersion=async()=>{
      if(stopped)return;
      try{
        const response=await api.get('/sync/version',{params:{_:Date.now()},headers:{'Cache-Control':'no-cache'} });
        const version=Number(response.data?.version||0);
        if(lastVersion.current===null)lastVersion.current=version;
        else if(version!==lastVersion.current){lastVersion.current=version;setRefreshKey(v=>v+1);}
      }catch{}
    };
    checkVersion(); const timer=window.setInterval(checkVersion,REALTIME_INTERVAL_MS);
    return()=>{stopped=true;window.clearInterval(timer);};
  },[]);

  useEffect(()=>{
    if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=='android')return undefined;
    let cancelled=false;
    const checkAndroidUpdate=async()=>{
      if(cancelled||checkingAndroidUpdate.current)return;
      checkingAndroidUpdate.current=true;
      setAndroidUpdateChecking(true);
      try{
        const result=await AndroidUpdate.checkForUpdate();
        if(cancelled)return;
        if(result?.available&&result?.url){
          setAndroidUpdate({versionCode:Number(result.versionCode),versionName:result.versionName||`1.0.${Math.max(0,Number(result.versionCode)-1)}`,url:result.url,packageName:result.packageName,releaseName:result.releaseName});
        }else{
          setAndroidUpdate(null);
        }
      }catch(error){
        console.warn('Android update check failed:',error);
      }finally{
        checkingAndroidUpdate.current=false;
        if(!cancelled)setAndroidUpdateChecking(false);
      }
    };
    checkAndroidUpdate();
    const onResume=()=>{if(document.visibilityState==='visible')checkAndroidUpdate();};
    document.addEventListener('visibilitychange',onResume);window.addEventListener('focus',onResume);
    const timer=window.setInterval(checkAndroidUpdate,ANDROID_UPDATE_INTERVAL_MS);
    return()=>{cancelled=true;window.clearInterval(timer);document.removeEventListener('visibilitychange',onResume);window.removeEventListener('focus',onResume);};
  },[]);

  const installAndroidUpdate=async()=>{
    if(!androidUpdate?.url||androidUpdateBusy)return;
    setAndroidUpdateBusy(true);setAndroidUpdateError('');
    try{await AndroidUpdate.installApk({url:androidUpdate.url});}
    catch(error){setAndroidUpdateError(error?.message||'Unable to start the Android update. Please allow this app to install updates and try again.');}
    finally{setAndroidUpdateBusy(false);}
  };

  const protectedRoutes=<>
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/>
    <Route path="/patients" element={<ProtectedRoute><Patients/></ProtectedRoute>}/>
    <Route path="/patients/:id" element={<ProtectedRoute><PatientDetail/></ProtectedRoute>}/>
    <Route path="/invoices/create" element={<ProtectedRoute><CreateInvoice/></ProtectedRoute>}/>
    <Route path="/invoices" element={<ProtectedRoute><Invoices/></ProtectedRoute>}/>
    <Route path="/invoices/:id/print" element={<ProtectedRoute><InvoicePrint/></ProtectedRoute>}/>
    <Route path="/radiology-reports" element={<ProtectedRoute><RadiologyReports/></ProtectedRoute>}/>
    <Route path="/analytics" element={<ProtectedRoute><Analytics/></ProtectedRoute>}/>
    <Route path="/referrals" element={<ProtectedRoute><Referrals/></ProtectedRoute>}/>
    <Route path="/doctors" element={<ProtectedRoute><Doctors/></ProtectedRoute>}/>
    <Route path="/procedures" element={<ProtectedRoute><Procedures/></ProtectedRoute>}/>
    <Route path="/users" element={<ProtectedRoute adminOnly><Users/></ProtectedRoute>}/>
    <Route path="/settings" element={<ProtectedRoute adminOnly><Settings/></ProtectedRoute>}/>
    <Route path="/site-control" element={<ProtectedRoute superadminOnly><SiteControl/></ProtectedRoute>}/>
    <Route path="/profile" element={<ProtectedRoute><Profile/></ProtectedRoute>}/>
  </>;
  const routes=IS_SUPERADMIN_APP?<Routes><Route path="/adminlogin" element={<AdminLogin/>}/>{protectedRoutes}<Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes>:<Routes><Route path="/" element={<Home/>}/><Route path="/login" element={<Login/>}/><Route path="/adminlogin" element={<AdminLogin/>}/>{protectedRoutes}<Route path="*" element={<Navigate to="/" replace/>}/></Routes>;
  return <><SiteLockGate/>{IS_SUPERADMIN_APP&&<SuperadminGuard/>}<div key={refreshKey} className="contents">{routes}</div><AndroidUpdateModal update={androidUpdate} checking={androidUpdateChecking} busy={androidUpdateBusy} error={androidUpdateError} onUpdate={installAndroidUpdate}/></>;
}
