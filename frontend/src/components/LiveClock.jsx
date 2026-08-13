import React, { useEffect, useState } from 'react';

const CLINIC_TZ = 'Asia/Karachi';

/**
 * A small digital clock that ticks every second in real time. Used in the
 * header, and anywhere else (e.g. print previews) that should show "right
 * now" rather than a timestamp frozen at page load.
 */
export default function LiveClock({ className = '', showDate = true, showSeconds = true }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TZ,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(now);

  return (
    <div className={`text-right leading-tight ${className}`}>
      <div className="font-mono font-semibold text-slate-700 tabular-nums">{timeStr}</div>
      {showDate && <div className="text-[11px] text-slate-400">{dateStr}</div>}
    </div>
  );
}
