import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';

const FIELDS = [
  ['thermalFontSize','Font size (px)',8,32,16,1],['thermalLineHeight','Line height',1,2.5,1.5,0.1],['thermalMarginTop','Top margin (px)',0,30,0,1],['thermalMarginRight','Right margin (px)',0,30,0,1],['thermalMarginBottom','Bottom margin (px)',0,30,0,1],['thermalMarginLeft','Left margin (px)',0,30,0,1],['thermalPaddingTop','Top padding (px)',0,30,6,1],['thermalPaddingRight','Right padding (px)',0,30,8,1],['thermalPaddingBottom','Bottom padding (px)',0,30,6,1],['thermalPaddingLeft','Left padding (px)',0,30,8,1],['thermalSectionSpacing','Section spacing (px)',0,30,5,1],['thermalTableSpacing','Table spacing (px)',0,30,8,1],['thermalCellPadding','Table cell padding (px)',0,15,3,1]
];
const STAMP_FIELDS=[['stampFontSize','Stamp font size (px)',8,60,26,1],['stampRotation','Rotation (degrees)',-180,180,-18,1],['stampOpacity','Opacity',0.15,1,0.82,0.05],['stampScale','Scale',0.5,2,1,0.05],['stampOffsetX','Horizontal offset (px)',-100,100,0,1],['stampOffsetY','Vertical offset (px)',-100,100,0,1],['stampBorderWidth','Border width (px)',1,8,3,1]];
const POSITIONS=[['top-left','Top left'],['top-center','Top center'],['top-right','Top right'],['center-left','Center left'],['center','Center'],['center-right','Center right'],['bottom-left','Bottom left'],['bottom-center','Bottom center'],['bottom-right','Bottom right']];
const STYLES=[['classic','Classic'],['outline','Outline'],['dashed','Dashed'],['circle','Circle'],['ribbon','Ribbon']];

function findMount(){if(window.location.pathname!=='/settings')return null;const heading=Array.from(document.querySelectorAll('h3')).find(el=>/thermal.*print.*settings/i.test(el.textContent||''));if(!heading)return null;const container=heading.closest('.bg-white')||heading.parentElement;if(!container)return null;let node=container.querySelector('#thermal-layout-settings-mount');if(!node){node=document.createElement('div');node.id='thermal-layout-settings-mount';container.appendChild(node);}return node;}

export default function ThermalSettingsEnhancer(){
 const[mount,setMount]=useState(null),[values,setValues]=useState({}),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let cancelled=false,observer,timer;const attach=()=>{const node=findMount();if(!cancelled&&node)setMount(node);};const load=async()=>{try{const res=await api.get('/settings',{params:{_:Date.now()},headers:{'Cache-Control':'no-cache'}});if(!cancelled)setValues(res.data||{});}catch{}};attach();load();observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});timer=window.setInterval(attach,300);return()=>{cancelled=true;observer?.disconnect();window.clearInterval(timer);document.getElementById('thermal-layout-settings-mount')?.remove();};},[]);
 if(!mount||window.location.pathname!=='/settings')return null;
 const set=(key,value)=>setValues(v=>({...v,[key]:value}));
 const save=async()=>{setSaving(true);setMessage('');try{const payload={...values};[...FIELDS,...STAMP_FIELDS].forEach(([key,,min,max,fallback])=>{const n=Number(values[key]);payload[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;});const res=await api.put('/settings',payload);setValues(res.data||payload);setMessage('Thermal and stamp settings saved successfully.');}catch(err){setMessage(err.response?.data?.message||'Unable to save thermal settings.');}finally{setSaving(false);}};
 return createPortal(<div className="border-t border-slate-100 pt-4 mt-4 space-y-5">
  <div><h4 className="font-semibold text-slate-700">Thermal Layout &amp; Typography</h4><p className="text-xs text-slate-500 mt-1">Fine-tune the 80mm thermal receipt.</p></div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{FIELDS.map(([key,label,min,max,fallback,step])=><div key={key}><label className="block text-xs font-medium text-slate-500 mb-1">{label}</label><input type="number" min={min} max={max} step={step} value={values[key]??fallback} onChange={e=>set(key,e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>)}</div>
  <div className="border-t border-slate-100 pt-4"><h4 className="font-semibold text-slate-700">Paid Stamp — Thermal Receipt</h4><p className="text-xs text-slate-500 mt-1">Choose exact position, design, rotation and CSS-style offsets for the PAID stamp.</p></div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp position</label><select value={values.stampPosition||'center'} onChange={e=>set('stampPosition',e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">{POSITIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp design</label><select value={values.stampStyle||'classic'} onChange={e=>set('stampStyle',e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">{STYLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp text</label><input value={values.stampText??'PAID'} onChange={e=>set('stampText',e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp color</label><input type="color" value={values.stampColor||'#c0392b'} onChange={e=>set('stampColor',e.target.value)} className="w-full h-10 border border-slate-200 rounded-lg px-2 py-1"/></div>
   {STAMP_FIELDS.map(([key,label,min,max,fallback,step])=><div key={key}><label className="block text-xs font-medium text-slate-500 mb-1">{label}</label><input type="number" min={min} max={max} step={step} value={values[key]??fallback} onChange={e=>set(key,e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>)}
   <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.stampShowClinicName!==false} onChange={e=>set('stampShowClinicName',e.target.checked)}/> Show clinic name</label>
   <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.stampShowDateTime!==false} onChange={e=>set('stampShowDateTime',e.target.checked)}/> Show date/time</label>
  </div>
  <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-60">{saving?'Saving...':'Save Thermal & Stamp Settings'}</button>{message&&<span className="text-sm text-slate-600">{message}</span>}</div>
 </div>,mount);
}
