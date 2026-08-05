'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Accessibility, Bell, Bot, Check, Contrast, Download, Globe, Laptop, Lock, LogOut, Moon, Palette, Stethoscope, Sun, Trash2, Type,
} from 'lucide-react';
import { a11y } from '@hubpatients/ui-tokens';
import { toast } from 'sonner';
import { useUserSettings, useUpdateSettings, useHubPatientsClient, useProfile, useHasPlusAccess } from '@hubpatients/supabase';
import { LOCALES } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { useAccessibility, type FontScale } from '@/components/a11y-provider';
import { TwoFactorSection } from '@/components/settings/two-factor-section';
import { UpgradeModal } from '@/components/ui/upgrade-modal';
import { CyclePrivacySection } from '@/components/cycle/cycle-privacy-section';
import { CalendarSyncSection } from '@/components/settings/calendar-sync-section';

/**
 * px → rem. Alvos de toque em `rem` acompanham a escala de fonte do usuário
 * (html a 125% no Modo simples), então 44 px viram ~56 px sozinhos.
 */
function rem(px: number): string {
  return `${px / 16}rem`;
}

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const supabase = useHubPatientsClient();
  const userId = user?.id ?? '';
  const isPlus = useHasPlusAccess(user?.id).data ?? false;

  const { theme, setTheme } = useTheme();
  // Evita hydration mismatch: o tema só é conhecido no cliente (next-themes).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const activeTheme = mounted ? theme : undefined;
  const { fontScale, setFontScale, contrast, setContrast, senior: seniorOn } = useAccessibility();
  const { data: settings } = useUserSettings(user?.id);
  const { data: profile } = useProfile(user?.id);
  const update = useUpdateSettings(userId);
  const [upgrade, setUpgrade] = useState(false);

  const notif = {
    push: settings?.notif_push ?? true,
    email: settings?.notif_email ?? true,
    whatsapp: settings?.notif_whatsapp ?? false,
  };

  function setLocale(code: string) {
    document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=31536000`;
    update.mutate({ locale: code });
    toast.success('Idioma salvo. Tradução completa das telas chega em breve.');
  }

  async function signOutOthers() {
    await supabase.auth.signOut({ scope: 'others' });
    toast.success('Você saiu dos outros dispositivos.');
  }

  /**
   * "Modo simples" (Modo Sênior) = os dois ajustes que mais pesam para leitura
   * de baixa visão, ligados de uma vez: letra maior + alto contraste. NÃO
   * duplica estado: `senior` vem do a11y-provider (que é quem deriva e publica
   * `data-senior` no <html>) e persiste pelo mesmo localStorage/no-flash já
   * existentes. É o `data-senior` que faz o CSS aplicar a base de 130% e o piso
   * de alvo de toque — ver "Modo Sênior" em globals.css.
   */
  function toggleSenior() {
    const next = !seniorOn;
    setFontScale(next ? 'xlarge' : 'normal');
    setContrast(next ? 'high' : 'normal');
    toast.success(
      next
        ? 'Modo simples ligado. Letras maiores e mais contraste.'
        : 'Modo simples desligado. Voltamos ao tamanho normal.',
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Configurações</h1>

      {/* Modo simples (Modo Sênior) — primeiro por ser o de maior impacto */}
      <section className={`rounded-2xl border bg-surface p-5 ${seniorOn ? 'border-primary' : 'border-line'}`}>
        <button
          type="button"
          role="switch"
          aria-checked={seniorOn}
          onClick={toggleSenior}
          className="flex w-full items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ minHeight: rem(a11y.tapTarget.senior) }}
        >
          <Accessibility className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-fg">Modo simples</span>
            <span className="block text-sm text-muted">Recomendado para leitura fácil</span>
          </span>
          <span
            aria-hidden="true"
            className={`relative block h-6 w-11 shrink-0 rounded-full ${seniorOn ? 'bg-emerald-600' : 'bg-line'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white motion-safe:transition-all ${seniorOn ? 'left-[22px]' : 'left-0.5'}`} />
          </span>
        </button>

        <p className="mt-4 text-base text-fg-soft">Quando o modo simples está ligado:</p>
        <ul className="mt-2 space-y-1.5">
          {[
            'As letras ficam maiores em todas as telas.',
            'Textos e bordas ficam mais fortes (alto contraste), para enxergar melhor.',
            `Como o site inteiro é medido em letra, os botões crescem junto: o alvo de ${a11y.tapTarget.min} px passa para cerca de ${a11y.tapTarget.senior} px — bem acima do mínimo de ${a11y.tapTarget.wcagMin} px exigido pelo WCAG 2.2.`,
          ].map((item) => (
            <li key={item} className="flex gap-2 text-base text-fg-soft">
              <Check className="mt-1 h-4 w-4 shrink-0 text-status-ok-ink" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        {/* Preview: usa rem, então já mostra o tamanho real que valerá no site. */}
        <div className="mt-4 rounded-2xl border border-line bg-surface-2 p-3">
          <p className="text-xs text-faint">
            {seniorOn ? 'Assim está o texto agora' : 'Assim está o texto agora (modo normal)'}
          </p>
          <p className="mt-1 text-base text-fg">Tomar Losartana 50 mg às 8h da manhã.</p>
        </div>

        <p className="mt-3 text-sm text-faint">
          Você pode ligar e desligar quando quiser. Nada do seu prontuário muda — só o tamanho das
          letras e a força das cores. O ajuste fica salvo neste aparelho.
        </p>
      </section>

      {/* Aparência */}
      <Card icon={Palette} title="Aparência">
        <p className="mb-2 text-sm text-fg-soft">Tema</p>
        <div className="flex gap-2">
          {[
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Escuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Laptop },
          ].map((t) => (
            <button key={t.value} onClick={() => setTheme(t.value)} aria-pressed={activeTheme === t.value}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${activeTheme === t.value ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">O tema escuro é o otimizado; o claro completo chega em breve.</p>
      </Card>

      {/* Acessibilidade — controles individuais por trás do Modo simples */}
      <Card icon={Accessibility} title="Acessibilidade (ajuste fino)">
        <p className="mb-2 flex items-center gap-1.5 text-sm text-fg-soft"><Type className="h-4 w-4" aria-hidden="true" /> Tamanho da letra</p>
        <div className="flex gap-2">
          {([
            { value: 'normal', label: 'A', hint: 'Padrão' },
            { value: 'large', label: 'A+', hint: 'Grande' },
            { value: 'xlarge', label: 'A++', hint: 'Maior' },
          ] as { value: FontScale; label: string; hint: string }[]).map((f) => (
            <button
              key={f.value}
              onClick={() => setFontScale(f.value)}
              aria-pressed={fontScale === f.value}
              aria-label={`Tamanho da letra: ${f.hint}`}
              style={{ minHeight: rem(a11y.tapTarget.min) }}
              className={`inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition ${fontScale === f.value ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}
            >
              <span className="font-bold leading-none">{f.label}</span>
              <span className="text-[10px]">{f.hint}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-fg-soft"><Contrast className="h-4 w-4" aria-hidden="true" /> Alto contraste</span>
          <Toggle label="Alto contraste" on={contrast === 'high'} onChange={() => setContrast(contrast === 'high' ? 'normal' : 'high')} />
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Deixa textos e bordas mais fortes — útil para baixa visão. O <strong className="font-semibold">Modo simples</strong> lá
          em cima liga os dois de uma vez; aqui você regula um de cada vez. As preferências ficam salvas neste aparelho.
        </p>
      </Card>

      {/* Idioma */}
      <Card icon={Globe} title="Idioma">
        <select value={settings?.locale ?? 'pt-BR'} onChange={(e) => setLocale(e.target.value)} className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg">
          {LOCALES.map((l) => (<option key={l.code} value={l.code}>{l.flag} {l.label}</option>))}
        </select>
      </Card>

      {/* Notificações */}
      <Card icon={Bell} title="Notificações">
        <div className="space-y-3">
          <Row label="Notificações push"><Toggle label="Notificações push" on={notif.push} onChange={() => update.mutate({ notif_push: !notif.push })} /></Row>
          <Row label="E-mail"><Toggle label="Notificações por e-mail" on={notif.email} onChange={() => update.mutate({ notif_email: !notif.email })} /></Row>
          <Row label={<span className="inline-flex items-center gap-1.5">Lembretes por WhatsApp {!isPlus && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">PLUS</span>}</span>}>
            <Toggle label="Lembretes por WhatsApp" on={isPlus && notif.whatsapp} disabled={!isPlus} onChange={() => (isPlus ? update.mutate({ notif_whatsapp: !notif.whatsapp }) : setUpgrade(true))} />
          </Row>
          <div>
            <p className="mb-1.5 text-sm text-fg-soft">Horário de silêncio</p>
            <div className="flex items-center gap-2">
              <input type="time" defaultValue={settings?.quiet_hours_start ?? ''} onBlur={(e) => update.mutate({ quiet_hours_start: e.target.value || null })} className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
              <span className="text-muted">até</span>
              <input type="time" defaultValue={settings?.quiet_hours_end ?? ''} onBlur={(e) => update.mutate({ quiet_hours_end: e.target.value || null })} className="h-10 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg" />
            </div>
          </div>
        </div>
      </Card>

      {/* Acesso de IA ao prontuário (tokens pessoais) */}
      <Card icon={Bot} title="Acesso de IA">
        <Link href="/configuracoes/acesso-ia" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-fg hover:bg-surface-2">
          <Bot className="h-4 w-4 text-primary" />
          Gerar token para meu assistente de IA
        </Link>
        <p className="mt-1.5 text-[11px] text-muted">
          Dê ao seu assistente de IA acesso de leitura ao seu prontuário, com escopos e revogável — sem compartilhar senha.
        </p>
      </Card>

      {/* Verificação profissional (selo médico no fórum) */}
      <Card icon={Stethoscope} title="Verificação profissional">
        <Link href="/configuracoes/verificacao-profissional" className="flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-fg hover:bg-surface-2">
          <Stethoscope className="h-4 w-4 text-status-ok-ink" />
          Solicitar selo de médico no fórum
        </Link>
        <p className="mt-1.5 text-[11px] text-muted">
          Para médicos: verifique seu CRM e ganhe um selo de credibilidade. O selo é informativo e não substitui consulta.
        </p>
      </Card>

      {/* Segurança */}
      <Card icon={Lock} title="Segurança">
        <div className="space-y-4">
          <TwoFactorSection />
          <div className="border-t border-line pt-4">
            <Row label={<span className="text-sm text-fg">Sessões ativas</span>}>
              <button onClick={signOutOthers} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-fg-soft hover:bg-surface-2">
                <LogOut className="h-3.5 w-3.5" /> Sair de outros dispositivos
              </button>
            </Row>
            <p className="mt-1.5 text-[11px] text-muted">
              Este dispositivo · último acesso {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : '—'}. Lista detalhada por dispositivo chega em breve.
            </p>
          </div>
        </div>
      </Card>

      {/* Atalhos LGPD */}
      <Card icon={Download} title="Seus dados">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/consentimento" className="flex flex-1 items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm text-fg hover:bg-surface-2">
            <Download className="h-4 w-4 text-primary" /> Exportar meus dados
          </Link>
          <Link href="/consentimento" className="flex flex-1 items-center gap-2 rounded-xl border border-rose-500/20 px-3 py-2.5 text-sm text-fg hover:bg-rose-500/10">
            <Trash2 className="h-4 w-4 text-rose-700 dark:text-rose-300" /> Excluir conta
          </Link>
        </div>
      </Card>

      {/* Sincronização de consultas com calendário externo */}
      <CalendarSyncSection />

      {/* Privacidade do ciclo menstrual (perfis femininos) */}
      {profile?.biological_sex === 'female' && <CyclePrivacySection />}

      <UpgradeModal open={upgrade} reason="whatsapp_reminders" onClose={() => setUpgrade(false)} />
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-fg-soft">{label}</span>
      {children}
    </div>
  );
}

/**
 * Alvo de toque de 44×44 px (WCAG 2.2 SC 2.5.8 exige 24; 44 é o nosso piso) —
 * a pílula visual continua com 24 px de altura, o clicável é a caixa toda.
 * A animação do "polegar" só roda com `motion-safe` (prefers-reduced-motion).
 */
function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{ minHeight: rem(a11y.tapTarget.min), minWidth: rem(a11y.tapTarget.min) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${disabled ? 'opacity-50' : ''}`}
    >
      <span aria-hidden="true" className={`relative block h-6 w-11 rounded-full motion-safe:transition ${on ? 'bg-emerald-600' : 'bg-line'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white motion-safe:transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}
