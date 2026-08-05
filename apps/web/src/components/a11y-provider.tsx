'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FontScale = 'normal' | 'large' | 'xlarge';
export type Contrast = 'normal' | 'high';

interface A11yState {
  fontScale: FontScale;
  setFontScale: (v: FontScale) => void;
  contrast: Contrast;
  setContrast: (v: Contrast) => void;
  /**
   * Modo Sênior ("Modo simples") — continua DERIVADO de fontScale + contraste
   * (não há um terceiro estado para sair de sincronia), mas agora é publicado
   * no `<html>` como `data-senior`. Sem esse atributo o CSS não tinha como
   * cumprir a parte da promessa que não é tamanho de letra: o alvo de toque.
   */
  senior: boolean;
}

/** Regra única de derivação — usada aqui e espelhada no script no-flash. */
export function isSenior(fontScale: FontScale, contrast: Contrast): boolean {
  return fontScale === 'xlarge' && contrast === 'high';
}

const A11yContext = createContext<A11yState | null>(null);

/** Preferências de acessibilidade aplicadas no <html> e persistidas localmente. */
export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [fontScale, setFontScaleState] = useState<FontScale>('normal');
  const [contrast, setContrastState] = useState<Contrast>('normal');

  // Hidrata do que o script no-flash (layout.tsx) já aplicou / do localStorage.
  useEffect(() => {
    const f = (localStorage.getItem('vl-font-scale') as FontScale) || 'normal';
    const c = (localStorage.getItem('vl-contrast') as Contrast) || 'normal';
    setFontScaleState(f);
    setContrastState(c);
  }, []);

  const senior = isSenior(fontScale, contrast);

  // Publica `data-senior` no <html> sempre que a derivação mudar — inclusive na
  // hidratação inicial, o que mantém o atributo alinhado com o que o script
  // no-flash já pintou.
  useEffect(() => {
    const d = document.documentElement;
    if (senior) d.setAttribute('data-senior', '');
    else d.removeAttribute('data-senior');
  }, [senior]);

  function setFontScale(v: FontScale) {
    setFontScaleState(v);
    localStorage.setItem('vl-font-scale', v);
    const d = document.documentElement;
    if (v === 'normal') d.removeAttribute('data-font-scale');
    else d.setAttribute('data-font-scale', v);
  }

  function setContrast(v: Contrast) {
    setContrastState(v);
    localStorage.setItem('vl-contrast', v);
    const d = document.documentElement;
    if (v === 'high') d.setAttribute('data-contrast', 'high');
    else d.removeAttribute('data-contrast');
  }

  return (
    <A11yContext.Provider value={{ fontScale, setFontScale, contrast, setContrast, senior }}>
      {children}
    </A11yContext.Provider>
  );
}

export function useAccessibility(): A11yState {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useAccessibility deve ser usado dentro de AccessibilityProvider');
  return ctx;
}
