'use client';

import { useState } from 'react';
import { FileText, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useHubPatientsClient } from '@hubpatients/supabase';

/**
 * "Gerar relatório para a consulta".
 *
 * Chama a Edge Function `clinical-report`, que devolve um HTML A4 pronto para
 * imprimir, e abre o resultado em uma nova aba. O PDF sai do próprio navegador
 * (Ctrl+P / ⌘+P → "Salvar como PDF") — sem biblioteca de PDF, sem upload.
 *
 * Privacidade: o HTML tem dado de saúde. Ele nunca é gravado em disco pelo app,
 * nunca vai por URL e a resposta vem com `Cache-Control: no-store`. A aba é
 * aberta em branco ANTES do fetch (senão o bloqueador de pop-up derruba) e o
 * conteúdo é escrito nela quando chega.
 *
 * O relatório NÃO é laudo: nenhuma seção interpreta, classifica ou compara com
 * valor de referência — quem faz isso é o profissional na consulta.
 */

type SectionKey = 'alergias' | 'medicamentos' | 'vitais' | 'exames' | 'diario' | 'linha_do_tempo';

const SECTIONS: { key: SectionKey; label: string; hint: string }[] = [
  { key: 'alergias', label: 'Alergias', hint: 'substância, gravidade e reação registradas' },
  { key: 'medicamentos', label: 'Medicamentos em uso', hint: 'dose, forma e horários' },
  { key: 'vitais', label: 'Medidas', hint: 'pressão, glicemia, peso e outras' },
  { key: 'exames', label: 'Exames', hint: 'título, data e laboratório' },
  { key: 'diario', label: 'Diário', hint: 'dor, humor, sintomas e anotações' },
  { key: 'linha_do_tempo', label: 'Últimos registros', hint: 'linha do tempo resumida' },
];

const DEFAULT_SECTIONS: SectionKey[] = ['alergias', 'medicamentos', 'vitais', 'exames', 'diario'];

const PERIODS = [
  { days: 30 as const, label: 'Últimos 30 dias' },
  { days: 90 as const, label: 'Últimos 90 dias' },
];

/** Página provisória da aba enquanto o resumo é montado (sem nenhum dado). */
const LOADING_PAGE = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>Preparando seu resumo…</title></head>
<body style="font:16px/1.5 system-ui,sans-serif;color:#3f3f46;padding:40px">
Preparando seu resumo para a consulta…</body></html>`;

export function ClinicalReportButton({ patientId }: { patientId: string }) {
  const supabase = useHubPatientsClient();
  const [days, setDays] = useState<30 | 90>(30);
  const [sections, setSections] = useState<SectionKey[]>(DEFAULT_SECTIONS);
  const [autoPrint, setAutoPrint] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleSection(key: SectionKey) {
    setSections((current) =>
      current.includes(key) ? current.filter((s) => s !== key) : [...current, key],
    );
  }

  async function generate() {
    if (!patientId) {
      toast.error('Perfil não carregado. Recarregue a página.');
      return;
    }
    if (sections.length === 0) {
      toast.error('Escolha pelo menos uma seção para o relatório.');
      return;
    }

    // Abrir a aba AQUI, ainda dentro do clique: depois do await o navegador
    // trata window.open como pop-up e bloqueia.
    const tab = window.open('', '_blank');
    if (!tab) {
      toast.error('Seu navegador bloqueou a nova aba. Libere pop-ups para este site.');
      return;
    }
    tab.document.write(LOADING_PAGE);

    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('clinical-report', {
        body: { patientId, days, sections, print: autoPrint },
      });
      if (error || typeof data !== 'string' || data.length === 0) {
        tab.close();
        toast.error('Não foi possível gerar o relatório agora. Tente de novo em instantes.');
        return;
      }
      tab.document.open();
      tab.document.write(data);
      tab.document.close();
      tab.focus();
      toast.success('Relatório aberto em uma nova aba.');
    } catch {
      tab.close();
      toast.error('Não foi possível gerar o relatório agora. Tente de novo em instantes.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-2.5">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
          Relatório para a consulta
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted">
        Uma página com o que você registrou, para levar impressa ou no celular. Abre em uma nova aba;
        use Ctrl+P (⌘+P no Mac) e escolha “Salvar como PDF”.
      </p>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-fg-soft">Período</legend>
        <div className="mt-1.5 flex w-fit rounded-xl border border-line bg-surface-2 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              aria-pressed={days === p.days}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                days === p.days ? 'bg-sky-500/20 text-primary' : 'text-muted hover:text-fg'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-xs font-semibold text-fg-soft">O que incluir</legend>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {SECTIONS.map((s) => {
            const checked = sections.includes(s.key);
            return (
              <label
                key={s.key}
                className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line px-3 py-2 transition hover:border-primary/40"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSection(s.key)}
                  className="mt-1 h-4 w-4 shrink-0 accent-sky-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{s.label}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="mt-3 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={autoPrint}
          onChange={(e) => setAutoPrint(e.target.checked)}
          className="h-4 w-4 accent-sky-500"
        />
        <span className="text-xs text-muted">Já abrir a janela de impressão na nova aba</span>
      </label>

      <button
        type="button"
        onClick={generate}
        disabled={busy || sections.length === 0}
        aria-busy={busy}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Printer className="h-4 w-4" aria-hidden />
        )}
        {busy ? 'Gerando…' : 'Gerar relatório para a consulta'}
      </button>

      <p className="mt-3 text-xs text-muted">
        Dados autorreferidos pelo paciente. Não constitui laudo nem substitui avaliação profissional.
      </p>
    </section>
  );
}
