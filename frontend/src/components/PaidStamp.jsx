import React from 'react';

const POSITIONS = {
  'top-left': { top: '0%', left: '0%' },
  'top-center': { top: '0%', left: '50%' },
  'top-right': { top: '0%', right: '0%' },
  'center-left': { top: '50%', left: '0%' },
  center: { top: '50%', left: '50%' },
  'center-right': { top: '50%', right: '0%' },
  'bottom-left': { bottom: '0%', left: '0%' },
  'bottom-center': { bottom: '0%', left: '50%' },
  'bottom-right': { bottom: '0%', right: '0%' },
};

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export default function PaidStamp({ settings = {}, compact = false, variant = 'simple' }) {
  const prefix = variant === 'thermal' ? 'thermalStamp' : 'stamp';
  const get = (name, fallback) => settings[`${prefix}${name}`] ?? fallback;

  const text = get('Text', 'PAID');
  const clinic = settings.clinicName || 'Rizvi Diagnostic Center';
  const color = get('Color', '#c0392b');
  const position = get('Position', 'center');
  const style = get('Style', 'classic');
  const rotation = Number.isFinite(Number(get('Rotation', -18))) ? Number(get('Rotation', -18)) : -18;
  const opacity = clamp(get('Opacity', 0.82), 0.15, 1, 0.82);
  const scale = clamp(get('Scale', 1), 0.5, 2, 1);
  const offsetX = Number(get('OffsetX', 0)) || 0;
  const offsetY = Number(get('OffsetY', 0)) || 0;
  const borderWidth = clamp(get('BorderWidth', 3), 1, 8, 3);
  const showClinic = get('ShowClinicName', true) !== false;
  const showDate = get('ShowDateTime', true) !== false;

  // Thermal-only controls. Values are CSS px so they remain easy to tune against
  // the 80mm printer output. They are ignored for the normal/simple stamp.
  const thermal = variant === 'thermal';
  const stampWidth = thermal ? clamp(get('Width', 105), 40, 220, 105) : null;
  const stampHeight = thermal ? clamp(get('Height', 55), 25, 160, 55) : null;
  const stampFontSize = thermal
    ? clamp(get('FontSize', compact ? 14 : 26), 8, 72, compact ? 14 : 26)
    : clamp(get('FontSize', compact ? 14 : 26), 8, 72, compact ? 14 : 26);
  const clinicFontSize = thermal
    ? clamp(get('ClinicNameFontSize', compact ? 6 : 9), 4, 30, compact ? 6 : 9)
    : (compact ? 6 : 9);
  const dateFontSize = thermal
    ? clamp(get('DateTimeFontSize', compact ? 6 : 9), 4, 30, compact ? 6 : 9)
    : (compact ? 6 : 9);

  const stampedAt = new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const positionStyle = POSITIONS[position] || POSITIONS.center;
  let translate = '';
  if (position.includes('center')) translate += 'translateX(-50%) ';
  if (position.startsWith('center')) translate += 'translateY(-50%) ';
  const transform = `${translate}rotate(${rotation}deg) scale(${scale})`.trim();

  const sizeStyle = thermal
    ? {
        width: `${stampWidth}px`,
        height: `${stampHeight}px`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }
    : {};

  let bodyStyle;
  if (style === 'circle') {
    bodyStyle = {
      ...sizeStyle,
      border: `${borderWidth}px solid ${color}`,
      borderRadius: '50%',
      color,
      width: thermal ? `${stampWidth}px` : (compact ? 74 : 132),
      height: thermal ? `${stampHeight}px` : (compact ? 74 : 132),
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 7,
      textAlign: 'center',
    };
  } else if (style === 'ribbon') {
    bodyStyle = {
      ...sizeStyle,
      background: color,
      color: '#fff',
      borderRadius: 4,
      padding: compact ? '4px 12px' : '7px 22px',
      textAlign: 'center',
    };
  } else if (style === 'dashed') {
    bodyStyle = {
      ...sizeStyle,
      border: `${borderWidth}px dashed ${color}`,
      borderRadius: 5,
      color,
      padding: compact ? '4px 9px' : '8px 16px',
      textAlign: 'center',
    };
  } else if (style === 'outline') {
    bodyStyle = {
      ...sizeStyle,
      border: `${borderWidth}px solid ${color}`,
      borderRadius: 3,
      color,
      padding: compact ? '4px 9px' : '8px 16px',
      textAlign: 'center',
    };
  } else {
    bodyStyle = {
      ...sizeStyle,
      border: `${borderWidth}px double ${color}`,
      borderRadius: 6,
      color,
      padding: compact ? '4px 9px' : '8px 16px',
      textAlign: 'center',
    };
  }

  return (
    <div
      className="print-stamp pointer-events-none select-none"
      style={{
        ...positionStyle,
        transform,
        zIndex: 20,
        opacity,
        position: 'absolute',
        marginLeft: `${offsetX}px`,
        marginTop: `${offsetY}px`,
        transformOrigin: 'center center',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={bodyStyle}>
        <div
          style={{
            fontSize: `${stampFontSize}px`,
            fontWeight: 800,
            letterSpacing: thermal ? 1.5 : 2,
            lineHeight: 1.05,
          }}
        >
          {text}
        </div>
        {showClinic && (
          <div
            style={{
              fontSize: `${clinicFontSize}px`,
              fontWeight: 600,
              lineHeight: 1.1,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {clinic}
          </div>
        )}
        {showDate && (
          <div style={{ fontSize: `${dateFontSize}px`, lineHeight: 1.1 }}>
            {stampedAt}
          </div>
        )}
      </div>
    </div>
  );
}
