import React from 'react';

const POSITIONS = {
  'top-left': { top: '0%', left: '0%' }, 'top-center': { top: '0%', left: '50%' }, 'top-right': { top: '0%', right: '0%' },
  'center-left': { top: '50%', left: '0%' }, center: { top: '50%', left: '50%' }, 'center-right': { top: '50%', right: '0%' },
  'bottom-left': { bottom: '0%', left: '0%' }, 'bottom-center': { bottom: '0%', left: '50%' }, 'bottom-right': { bottom: '0%', right: '0%' },
};

export default function PaidStamp({ settings = {}, compact = false }) {
  const text = settings.stampText || 'PAID';
  const clinic = settings.clinicName || 'Rizvi Diagnostic Center';
  const color = settings.stampColor || '#c0392b';
  const position = settings.stampPosition || 'center';
  const style = settings.stampStyle || 'classic';
  const rotation = Number.isFinite(Number(settings.stampRotation)) ? Number(settings.stampRotation) : -18;
  const opacity = Math.min(1, Math.max(0.15, Number(settings.stampOpacity ?? 0.82)));
  const scale = Math.min(2, Math.max(0.5, Number(settings.stampScale ?? 1)));
  const offsetX = Number(settings.stampOffsetX || 0);
  const offsetY = Number(settings.stampOffsetY || 0);
  const borderWidth = Math.min(8, Math.max(1, Number(settings.stampBorderWidth ?? 3)));
  const showClinic = settings.stampShowClinicName !== false;
  const showDate = settings.stampShowDateTime !== false;
  const fontSize = Math.min(72, Math.max(8, Number(settings.stampFontSize || (compact ? 14 : 26))));
  const stampedAt = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' });
  const positionStyle = POSITIONS[position] || POSITIONS.center;
  let translate = '';
  if (position.includes('center')) translate += 'translateX(-50%) ';
  if (position.startsWith('center')) translate += 'translateY(-50%) ';
  const transform = `${translate}rotate(${rotation}deg) scale(${scale})`.trim();

  let bodyStyle;
  if (style === 'circle') bodyStyle = { border: `${borderWidth}px solid ${color}`, borderRadius: '50%', color, width: compact ? 74 : 132, height: compact ? 74 : 132, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 7 };
  else if (style === 'ribbon') bodyStyle = { background: color, color: '#fff', borderRadius: 4, padding: compact ? '4px 12px' : '7px 22px', textAlign: 'center' };
  else if (style === 'dashed') bodyStyle = { border: `${borderWidth}px dashed ${color}`, borderRadius: 5, color, padding: compact ? '4px 9px' : '8px 16px', textAlign: 'center' };
  else if (style === 'outline') bodyStyle = { border: `${borderWidth}px solid ${color}`, borderRadius: 3, color, padding: compact ? '4px 9px' : '8px 16px', textAlign: 'center' };
  else bodyStyle = { border: `${borderWidth}px double ${color}`, borderRadius: 6, color, padding: compact ? '4px 9px' : '8px 16px', textAlign: 'center' };

  return <div className="print-stamp pointer-events-none select-none" style={{ ...positionStyle, transform, zIndex: 20, opacity, position: 'absolute', marginLeft: `${offsetX}px`, marginTop: `${offsetY}px`, transformOrigin: 'center center', whiteSpace: 'nowrap' }}>
    <div style={bodyStyle}>
      <div style={{ fontSize: compact ? Math.max(10, fontSize * 0.6) : fontSize, fontWeight: 800, letterSpacing: 2 }}>{text}</div>
      {showClinic && <div style={{ fontSize: compact ? 6 : 9, fontWeight: 600 }}>{clinic}</div>}
      {showDate && <div style={{ fontSize: compact ? 6 : 9 }}>{stampedAt}</div>}
    </div>
  </div>;
}
