'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Wind } from 'lucide-react';

const INHALE = 4000; // 4s inspira
const EXHALE = 6000; // 6s expira → ~6 respirações/min

/**
 * Respiração guiada lenta (~6 rpm) — apoio de relaxamento (paridade com o mobile).
 * framer-motion respeita prefers-reduced-motion via MotionConfig no root. Nunca trata.
 */
export default function RespirarPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'in' | 'out'>('in');
  const [breaths, setBreaths] = useState(0);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let alive = true;
    const inhale = () => {
      if (!alive) return;
      setPhase('in');
      timer.current = setTimeout(exhale, INHALE);
    };
    const exhale = () => {
      if (!alive) return;
      setPhase('out');
      setBreaths((b) => b + 1);
      timer.current = setTimeout(inhale, EXHALE);
    };
    inhale();
    const sec = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      clearInterval(sec);
    };
  }, []);

  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <div className="mx-auto flex min-h-[72vh] max-w-md flex-col items-center justify-center gap-10 text-center">
      <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
        {phase === 'in' ? 'Inspire…' : 'Expire…'}
      </h1>

      <motion.div
        className="flex h-56 w-56 items-center justify-center rounded-full shadow-xl"
        style={{ background: 'linear-gradient(135deg,#0442bf,#0511f2)' }}
        animate={{ scale: phase === 'in' ? 1 : 0.62 }}
        transition={{ duration: (phase === 'in' ? INHALE : EXHALE) / 1000, ease: 'easeInOut' }}
      >
        <Wind className="h-10 w-10 text-white" />
      </motion.div>

      <p className="text-sm text-muted">
        {breaths} {breaths === 1 ? 'respiração' : 'respirações'} · {mm}:{ss}
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-trust-700"
        >
          <Check className="h-4 w-4" /> Concluir
        </button>
        <p className="max-w-xs text-[11px] leading-4 text-faint">
          Técnica de relaxamento — não substitui sua medicação. Em emergência, ligue 192.
        </p>
      </div>
    </div>
  );
}
