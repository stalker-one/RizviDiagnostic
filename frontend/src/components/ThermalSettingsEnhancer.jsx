import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';

const FIELDS=[['thermalLineHeight','Line height',1,2.5,1.5,0.1],['thermalMarginTop','Top margin (px)',0,30,0,1],['thermalMarginRight','Right margin (px)',0,30,0,1],['thermalMarginBottom','Bottom margin (px)',0,30,0,1],['thermalMarginLeft','Left margin (px)',0,30,0,1],['thermalPaddingTop','Top padding (px)',0,30,6,1],['thermalPaddingRight','Right padding (px)',0,30,8,1],['thermalPaddingBottom','Bottom padding (px)',0,30,6,1],['thermalPaddingLeft','Left padding (px)',0,30,8,1],['thermalSectionSpacing','Section spacing (px)',0,30,5,1],['thermalTableSpacing','Table spacing (px)',0,30,8,1],['thermalCellPadding','Table cell padding (px)',0,15,3,1]];
const STAMP_FIELDS=[['thermalStampFontSize','Stamp font size (px)',8,60,26,1],['thermalStampRotation','Rotation (degrees)',-180,180,-18,1],['thermalStampOpacity','Opacity',0.15,1,0.82,0.05],['thermalStampScale','Scale',0.5,2,1,0.05],['thermalStampOffsetX','Horizontal offset (px)',-100,100,0,1],['thermalStampOffsetY','Vertical offset (px)',-100,100,0,1],['thermalStampBorderWidth','Border width (px)',1,8,3,1]];
const POSITIONS=[['top-left','Top left'],['top-center','Top center'],['top-right','Top right'],['center-left','Center left'],['center','Center'],['center-right','Center right'],['bottom-left','Bottom left'],['bottom-center','Bottom center'],['bottom-right','Bottom right'],['after-booked-by','After Booked by']];
const STYLES=[['classic','Classic'],['outline','Outline'],['dashed','Dashed'],['circle','Circle'],['ribbon','Ribbon']];
function findMount(){
  if(window.location.pathname!=='/settings') return null;
  const heading=Array.from(document.querySelectorAll('h3,h4')).find(el=>/thermal.*print.*settings/i.test(el.textContent||''));
  const old=document.getElementById('thermal-layout-settings-mount');
  if(!heading){old?.remove();return null;}
  const container=heading.closest('.bg-white')||heading.parentElement;
  if(!container){old?.remove();return null;}
  let node=container.querySelector('#thermal-layout-settings-mount');
  if(!node){node=document.createElement('div');node.id='thermal-layout-settings-mount';container.appendChild(node);}
  return node;
}
function unlockThermalFontSize(){Array.from(document.querySelectorAll('label')).forEach(label=>{if(!/font size\s*\(px\)/i.test(label.textContent||''))return;const input=label.querySelector('input')||label.parentElement?.querySelector('input');if(input&&input.type==='number'){input.removeAttribute('max');input.setAttribute('step','1');}});}
export default function ThermalSettingsEnhancer(){
 const[mount,setMount]=useState(null),[values,setValues]=useState({}),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let cancelled=false,observer,timer;const attach=()=>{const node=findMount();if(!cancelled)setMount(node);unlockThermalFontSize();};const load=async()=>{try{const res=await api.get('/settings',{params:{_:Date.now()},headers:{'Cache-Control':'no-cache'}});if(!cancelled)setValues(res.data||{});}catch{}};attach();load();observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});timer=window.setInterval(attach,300);return()=>{cancelled=true;observer?.disconnect();window.clearInterval(timer);document.getElementById('thermal-layout-settings-mount')?.remove();};},[]);
 if(!mount||window.location.pathname!=='/settings')return null;
 const set=(key,value)=>setValues(v=>({...v,[key]:value}));
 const save=async()=>{setSaving(true);setMessage('');try{const payload={};[...FIELDS,...STAMP_FIELDS].forEach(([key,,min,max,fallback])=>{const n=Number(values[key]);payload[key]=Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;});const font=Number(values.thermalFontSize);if(Number.isFinite(font)&&font>=8)payload.thermalFontSize=font;payload.thermalStampEnabled=values.thermalStampEnabled!==false;payload.thermalStampPosition=values.thermalStampPosition||'center';payload.thermalStampStyle=values.thermalStampStyle||'classic';payload.thermalStampText=values.thermalStampText??'PAID';payload.thermalStampColor=values.thermalStampColor||'#c0392b';payload.thermalStampShowClinicName=values.thermalStampShowClinicName!==false;payload.thermalStampShowDateTime=values.thermalStampShowDateTime!==false;const res=await api.put('/settings',payload);setValues(v=>({...v,...res.data}));setMessage('Thermal settings saved without changing Simple/A4 stamp settings.');}catch(err){setMessage(err.response?.data?.message||'Unable to save thermal settings.');}finally{setSaving(false);}};
 return createPortal(<div className="border-t border-slate-100 pt-4 mt-4 space-y-5">
  <div><h4 className="font-semibold text-slate-700">Thermal Layout</h4><p className="text-xs text-slate-500 mt-1">Thermal Font Size is controlled by Practice Settings and accepts any value 8px or higher.</p></div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{FIELDS.map(([key,label,min,max,fallback,step])=><div key={key}><label className="block text-xs font-medium text-slate-500 mb-1">{label}</label><input type="number" min={min} max={max} step={step} value={values[key]??fallback} onChange={e=>set(key,e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>)}</div>
  <div className="border-t border-slate-100 pt-4"><h4 className="font-semibold text-slate-700">Paid Stamp — Thermal Receipt</h4><p className="text-xs text-slate-500 mt-1">Thermal Paid Stamp is completely independent from the Simple/A4 Paid Stamp.</p></div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
   <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2"><input type="checkbox" checked={values.thermalStampEnabled!==false} onChange={e=>set('thermalStampEnabled',e.target.checked)}/> Show Paid Stamp on thermal receipt</label>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp position</label><select value={values.thermalStampPosition||'center'} onChange={e=>set('thermalStampPosition',e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">{POSITIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp design</label><select value={values.thermalStampStyle||'classic'} onChange={e=>set('thermalStampStyle',e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">{STYLES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp text</label><input value={values.thermalStampText??'PAID'} onChange={e=>set('thermalStampText',e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>
   <div><label className="block text-xs font-medium text-slate-500 mb-1">Stamp color</label><input type="color" value={values.thermalStampColor||'#c0392b'} onChange={e=>set('thermalStampColor',e.target.value)} className="w-full h-10 border border-slate-200 rounded-lg px-2 py-1"/></div>
   {STAMP_FIELDS.map(([key,label,min,max,fallback,step])=><div key={key}><label className="block text-xs font-medium text-slate-500 mb-1">{label}</label><input type="number" min={min} max={max} step={step} value={values[key]??fallback} onChange={e=>set(key,e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"/></div>)}
   <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.thermalStampShowClinicName!==false} onChange={e=>set('thermalStampShowClinicName',e.target.checked)}/> Show clinic name</label>
   <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={values.thermalStampShowDateTime!==false} onChange={e=>set('thermalStampShowDateTime',e.target.checked)}/> Show date/time</label>
  </div>
  <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-60">{saving?'Saving...':'Save Thermal Settings'}</button>{message&&<span className="text-sm text-slate-600">{message}</span>}</div>
 </div>,mount);
}
