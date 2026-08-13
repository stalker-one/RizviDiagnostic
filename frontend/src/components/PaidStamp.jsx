import React from 'react';

const POSITION_STYLES = {
  'top-left': { top: '6%', left: '6%' },
  'top-right': { top: '6%', right: '6%' },
  center: { top: '42%', left: '50%', transform: 'translate(-50%, -50%)' },
  'center-right': { top: '38%', right: '8%' },
  'bottom-left': { bottom: '8%', left: '6%' },
  'bottom-right': { bottom: '8%', right: '6%' },
};

/**
 * A stamp overlaid on print invoices once an invoice is fully paid. Fully
 * admin-configurable from Settings > Paid Stamp: text, design style,
 * position, color, rotation, and whether the clinic name / real date-time
 * are shown inside it.
 */
export default function PaidStamp({ settings, compact = false }) {
  const stampText = settings?.stampText || 'PAID';
  const clinicName = settings?.clinicName || 'Rizvi Diagnostic Center';
  const color = settings?.stampColor || '#c0392b';
  const rotation = settings?.stampRotation ?? -18;
  const style = settings?.stampStyle || 'classic';
  const position = settings?.stampPosition || 'center-right';
  const showClinicName = settings?.stampShowClinicName !== false;
  const showDateTime = settings?.stampShowDateTime !== false;

  const stampedAt = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const posStyle = POSITION_STYLES[position] || POSITION_STYLES['center-right'];
  const rotateTransform = posStyle.transform
    ? `${posStyle.transform} rotate(${rotation}deg)`
    : `rotate(${rotation}deg)`;

  const bodyStyle =
    style === 'circle'
      ? {
          border: `3px solid ${color}`,
          borderRadius: '50%',
          color,
          width: compact ? 70 : 130,
          height: compact ? 70 : 130,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: compact ? 4 : 8,
        }
      : style === 'ribbon'
      ? {
          background: color,
          color: '#fff',
          borderRadius: 4,
          padding: compact ? '3px 10px' : '6px 20px',
          textAlign: 'center',
        }
      : {
          border: `3px solid ${color}`,
          borderRadius: 6,
          color,
          padding: compact ? '4px 8px' : '8px 16px',
          textAlign: 'center',
        };

  return (
    <div
      className="print-stamp absolute pointer-events-none select-none"
      style={{ ...posStyle, transform: rotateTransform, zIndex: 20, opacity: 0.85 }}
    >
      <div style={bodyStyle}>
        <div style={{ fontSize: compact ? 14 : 26, fontWeight: 800, letterSpacing: 2 }}>{stampText}</div>
        {showClinicName && (
          <div style={{ fontSize: compact ? 6 : 9, fontWeight: 600, whiteSpace: 'nowrap' }}>{clinicName}</div>
        )}
        {showDateTime && (
          <div style={{ fontSize: compact ? 6 : 9, whiteSpace: 'nowrap' }}>{stampedAt}</div>
        )}
      </div>
    </div>
  );
}
