'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  useCycleSettings,
  useUpdateCycleSettings,
  useDeleteCycleHistory,
} from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Card } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
        on ? 'bg-fuchsia-500' : 'bg-line'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs leading-relaxed text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Seção AUTÔNOMA do ciclo para Configurações → Privacidade.
 * Compartilhamentos são opt-in (default false); o acompanhamento começa ativo.
 * Permite ajustar o ciclo médio e apagar todo o histórico (ação destrutiva).
 */
export function CyclePrivacySection() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: settings, isLoading } = useCycleSettings(user?.id);
  const update = useUpdateCycleSettings(userId);
  const deleteHistory = useDeleteCycleHistory(userId);

  const [cycleDaysInput, setCycleDaysInput] = useState('');

  // Defaults: tracking ativo; demais compartilhamentos desativados.
  const trackingEnabled = settings?.tracking_enabled ?? true;
  const shareWithCaregiver = settings?.share_with_caregiver ?? false;
  const shareWithDoctor = settings?.share_with_doctor ?? false;
  const shareWithResearch = settings?.share_with_research ?? false;
  const averageCycleDays = settings?.average_cycle_days ?? 28;

  useEffect(() => {
    setCycleDaysInput(String(averageCycleDays));
  }, [averageCycleDays]);

  function patch(p: Parameters<typeof update.mutate>[0]) {
    update.mutate(p, {
      onError: () => toast.error('Não foi possível salvar a preferência.'),
    });
  }

  function commitCycleDays() {
    const n = Number(cycleDaysInput);
    if (!Number.isInteger(n) || n < 15 || n > 60) {
      toast.error('Informe um ciclo médio entre 15 e 60 dias.');
      setCycleDaysInput(String(averageCycleDays));
      return;
    }
    if (n === averageCycleDays) return;
    patch({ averageCycleDays: n });
  }

  async function handleDelete() {
    const ok = confirmAction(
      'Apagar TODO o histórico do ciclo? Esta ação não pode ser desfeita.',
    );
    if (!ok) return;
    try {
      await deleteHistory.mutateAsync();
      toast.success('Histórico do ciclo apagado.');
    } catch {
      toast.error('Não foi possível apagar o histórico.');
    }
  }

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />;
  }

  return (
    <Card className="space-y-1">
      <div className="pb-1">
        <h3
          className="text-sm font-bold text-fg"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Ciclo menstrual
        </h3>
        <p className="text-xs leading-relaxed text-muted">
          Os dados do ciclo são privados. Todos os compartilhamentos abaixo são
          opcionais (opt-in) e podem ser desativados a qualquer momento.
        </p>
      </div>

      <div className="divide-y divide-line">
        <Row
          title="Ativar acompanhamento"
          description="Habilita o registro do ciclo e as estimativas de fase no app."
        >
          <Toggle
            on={trackingEnabled}
            disabled={update.isPending}
            label="Ativar acompanhamento do ciclo"
            onChange={() => patch({ trackingEnabled: !trackingEnabled })}
          />
        </Row>

        <Row
          title="Compartilhar com cuidador"
          description="Permite que cuidadores autorizados vejam o resumo do seu ciclo."
        >
          <Toggle
            on={shareWithCaregiver}
            disabled={update.isPending}
            label="Compartilhar ciclo com cuidador"
            onChange={() => patch({ shareWithCaregiver: !shareWithCaregiver })}
          />
        </Row>

        <Row
          title="Compartilhar com médico"
          description="Inclui o resumo do ciclo no que é exibido ao seu médico."
        >
          <Toggle
            on={shareWithDoctor}
            disabled={update.isPending}
            label="Compartilhar ciclo com médico"
            onChange={() => patch({ shareWithDoctor: !shareWithDoctor })}
          />
        </Row>

        <Row
          title="Compartilhar para pesquisa"
          description="Contribui com dados anonimizados para fins de pesquisa."
        >
          <Toggle
            on={shareWithResearch}
            disabled={update.isPending}
            label="Compartilhar ciclo para pesquisa"
            onChange={() => patch({ shareWithResearch: !shareWithResearch })}
          />
        </Row>

        <div className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <label htmlFor="cycle-avg-days" className="text-sm font-medium text-fg">
              Ciclo médio (dias)
            </label>
            <p className="text-xs leading-relaxed text-muted">
              Usado nas estimativas quando ainda não há histórico suficiente.
            </p>
          </div>
          <input
            id="cycle-avg-days"
            type="number"
            inputMode="numeric"
            min={15}
            max={60}
            value={cycleDaysInput}
            disabled={update.isPending}
            onChange={(e) => setCycleDaysInput(e.target.value)}
            onBlur={commitCycleDays}
            className="h-11 w-24 rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg disabled:opacity-50"
          />
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteHistory.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-status-alert-mark px-4 text-sm font-semibold text-status-alert-ink transition hover:bg-status-alert-tint disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {deleteHistory.isPending ? 'Apagando…' : 'Apagar todo o histórico do ciclo'}
        </button>
      </div>
    </Card>
  );
}
