import React from 'react';
import Logo from './Logo.jsx';
import PaidStamp from './PaidStamp.jsx';

const numberSetting=(value,fallback,min,max)=>{const n=Number(value);if(!Number.isFinite(n))return fallback;return Math.min(max,Math.max(min,n));};

export default function PrintThermalInvoice({invoice,settings}){
 if(!invoice)return null;
 const p=invoice.patientSnapshot||{};
 const paperWidth=settings?.thermalPaperWidth||80;
 const fontSize=numberSetting(settings?.thermalFontSize,11,8,20);
 const marginTop=numberSetting(settings?.thermalMarginTop,0,0,20),marginRight=numberSetting(settings?.thermalMarginRight,0,0,20),marginBottom=numberSetting(settings?.thermalMarginBottom,0,0,30),marginLeft=numberSetting(settings?.thermalMarginLeft,0,0,20);
 const paddingTop=numberSetting(settings?.thermalPaddingTop,6,0,30),paddingRight=numberSetting(settings?.thermalPaddingRight,8,0,30),paddingBottom=numberSetting(settings?.thermalPaddingBottom,6,0,30),paddingLeft=numberSetting(settings?.thermalPaddingLeft,8,0,30);
 const sectionSpacing=numberSetting(settings?.thermalSectionSpacing,5,0,30),tableSpacing=numberSetting(settings?.thermalTableSpacing,8,0,30),cellPadding=numberSetting(settings?.thermalCellPadding,3,0,15),lineHeight=numberSetting(settings?.thermalLineHeight,1.5,1,2.5);
 const showStamp=settings?.stampEnabled!==false&&invoice.status==='paid';
 const contentStyle={width:`${paperWidth}mm`,fontSize:`${fontSize}px`,margin:`${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,padding:`${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,fontFamily:'Arial, Helvetica, sans-serif',lineHeight:String(lineHeight),backgroundColor:'#fff',color:'#000',minHeight:'100mm',position:'relative',boxSizing:'border-box'};
 return <div className="thermal-invoice mx-auto relative" style={contentStyle}>
   {showStamp&&<PaidStamp settings={settings} compact/>}
   {settings?.thermalShowLogo!==false&&settings?.logoUrl&&<div style={{display:'flex',justifyContent:'center',marginBottom:`${sectionSpacing}px`,width:'100%'}}><div style={{display:'flex',justifyContent:'center',alignItems:'center'}}><Logo settings={settings} width={settings?.thermalLogoWidth} height={settings?.thermalLogoHeight} rounded={false}/></div></div>}
   <div style={{textAlign:'center',marginBottom:`${sectionSpacing}px`}}><div style={{fontWeight:'bold',fontSize:`${fontSize+2}px`}}>{settings?.clinicName||'Rizvi Diagnostic Center'}</div><div>Address: {settings?.address}</div><div>Phone: {settings?.phone1}{settings?.phone2?` -${settings.phone2}`:''}</div></div>
   <div style={{borderTop:'1px solid black',paddingTop:`${sectionSpacing}px`,marginTop:`${sectionSpacing}px`}}><div><b>Invoice#</b> {invoice.invoiceNumber}</div><div><b>Date:</b> {new Date(invoice.createdAt).toLocaleString()}</div><div><b>Name:</b> {p.name}</div><div><b>MR#:</b> {p.mrNumber}</div>{p.phone&&<div><b>Phone:</b> {p.phone}</div>}<div><b>Age/Gender:</b> {p.age?`${p.age} Y, `:''}0 M, 0 D/ {p.gender}</div>{p.address&&<div><b>Address:</b> {p.address}</div>}{p.doctorName&&<div><b>Doctor:</b> {p.doctorName}{p.department?` (${p.department})`:''}</div>}{!p.doctorName&&invoice.patient?.doctorName&&<div><b>Doctor:</b> {invoice.patient.doctorName}{invoice.patient.department?` (${invoice.patient.department})`:''}</div>}{settings?.thermalShowReferredBy!==false&&<div><b>Referred By:</b> {invoice.referralName||'-'}</div>}</div>
   <table style={{width:'100%',marginTop:`${tableSpacing}px`,borderCollapse:'collapse'}}><thead><tr style={{borderTop:'1px solid black',borderBottom:'1px solid black'}}><th style={{textAlign:'left',padding:`${cellPadding}px 0`,fontWeight:'bold'}}>Description</th><th style={{textAlign:'right',padding:`${cellPadding}px 0`,fontWeight:'bold'}}>Amount</th></tr></thead><tbody>{invoice.items.map(it=><tr key={it.id}><td style={{padding:`${cellPadding}px 0`,borderBottom:'1px dotted #ddd'}}>{it.description}{it.quantity>1?` x${it.quantity}`:''}</td><td style={{padding:`${cellPadding}px 0`,textAlign:'right',borderBottom:'1px dotted #ddd'}}>{it.amount.toFixed(1)}</td></tr>)}</tbody></table>
   <div style={{marginTop:`${tableSpacing}px`,borderTop:'1px solid black',paddingTop:`${sectionSpacing}px`}}>{invoice.discountAmount>0&&<div style={{display:'flex',justifyContent:'space-between'}}><span>Discount:</span><span>{invoice.discountAmount.toFixed(1)}</span></div>}<div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold'}}><span>Total:</span><span>{invoice.total.toFixed(1)}</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Payment Mode:</span><span>{invoice.paymentMode}</span></div><div style={{display:'flex',justifyContent:'space-between'}}><span>Paid Amount:</span><span>{invoice.amountPaid.toFixed(1)}</span></div><div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold'}}><span>Due Amount:</span><span>Rs. {invoice.dueAmount.toFixed(1)}</span></div></div>
   <div style={{textAlign:'center',marginTop:`${tableSpacing}px`,borderTop:'1px dashed black',paddingTop:`${sectionSpacing}px`}}>{settings?.thermalFooterNote||settings?.footerNote||'Thank you for choosing Rizvi Diagnostic Center'}</div>
   <div style={{textAlign:'center',fontSize:`${Math.max(8,fontSize-1)}px`,color:'#888',marginTop:`${sectionSpacing}px`}}>Booked by: {invoice.createdByName||'-'}</div>
 </div>;
}
