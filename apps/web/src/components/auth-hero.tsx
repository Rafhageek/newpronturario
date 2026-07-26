import { Activity, NotebookPen, ShieldCheck, User } from 'lucide-react';
import { LOOP_LIMIT } from '@hubpatients/ui-tokens';

/**
 * Painel de marca (lado esquerdo do split-screen de autenticação).
 * Ilustração: coração + linha de ECG, anéis orbitais e nós de funcionalidades.
 * Apenas decorativo — sem PHI.
 *
 * MOVIMENTO (WCAG SC 2.2.2 — "Pause, Stop, Hide"): este painel fica LADO A LADO
 * com o formulário de login, então nada aqui pode se mover indefinidamente. Toda
 * animação é FINITA e o total de movimento fica abaixo dos 5 s do critério —
 * assim não é preciso oferecer um botão de pausar. Ver `LOOP_LIMIT` e P6 em
 * packages/ui-tokens/src/motion.ts.
 *
 * O bloco global `@media (prefers-reduced-motion: reduce)` de globals.css já
 * cobre estas animações (`animation-duration: 0.001ms` + `iteration-count: 1`);
 * como todas usam `fill-mode: both`, o estado de repouso aparece imediatamente.
 */
export function AuthHero() {
  return (
    <div
      className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12 xl:p-14"
      style={{
        background:
          'radial-gradient(120% 120% at 15% 0%, #0511F2 0%, #0442BF 38%, #052C80 72%, #071F5C 100%)',
      }}
    >
      {/* textura sutil de grão + glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Logo */}
      <div className="vl-rise relative z-10 flex items-center gap-2.5" style={{ animationDelay: '40ms' }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white p-1 ring-1 ring-white/25 shadow-sm">
          <img src="/logo.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span className="text-lg font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
          HubPatients
        </span>
      </div>

      {/* Ilustração orbital */}
      <Illustration />

      {/* Conteúdo */}
      <div className="relative z-10">
        <span
          className="vl-rise inline-block rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-trust-100 ring-1 ring-white/15 backdrop-blur"
          style={{ animationDelay: '120ms' }}
        >
          Prontuário eletrônico colaborativo
        </span>
        <h1
          className="vl-rise mt-5 text-5xl font-extrabold leading-[1.04] tracking-tight text-white xl:text-6xl"
          style={{ fontFamily: 'var(--font-display)', animationDelay: '200ms' }}
        >
          Sua saúde,
          <br />
          seu controle,
          <br />
          <span className="text-health-400">seus dados.</span>
        </h1>
        <p
          className="vl-rise mt-5 max-w-sm text-[15px] leading-relaxed text-trust-100/80"
          style={{ animationDelay: '280ms' }}
        >
          Registre sua jornada de saúde e compartilhe com quem você escolher, na medida que quiser.
        </p>

        <div className="vl-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '360ms' }}>
          <FeaturePill icon={<NotebookPen className="h-4 w-4" />} label="Diário clínico" />
          <FeaturePill icon={<Activity className="h-4 w-4" />} label="Análise de dados" />
        </div>
      </div>
    </div>
  );
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/15">
      <span className="text-health-300">{icon}</span>
      {label}
    </div>
  );
}

function Illustration() {
  return (
    <div className="relative z-10 mx-auto my-8 flex aspect-square w-full max-w-[360px] items-center justify-center">
      {/* glow central — 4 batidas (LOOP_LIMIT) de 1,2 s = 4,8 s e para.
          `both` congela no keyframe 100% (opacity .55 / scale 1), que é
          exatamente o estado de repouso desejado: não para no meio do ciclo. */}
      <div
        aria-hidden
        className="absolute h-40 w-40 rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(52,211,153,0.45), transparent 70%)',
          animation: `vl-pulse-glow 1.2s ease-in-out ${LOOP_LIMIT} both`,
        }}
      />

      {/* Anéis orbitais — ESTÁTICOS de propósito.
          Antes giravam em loop infinito (60 s e 45 s). Mesmo limitados a
          LOOP_LIMIT seriam 4 min e 3 min de movimento periférico ao lado do
          formulário — muito além dos 5 s da SC 2.2.2, e movimento periférico é
          gatilho vestibular (P5). Sendo decoração pura, o giro foi REMOVIDO: um
          círculo tracejado parado é visualmente idêntico ao girando. */}
      <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full" fill="none">
        <circle cx="180" cy="180" r="150" stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="2 8" />
        <circle cx="180" cy="180" r="112" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 6" />
        <circle cx="180" cy="180" r="78" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
      </svg>

      {/* coração + ECG */}
      <svg viewBox="0 0 200 200" className="relative h-44 w-44" fill="none">
        <path
          d="M100 168c-7-6-58-42-72-78C16 58 30 32 56 32c18 0 30 12 44 28 14-16 26-28 44-28 26 0 40 26 28 58-14 36-65 72-72 78Z"
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Uma única passada de 3,5 s (< 5 s da SC 2.2.2) e para. O traço tem
            ~207 unidades e o dash é 260/260: no fim (offset −1000 ≡ 40 dentro
            do período de 520) o segmento aceso cobre a linha inteira, ou seja,
            o repouso é o ECG COMPLETO — não um traço cortado no meio. */}
        <path
          d="M40 104h28l12-26 18 52 14-34 10 18h38"
          stroke="#6EE7B7"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="260"
          style={{ animation: 'vl-dash 3.5s linear 1 both' }}
        />
      </svg>

      {/* nós de funcionalidades */}
      <Node className="left-1/2 top-0 -translate-x-1/2"><User className="h-4 w-4" /></Node>
      <Node className="right-0 top-1/2 -translate-y-1/2"><Activity className="h-4 w-4" /></Node>
      <Node className="bottom-0 left-1/2 -translate-x-1/2"><NotebookPen className="h-4 w-4" /></Node>
      <Node className="left-0 top-1/2 -translate-y-1/2"><ShieldCheck className="h-4 w-4" /></Node>
    </div>
  );
}

function Node({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`absolute flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/25 backdrop-blur ${className}`}
    >
      {children}
    </span>
  );
}
