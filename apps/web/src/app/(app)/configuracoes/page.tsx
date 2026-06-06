'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Bell, Download, Globe, Laptop, Lock, LogOut, Moon, Palette, Sun, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUserSettings, useUpdateSettings, useVidaLogClient } from '@vidalog/supabase';
import { LOCALES } from '@vidalog/core';
import { useAuth } from '@/components/auth-provider';
import { TwoFactorSection } from '@/components/settings/two-factor-section';
import { UpgradeModal } from '@/components/ui/upgrade-modal';

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const supabase = useVidaLogClient();
  const userId = user?.id ?? '';
  const isPlus = false;

  const { theme, setTheme } = useTheme();
  const { data: settings } = useUserSettings(user?.id);
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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Configurações</h1>

      {/* Aparência */}
      <Card icon={Palette} title="Aparência">
        <p className="mb-2 text-sm text-fg-soft">Tema</p>
        <div className="flex gap-2">
          {[
            { value: 'light', label: 'Claro', icon: Sun },
            { value: 'dark', label: 'Escuro', icon: Moon },
            { value: 'system', label: 'Sistema', icon: Laptop },
          ].map((t) => (
            <button key={t.value} onClick={() => setTheme(t.value)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${theme === t.value ? 'border-sky-400/40 bg-sky-500/15 text-primary' : 'border-line text-muted hover:bg-surface-2'}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">O tema escuro é o otimizado; o claro completo chega em breve.</p>
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
          <Row label="Notificações push"><Toggle on={notif.push} onChange={() => update.mutate({ notif_push: !notif.push })} /></Row>
          <Row label="E-mail"><Toggle on={notif.email} onChange={() => update.mutate({ notif_email: !notif.email })} /></Row>
          <Row label={<span className="inline-flex items-center gap-1.5">Lembretes por WhatsApp {!isPlus && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">PLUS</span>}</span>}>
            <Toggle on={isPlus && notif.whatsapp} disabled={!isPlus} onChange={() => (isPlus ? update.mutate({ notif_whatsapp: !notif.whatsapp }) : setUpgrade(true))} />
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
            <Trash2 className="h-4 w-4 text-rose-300" /> Excluir conta
          </Link>
        </div>
      </Card>

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

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-white/15'} ${disabled ? 'opacity-50' : ''}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
