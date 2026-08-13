import { useEffect, useRef, useState } from 'react';

// Animates a number from its previous value up (or down) to a new target
// whenever `target` changes — used to make Dashboard stat cards (and the
// public Home page stats strip) "count up" both on first load and every
// time the numbers refresh (range change, date filter, or new data coming
// in). Respects prefers-reduced-motion.
export default function useCountUp(target, duration = 900) {
  const numericTarget = Number.isFinite(Number(target)) ? Number(target) : 0;
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // On first mount, count up from 0 as well so every number on screen
    // feels alive the moment the page/section appears — not just on
    // subsequent refreshes.
    if (firstRun.current) {
      firstRun.current = false;
      if (prefersReducedMotion) {
        fromRef.current = numericTarget;
        setDisplay(numericTarget);
        return;
      }
      fromRef.current = 0;
    }

    if (prefersReducedMotion || fromRef.current === numericTarget) {
      fromRef.current = numericTarget;
      setDisplay(numericTarget);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = from + (numericTarget - from) * eased;
      setDisplay(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = numericTarget;
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericTarget, duration]);

  return display;
}
