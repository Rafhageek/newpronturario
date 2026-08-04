import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Check,
  FileHeart,
  HeartPulse,
  LockKeyhole,
  NotebookPen,
  ShieldCheck,
} from 'lucide-react';

/**
 * Painel institucional da autenticação.
 *
 * A ilustração é vetorial, decorativa e não contém PHI. Não há movimento em
 * loop: as únicas entradas vêm de `vl-rise`, que já respeita redução de
 * movimento no sistema global.
 */
export function AuthHero() {
  return (
    <aside
      aria-label="HubPatients — prontuário pessoal de saúde"
      className="relative hidden min-h-screen overflow-hidden lg:flex lg:w-[54%] lg:min-w-[540px] lg:flex-col lg:justify-between lg:px-10 lg:py-9 xl:px-14 xl:py-10 2xl:px-16"
      style={{
        background:
          'radial-gradient(75% 55% at 12% 12%, #0b4ff0 0%, transparent 68%), radial-gradient(55% 60% at 88% 38%, rgba(24,98,236,0.55), transparent 72%), linear-gradient(145deg, #0619d5 0%, #062f9f 48%, #061d64 100%)',
      }}
    >
      <HeroAtmosphere />

      <div
        className="vl-rise relative z-10 flex items-center gap-3"
        style={{ animationDelay: '40ms' }}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] ring-1 ring-white/40">
          <img src="/logo.png" alt="" aria-hidden className="h-full w-full object-contain" />
        </span>
        <span
          className="text-2xl font-bold tracking-tight text-white"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          HubPatients
        </span>
      </div>

      <ClinicalVaultIllustration />

      <div className="relative z-10 max-w-[620px]">
        <span
          className="vl-rise inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-100 backdrop-blur-sm"
          style={{ animationDelay: '120ms' }}
        >
          <ShieldCheck className="h-4 w-4 text-health-300" aria-hidden />
          Prontuário pessoal de saúde
        </span>

        <h1
          className="vl-rise mt-5 text-[clamp(2.75rem,4.2vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.045em] text-white"
          style={{ fontFamily: 'var(--font-display)', animationDelay: '180ms' }}
        >
          Sua saúde,
          <br />
          seu controle,
          <br />
          <span className="text-health-300">seus dados.</span>
        </h1>

        <p
          className="vl-rise mt-5 max-w-lg text-base leading-relaxed text-blue-100/85"
          style={{ animationDelay: '240ms' }}
        >
          Organize sua jornada de saúde e compartilhe informações somente com quem
          você escolher, com segurança e privacidade.
        </p>

        <div
          className="vl-rise mt-7 flex flex-wrap gap-3"
          style={{ animationDelay: '300ms' }}
        >
          <FeaturePill icon={NotebookPen} label="Diário clínico" />
          <FeaturePill icon={BarChart3} label="Análise de dados" />
        </div>
      </div>
    </aside>
  );
}

function HeroAtmosphere() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.075]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='130'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-[14%] h-52 w-52 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1.5px)',
          backgroundSize: '14px 14px',
          maskImage: 'radial-gradient(circle, black, transparent 72%)',
        }}
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] w-full opacity-25"
        viewBox="0 0 900 190"
        preserveAspectRatio="none"
        fill="none"
      >
        {Array.from({ length: 9 }, (_, index) => (
          <path
            key={index}
            d={`M-40 ${178 - index * 7} C 170 ${92 - index * 4}, 320 ${235 - index * 10}, 520 ${128 - index * 6} S 760 ${65 + index * 4}, 950 ${120 - index * 5}`}
            stroke={index % 2 === 0 ? '#45E3C1' : '#5E9BFF'}
            strokeWidth="1.2"
          />
        ))}
      </svg>
    </>
  );
}

