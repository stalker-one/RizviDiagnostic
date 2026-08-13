import React from 'react';
import { Bone, Waves, Activity, CircleDot } from 'lucide-react';

// The signature visual for the public site: a stylised radiology light-box.
// Four "film frames" — X-Ray, Ultrasound, Colour Doppler, CT/MRI — sit on a
// dark backlit panel, each clipped in place like real film on a viewer, with
// a soft cyan glow standing in for the light-box bulb behind the film.
const FRAMES = [
  { label: 'X-RAY', Icon: Bone },
  { label: 'ULTRASOUND', Icon: Waves },
  { label: 'DOPPLER', Icon: Activity },
  { label: 'CT / MRI', Icon: CircleDot },
];

export default function Lightbox({ compact = false, className = '' }) {
  return (
    <div
      className={`relative rounded-2xl bg-ink-950 border border-white/10 shadow-[0_0_60px_-15px_rgba(63,193,208,0.35)] ${className}`}
    >
      {/* top clip rail */}
      <div className="flex justify-around px-4 pt-2">
        {FRAMES.map((_, i) => (
          <div key={i} className="w-3 h-1.5 rounded-b bg-brass-500/70" />
        ))}
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 p-4 ${compact ? 'gap-2 p-3' : ''}`}>
        {FRAMES.map(({ label, Icon }, i) => (
          <div
            key={label}
            className="glow-pulse rounded-lg bg-gradient-to-b from-glow-500/20 to-ink-900 border border-glow-500/30 flex flex-col items-center justify-center py-5 gap-2"
            style={{ animationDelay: `${i * 0.4}s` }}
          >
            <Icon className="text-glow-300" size={compact ? 20 : 28} strokeWidth={1.5} />
            {!compact && (
              <span className="font-mono text-[10px] tracking-widest text-glow-300/80">{label}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
