'use client';

import { useEffect, useState } from 'react';

/**
 * Splash de entrada da WEB — paridade com o WelcomeOverlay do mobile.
 * O ícone do app surge sobre o gradiente da marca (royal → elétrico) e some.
 * Mostra uma única vez por sessão do navegador; respeita prefers-reduced-motion.
 * Renderiza null no SSR e só ativa via efeito (sem mismatch de hidratação).
 */
export function WelcomeSplash() {
  const [phase, setPhase] = useState<'hidden' | 'in' | 'out'>('hidden');

  useEffect(() => {
    if (sessionStorage.getItem('hp:welcomed')) return;
    sessionStorage.setItem('hp:welcomed', '1');
    // Respeita quem pede menos movimento: não mostra o splash animado.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setPhase('in');
    const toOut = setTimeout(() => setPhase('out'), 1500);
    const toHidden = setTimeout(() => setPhase('hidden'), 2000);
    return () => {
      clearTimeout(toOut);
      clearTimeout(toHidden);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div aria-hidden className="hp-welcome-splash fixed inset-0 z-[200] flex items-center justify-center" data-phase={phase}>
      <div className="flex flex-col items-center">
        <span className="hp-welcome-tile flex h-24 w-24 items-center justify-center rounded-[26px] bg-white shadow-2xl">
          <img src="/logo.png" alt="" className="h-16 w-16" />
        </span>
        <span className="mt-6 text-3xl font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
          HubPatients
        </span>
        <span className="mt-1.5 text-sm text-white/85">Sua saúde, seu controle 💙</span>
      </div>
    </div>
  );
}