function ClinicalVaultIllustration() {
  return (
    <div className="vl-rise relative z-10 mx-auto my-4 flex w-full max-w-[500px] flex-1 items-center justify-center py-2 2xl:max-w-[560px]">
      <svg
        viewBox="0 0 560 390"
        className="h-auto w-full"
        role="img"
        aria-label="Ilustração de um prontuário digital protegido"
      >
        <defs>
          <linearGradient id="auth-folder-front" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#2666FF" />
            <stop offset="1" stopColor="#072AA8" />
          </linearGradient>
          <linearGradient id="auth-folder-back" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#86AFFF" />
            <stop offset="1" stopColor="#2B5FE2" />
          </linearGradient>
          <linearGradient id="auth-shield" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#56E7C4" />
            <stop offset="1" stopColor="#15A77F" />
          </linearGradient>
        </defs>

        <ellipse cx="280" cy="208" rx="205" ry="146" fill="none" stroke="#7CB0FF" strokeOpacity=".36" strokeDasharray="4 8" />
        <ellipse cx="280" cy="208" rx="155" ry="112" fill="none" stroke="#7CB0FF" strokeOpacity=".2" />
        <circle cx="280" cy="208" r="112" fill="#2872FF" fillOpacity=".16" />

        <g fill="#86C5FF">
          <circle cx="94" cy="111" r="3" />
          <circle cx="443" cy="94" r="3" />
          <circle cx="481" cy="237" r="3" />
          <circle cx="137" cy="315" r="3" />
        </g>

        <g>
          <path d="M172 158h103l22 25h103a18 18 0 0 1 18 18v112a22 22 0 0 1-22 22H164a22 22 0 0 1-22-22V180a22 22 0 0 1 22-22h8Z" fill="url(#auth-folder-back)" />

          <g transform="rotate(4 286 158)">
            <rect x="210" y="84" width="174" height="121" rx="13" fill="#F8FBFF" />
            <circle cx="244" cy="125" r="17" fill="#DCE8FF" />
            <circle cx="244" cy="120" r="7" fill="#2B63E8" />
            <path d="M231 140c3-10 23-10 26 0v5h-26v-5Z" fill="#2B63E8" />
            <rect x="273" y="110" width="69" height="8" rx="4" fill="#C8D7F5" />
            <rect x="273" y="126" width="50" height="7" rx="3.5" fill="#DFE7F6" />
            <path d="M271 166h28l7-17 9 34 9-23 7 12h29" stroke="#255BE1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          <path d="M154 210h107l23 24h126a18 18 0 0 1 18 18v69a24 24 0 0 1-24 24H160a24 24 0 0 1-24-24v-93a18 18 0 0 1 18-18Z" fill="url(#auth-folder-front)" />
          <rect x="208" y="263" width="60" height="18" rx="5" fill="#EAF2FF" />
          <rect x="229" y="242" width="18" height="60" rx="5" fill="#EAF2FF" />

          <g transform="translate(350 239)">
            <path d="M43 0c12 9 28 13 43 15v35c0 29-17 51-43 65C17 101 0 79 0 50V15C15 13 31 9 43 0Z" fill="url(#auth-shield)" stroke="#B9FFEA" strokeWidth="3" />
            <path d="m24 54 13 13 26-30" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      </svg>

      <OrbitNode className="left-[8%] top-[23%]" icon={LockKeyhole} />
      <OrbitNode className="right-[7%] top-[28%]" icon={BarChart3} />
      <OrbitNode className="left-1/2 top-[3%] -translate-x-1/2" icon={HeartPulse} />
      <OrbitNode className="bottom-[4%] left-1/2 -translate-x-1/2" icon={FileHeart} />
    </div>
  );
}

function OrbitNode({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={`absolute flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-blue-400/15 text-white shadow-[0_10px_30px_rgba(0,8,61,0.25)] backdrop-blur-md ${className}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-health-400/15 text-health-300">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      {label}
      <Check className="ml-1 h-3.5 w-3.5 text-blue-200/80" aria-hidden />
    </div>
  );
}
