import React from 'react';
import Logo from './Logo.jsx';
import PaidStamp from './PaidStamp.jsx';

const numberSetting=(value,fallback,min,max)=>{const n=Number(value);if(!Number.isFinite(n))return fallback;return Math.min(max,Math.max(min,n));};
const openNumber=(value,fallback,min)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,n):fallback;};
const safeText=(value)=>value===null||value===undefined||value===''?'-':String(value);
const amount=(value)=>{const n=Number(value);if(!Number.isFinite(n))return '0.0';return Number.isInteger(n)?n.toString():n.toFixed(1);};

export default function PrintThermalInvoice({invoice,settings}){
 if(!invoice)return null;
 const p=invoice.patientSnapshot||{};
 const paperWidth=numberSetting(settings?.thermalPaperWidth,80,58,80);
 const printableWidth=numberSetting(settings?.thermalPrintableWidth,Math.min(72,paperWidth-8),48,paperWidth);
 const fontSize=openNumber(settings?.thermalFontSize,11,8);
 const marginTop=numberSetting(settings?.thermalMarginTop,0,0,30),marginBottom=numberSetting(settings?.thermalMarginBottom,0,0,30);
 const paddingTop=numberSetting(settings?.thermalPaddingTop,4,0,20),paddingRight=numberSetting(settings?.thermalPaddingRight,0,0,10),paddingBottom=numberSetting(settings?.thermalPaddingBottom,4,0,20),paddingLeft=numberSetting(settings?.thermalPaddingLeft,0,0,10);
 const sectionSpacing=numberSetting(settings?.thermalSectionSpacing,5,0,30),tableSpacing=numberSetting(settings?.thermalTableSpacing,8,0,30),cellPadding=numberSetting(settings?.thermalCellPadding,3,0,15),lineHeight=numberSetting(settings?.thermalLineHeight,1.4,1,2.5);
 const showStamp=settings?.thermalStampEnabled!==false&&invoice.status==='paid';
 const stampAfterBookedBy=settings?.thermalStampPosition==='after-booked-by';
 const stampBeforeThankYou=settings?.thermalStampPosition==='before-thank-you';
 const pageStyle=`@page{size:${paperWidth}mm 297mm;margin:0!important;}html,body{margin:0!important;padding:0!important;}@media print{html,body{width:${paperWidth}mm!important;max-width:${paperWidth}mm!important;margin:0!important;padding:0!important;}.thermal-invoice{width:${printableWidth}mm!important;max-width:${printableWidth}mm!important;margin:0 auto!important;padding:${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}.thermal-invoice *{box-sizing:border-box;min-width:0;max-width:100%;overflow-wrap:anywhere;word-break:normal;white-space:normal;}.thermal-invoice table{width:100%!important;max-width:100%!important;table-layout:fixed!important;border-collapse:collapse!important;}.thermal-invoice th,.thermal-invoice td{min-width:0!important;max-width:100%!important;overflow-wrap:anywhere!important;word-break:break-word!important;white-space:normal!important;}.thermal-invoice .thermal-amount{white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;text-align:right!important;}.thermal-invoice .thermal-row{display:flex;width:100%;min-width:0;gap:4px;}.thermal-invoice .thermal-label{flex:0 0 auto;max-width:42%;white-space:nowrap;}.thermal-invoice .thermal-value{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;word-break:normal;white-space:normal;}.thermal-invoice .thermal-total{display:flex;width:100%;min-width:0;gap:12px;justify-content:space-between;}.thermal-invoice .thermal-total-label{flex:0 0 auto;min-width:0;overflow-wrap:anywhere;}.thermal-invoice .thermal-total-value{flex:0 0 auto;white-space:nowrap;text-align:right;}}`;
 const contentStyle={width:`${printableWidth}mm`,maxWidth:`${printableWidth}mm`,fontSize:`${fontSize}px`,margin:`${marginTop}px auto ${marginBottom}px`,padding:`${paddingTop}px ${paddingRight}px ${paddingBottom}px ${paddingLeft}px`,fontFamily:'Arial, Helvetica, sans-serif',lineHeight:String(lineHeight),backgroundColor:'#fff',color:'#000',minHeight:'100mm',position:'relative',boxSizing:'border-box',overflowWrap:'anywhere',wordBreak:'normal',whiteSpace:'normal'};
 const row=(label,value)=><div className="thermal-row"><b className="thermal-label">{label}</b><span className="thermal-value">{safeText(value)}</span></div>;
 const bookedBy=<div style={{textAlign:'center',fontSize:`${Math.max(8,fontSize-1)}px`,fontWeight:'bold',color:'#000',marginTop:`${sectionSpacing}px`,width:'100%',overflowWrap:'anywhere'}}>Booked by: {safeText(invoice.createdByName)}</div>;
 const doctor=p.doctorName?`${safeText(p.doctorName)}${p.department?` (${safeText(p.department)})`:''}`:invoice.patient?.doctorName?`${safeText(invoice.patient.doctorName)}${invoice.patient.department?` (${safeText(invoice.patient.department)})`:''}`:null;
 const thermalStampSettings={
   ...settings,
   thermalStampFontSize: settings?.thermalStampFontSize ?? settings?.thermalStampFontSizePx,
   thermalStampClinicNameFontSize: settings?.thermalStampClinicNameFontSize ?? settings?.thermalStampClinicNameFontSizePx,
   thermalStampDateTimeFontSize: settings?.thermalStampDateTimeFontSize ?? settings?.thermalStampDateTimeFontSizePx,
   thermalStampWidth: settings?.thermalStampWidth,
   thermalStampHeight: settings?.thermalStampHeight,
 };
 return <><style>{pageStyle}</style><div className="thermal-invoice relative" style={contentStyle}>
   {showStamp&&!stampAfterBookedBy&&!stampBeforeThankYou&&<PaidStamp settings={thermalStampSettings} compact variant="thermal"/>}
   {settings?.thermalShowLogo!==false&&settings?.logoUrl&&<div style={{display:'flex',justifyContent:'center',alignItems:'center',marginBottom:`${sectionSpacing}px`,width:'100%',maxWidth:'100%',overflow:'hidden'}}><Logo settings={settings} width={settings?.thermalLogoWidth} height={settings?.thermalLogoHeight} rounded={false}/></div>}
   <div style={{textAlign:'center',marginBottom:`${sectionSpacing}px`,width:'100%',maxWidth:'100%',overflowWrap:'anywhere'}}><div style={{fontWeight:'bold',fontSize:`${settings?.thermalClinicNameFontSize||fontSize+2}px`}}>{safeText(settings?.clinicName||'Rizvi Diagnostic Center')}</div>{settings?.address&&<div>Address: {safeText(settings.address)}</div>}{(settings?.phone1||settings?.phone2)&&<div>Phone: {safeText(settings.phone1)}{settings?.phone2?` - ${safeText(settings.phone2)}`:''}</div>}</div>
   <div style={{borderTop:'1px solid black',paddingTop:`${sectionSpacing}px`,marginTop:`${sectionSpacing}px`,width:'100%',maxWidth:'100%'}}>{row('Invoice#',invoice.invoiceNumber)}{row('Date:',invoice.createdAt?new Date(invoice.createdAt).toLocaleString():'-')}{row('Name:',p.name)}{row('MR#:',p.mrNumber)}{p.phone&&row('Phone:',p.phone)}{row('Age/Gender:',`${p.age?`${p.age} Y, `:''}0 M, 0 D / ${safeText(p.gender)}`)}{p.address&&row('Address:',p.address)}{doctor&&row('Doctor:',doctor)}{settings?.thermalShowReferredBy!==false&&row('Referred By:',invoice.referralName)}</div>
   <table style={{width:'100%',maxWidth:'100%',marginTop:`${tableSpacing}px`,borderCollapse:'collapse',tableLayout:'fixed'}}><colgroup><col style={{width:'72%'}}/><col style={{width:'28%'}}/></colgroup><thead><tr style={{borderTop:'1px solid black',borderBottom:'1px solid black'}}><th style={{textAlign:'left',padding:`${cellPadding}px 0`,fontWeight:'bold'}}>Description</th><th className="thermal-amount" style={{textAlign:'right',padding:`${cellPadding}px 0`,fontWeight:'bold'}}>Amount</th></tr></thead><tbody>{(invoice.items||[]).map((it,index)=><tr key={it.id||index}><td style={{padding:`${cellPadding}px 2px ${cellPadding}px 0`,borderBottom:'1px dotted #ddd',verticalAlign:'top',overflowWrap:'anywhere'}}>{safeText(it.description)}{Number(it.quantity)>1?` x${it.quantity}`:''}</td><td className="thermal-amount" style={{padding:`${cellPadding}px 0 ${cellPadding}px 2px`,textAlign:'right',borderBottom:'1px dotted #ddd',verticalAlign:'top',whiteSpace:'nowrap'}}>{amount(it.amount)}</td></tr>)}</tbody></table>
   <div style={{marginTop:`${tableSpacing}px`,borderTop:'1px solid black',paddingTop:`${sectionSpacing}px`,width:'100%',maxWidth:'100%'}}>
     {Number(invoice.discountAmount)>0 && <div className="thermal-total" style={{display:'flex',justifyContent:'space-between',width:'100%',gap:'12px'}}><span className="thermal-total-label" style={{flex:'0 0 auto'}}>Discount:</span><span className="thermal-total-value" style={{flex:'0 0 auto',textAlign:'right'}}>{amount(invoice.discountAmount)}</span></div>}
     <div className="thermal-total" style={{display:'flex',justifyContent:'space-between',width:'100%',gap:'12px',fontWeight:'bold'}}><span className="thermal-total-label" style={{flex:'0 0 auto'}}>Total:</span><span className="thermal-total-value" style={{flex:'0 0 auto',textAlign:'right'}}>{amount(invoice.total)}</span></div>
     <div className="thermal-total" style={{display:'flex',justifyContent:'space-between',width:'100%',gap:'12px'}}><span className="thermal-total-label" style={{flex:'0 0 auto'}}>Payment Mode:</span><span className="thermal-total-value" style={{flex:'0 0 auto',textAlign:'right'}}>{safeText(invoice.paymentMode)}</span></div>
     <div className="thermal-total" style={{display:'flex',justifyContent:'space-between',width:'100%',gap:'12px'}}><span className="thermal-total-label" style={{flex:'0 0 auto'}}>Paid Amount:</span><span className="thermal-total-value" style={{flex:'0 0 auto',textAlign:'right'}}>{amount(invoice.amountPaid)}</span></div>
     <div className="thermal-total" style={{display:'flex',justifyContent:'space-between',width:'100%',gap:'12px',fontWeight:'bold'}}><span className="thermal-total-label" style={{flex:'0 0 auto'}}>Due Amount:</span><span className="thermal-total-value" style={{flex:'0 0 auto',textAlign:'right'}}>Rs. {amount(invoice.dueAmount)}</span></div>
   </div>
   {showStamp&&stampBeforeThankYou&&<div style={{position:'relative',minHeight:'55px',marginTop:`${tableSpacing}px`,display:'flex',justifyContent:'center',alignItems:'center'}}><PaidStamp settings={thermalStampSettings} compact variant="thermal"/></div>}
   <div style={{textAlign:'center',marginTop:`${tableSpacing}px`,borderTop:'1px dashed black',paddingTop:`${sectionSpacing}px`,width:'100%',maxWidth:'100%',overflowWrap:'anywhere'}}>{safeText(settings?.thermalFooterNote||settings?.footerNote||'Thank you for choosing Rizvi Diagnostic Center')}</div>
   {bookedBy}
   {showStamp&&stampAfterBookedBy&&<div style={{position:'relative',minHeight:'55px',marginTop:`${sectionSpacing}px`,display:'flex',justifyContent:'center',alignItems:'center'}}><PaidStamp settings={thermalStampSettings} compact variant="thermal"/></div>}
 </div></>;
}
