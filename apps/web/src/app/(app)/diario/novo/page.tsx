'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  diaryEntrySchema,
  MOOD_LABELS,
  PAIN_DISCLAIMER,
  bodyRegionLabel,
  painIntensityColor,
  parseNumeroBR,
  type PainPointInput,
} from '@hubpatients/core';
import { useCreateDiaryEntryFull, useAddPainPoints } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { useActiveProfile } from '@/components/profile-context';
import { Slider } from '@/components/ui/slider';
import { SymptomMultiselect } from '@/components/diary/symptom-multiselect';
import { VoiceDictationButton } from '@/components/diary/voice-dictation-button';
import { BodyPainMap } from '@/components/diary/body-pain-map';
import { PainPointModal } from '@/components/diary/pain-point-modal';
import { confirmAction } from '@/lib/confirm';

type VitalsState = {
  systolic: string;
  diastolic: string;
  heartRate: string;
  temperature: string;
  weight: string;
  glucose: string;
  oxygen: string;
};
const emptyVitals: VitalsState = {
  systolic: '', diastolic: '', heartRate: '', temperature: '', weight: '', glucose: '', oxygen: '',
};

/**
 * `max` repete de propósito o limite de `diaryVitalsSchema` (packages/core):
 * é o número que a MENSAGEM de erro precisa dizer em voz alta. Um aviso que
 * manda "verificar os dados" sem dizer qual é a faixa não ajuda ninguém a
 * consertar nada. Se o schema mudar, este número muda junto.
 */
const VITAL_FIELDS: { key: keyof VitalsState; label: string; unit: string; max: number }[] = [
  { key: 'systolic', label: 'PA sistólica', unit: 'mmHg', max: 300 },
  { key: 'diastolic', label: 'PA diastólica', unit: 'mmHg', max: 200 },
  { key: 'heartRate', label: 'Freq. cardíaca', unit: 'bpm', max: 300 },
  { key: 'temperature', label: 'Temperatura', unit: '°C', max: 45 },
  { key: 'weight', label: 'Peso', unit: 'kg', max: 500 },
  { key: 'glucose', label: 'Glicemia', unit: 'mg/dL', max: 900 },
  { key: 'oxygen', label: 'SpO₂', unit: '%', max: 100 },
];
/** Rótulo e limite pela chave que a validação devolve no caminho do erro. */
const VITAL_POR_CHAVE = new Map(VITAL_FIELDS.map((f) => [f.key as string, f]));

/**
 * Quanto tempo um aviso fica na tela.
 *
 * O padrão do toaster é 4s — pouco para quem lê devagar, e curto demais para
 * sobreviver a uma troca de tela. Sucesso é uma confirmação curta; erro e
 * sucesso parcial pedem leitura, então ficam bem mais tempo.
 */
const TEMPO_CONFIRMACAO = 6000;
const TEMPO_LEITURA = 12000;

/** Diz o que ficou de fora, no singular ou no plural, com o número escrito. */
function textoPontosFaltando(quantidade: number): string {
  return quantidade === 1
    ? 'O ponto de dor que você marcou no mapa não foi anexado.'
    : `Os ${quantidade} pontos de dor que você marcou no mapa não foram anexados.`;
}

/** Formato mínimo do que a validação devolve — evita depender do zod aqui. */
type ProblemaDeValidacao = { path: (string | number)[]; message: string };

/**
 * Traduz o primeiro problema de validação numa frase que diz QUAL campo travou
 * o salvamento e O QUE fazer com ele.
 *
 * A mensagem antiga era "Verifique os dados do registro." — ela informa a
 * quem escreveu o código, não a quem está com o dedo no formulário. O público
 * daqui tem 50, 60, 70 anos; dizer o campo, o que está escrito nele e a faixa
 * aceita é a diferença entre corrigir em cinco segundos e desistir do registro.
 */
function mensagemDeValidacao(
  problemas: readonly ProblemaDeValidacao[],
  vitals: VitalsState,
): { titulo: string; descricao: string } {
  const problema = problemas[0];
  const raiz = problema?.path[0];
  const campo = problema?.path[1];

  if (raiz === 'vitals' && typeof campo === 'string') {
    const f = VITAL_POR_CHAVE.get(campo);
    if (f) {
      const digitado = vitals[f.key].trim();
      return {
        titulo: `Não deu para ler o campo ${f.label}.`,
        descricao:
          `Está escrito “${digitado}”. Esse campo aceita só o número, de 1 a ${f.max} ${f.unit} ` +
          '(pode usar vírgula nos decimais, como 36,5). Se você não mediu hoje, apague o campo: ' +
          'os sinais vitais são opcionais e o resto do registro salva sem eles.',
      };
    }
  }
  if (raiz === 'note') {
    return {
      titulo: 'A nota ficou comprida demais.',
      descricao: 'O campo Notas guarda até 2.000 caracteres. Encurte um pouco e salve de novo.',
    };
  }
  if (raiz === 'symptoms') {
    return {
      titulo: 'São sintomas demais para um registro só.',
      descricao: 'Deixe marcados até 30 sintomas neste registro e salve de novo.',
    };
  }
  return {
    titulo: 'Um dos campos do registro não pôde ser lido.',
    descricao:
      `${problema?.message ?? 'Revise os sinais vitais e as notas.'} ` +
      'Os sinais vitais são opcionais: na dúvida, apague o campo e salve o resto.',
  };
}

export default function NovoRegistroPage() {
  const { patientId } = useActiveProfile();
  const { user } = useAuth();
  const router = useRouter();
  const create = useCreateDiaryEntryFull(patientId);
  const addPain = useAddPainPoints(user?.id ?? '');

  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [pain, setPain] = useState(0);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [vitals, setVitals] = useState<VitalsState>(emptyVitals);

  // Mapa de dor — múltiplos pontos numa mesma entrada (estado local).
  const [showMap, setShowMap] = useState(false);
  const [painPoints, setPainPoints] = useState<PainPointInput[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  /**
   * Id da entrada que JÁ ENTROU no diário quando só os pontos de dor falharam.
   * Enquanto ele existe, o botão de salvar sai do caminho: salvar de novo
   * criaria uma segunda entrada do mesmo dia. O que falta é só anexar.
   */
  const [entradaSalvaId, setEntradaSalvaId] = useState<string | null>(null);

  /**
   * Texto do campo → número.
   *
   * A regra da pontuação brasileira (vírgula decimal, ponto de milhar) mora em
   * `parseNumeroBR`, no core, com teste. Aqui ficava um `replace(',', '.')`
   * que trocava só a PRIMEIRA vírgula e ignorava o milhar: `1.234,5` na
   * glicemia virava `1.234.5` e `Number` devolvia NaN — o registro não salvava
   * e voltava um toast vermelho genérico, sem dizer que o problema era a
   * pontuação.
   */
  const num = parseNumeroBR;

  function handlePickRegion(code: string) {
    setActiveRegion(code);
  }

  function handleSavePoint(point: PainPointInput) {
    setPainPoints((prev) => {
      const rest = prev.filter((p) => p.bodyRegion !== point.bodyRegion);
      return [...rest, point];
    });
    setActiveRegion(null);
  }

  function removePoint(code: string) {
    if (!confirmAction('Remover este ponto de dor do registro?')) return;
    setPainPoints((prev) => prev.filter((p) => p.bodyRegion !== code));
  }

  const editingPoint = activeRegion
    ? painPoints.find((p) => p.bodyRegion === activeRegion)
    : undefined;

  async function onSubmit() {
    const parsed = diaryEntrySchema.safeParse({
      mood,
      energy,
      pain,
      symptoms,
      note: note || undefined,
      vitals: {
        systolic: num(vitals.systolic),
        diastolic: num(vitals.diastolic),
        heartRate: num(vitals.heartRate),
        temperature: num(vitals.temperature),
        weight: num(vitals.weight),
        glucose: num(vitals.glucose),
        oxygen: num(vitals.oxygen),
      },
    });
    if (!parsed.success) {
      const { titulo, descricao } = mensagemDeValidacao(parsed.error.issues, vitals);
      toast.error(titulo, { description: descricao, duration: TEMPO_LEITURA });
      return;
    }
    // PA exige os dois valores
    if ((parsed.data.vitals?.systolic == null) !== (parsed.data.vitals?.diastolic == null)) {
      const faltando = parsed.data.vitals?.systolic == null ? 'PA sistólica' : 'PA diastólica';
      toast.error(`Falta preencher ${faltando}.`, {
        description:
          'A pressão arterial é anotada com os dois números juntos (130 por 80, por exemplo). ' +
          'Complete o que falta — ou apague os dois campos, se você não mediu a pressão hoje.',
        duration: TEMPO_LEITURA,
      });
      return;
    }
    try {
      const entry = await create.mutateAsync(parsed.data);
      const anexou = await anexarPontos(entry.id);

      /*
       * UM salvamento, UM aviso.
       *
       * Antes, quando os pontos de dor falhavam, esta tela disparava dois
       * toasts no mesmo salvamento — o vermelho de "não foi possível anexar"
       * e, logo abaixo, o verde de "registro salvo" — e ainda trocava de tela
       * por cima dos dois. Duas cores opostas ao mesmo tempo não têm leitura
       * possível: foi exatamente essa a confusão relatada. Agora cada caminho
       * termina em um único aviso.
       */
      if (!anexou) {
        setEntradaSalvaId(entry.id);
        toast.warning('Registro salvo. Faltaram os pontos de dor.', {
          description:
            `Humor, energia, dor, sintomas e sinais vitais já estão no seu diário. ${textoPontosFaltando(painPoints.length)} ` +
            'Você pode tentar de novo aqui embaixo, sem refazer o registro.',
          duration: TEMPO_LEITURA,
        });
        return; // fica na tela: as marcações do mapa se perderiam na navegação
      }

      toast.success('Registro salvo no seu diário.', { duration: TEMPO_CONFIRMACAO });
      router.push('/diario');
      router.refresh();
    } catch {
      /*
       * Não escrevemos "nada foi salvo": o salvamento grava a entrada primeiro
       * e os sinais vitais em seguida, então uma falha no meio pode ter deixado
       * parte no banco. Afirmar ausência que não foi confirmada é o erro que já
       * custou caro neste app (o cartão de emergência dizia "nenhuma alergia"
       * quando a consulta falhava). Aqui a tela diz o que fazer e manda conferir.
       */
      toast.error('Não foi possível concluir o salvamento.', {
        description:
          'Verifique sua conexão e toque em “Salvar registro” de novo. Antes de repetir, ' +
          'vale abrir o Diário e conferir se este registro já entrou — assim você não fica com dois.',
        duration: TEMPO_LEITURA,
      });
    }
  }

  /** Anexa os pontos marcados à entrada. `true` = entraram (ou não havia nenhum). */
  async function anexarPontos(diaryEntryId: string): Promise<boolean> {
    if (painPoints.length === 0) return true;
    try {
      await addPain.mutateAsync({
        diaryEntryId,
        points: painPoints.map((p) => ({
          bodyRegion: p.bodyRegion,
          side: p.side,
          intensity: p.intensity,
          type: p.type,
          notes: p.notes,
        })),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Segunda tentativa de anexar — a entrada já existe, só faltam os pontos. */
  async function tentarAnexarDeNovo() {
    if (!entradaSalvaId) return;
    const anexou = await anexarPontos(entradaSalvaId);
    if (!anexou) {
      toast.warning('Ainda não deu para anexar os pontos de dor.', {
        description:
          'O registro de hoje continua salvo no diário — isso não se perdeu. ' +
          'Se a internet estiver instável, tente daqui a pouco.',
        duration: TEMPO_LEITURA,
      });
      return;
    }
    setEntradaSalvaId(null);
    toast.success('Pontos de dor anexados ao registro.', { duration: TEMPO_CONFIRMACAO });
    router.push('/diario');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page hp-page--wellbeing">
      <div className="flex items-center gap-3">
        <Link href="/diario" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Novo registro</h1>
      </div>

      {/* Sliders */}
      <section className="space-y-5 rounded-2xl border border-line bg-surface p-5">
        {/* Cor única e neutra nos três: humor, energia e dor são o CORPO do
            paciente. Pintar dor 8 de vermelho já é interpretar o que o usuário
            está registrando — e o semáforo cru reprovava em contraste. */}
        <Slider label="Humor" value={mood} min={1} max={5} valueLabel={MOOD_LABELS[mood]} onChange={setMood} />
        <Slider label="Energia" value={energy} min={1} max={5} valueLabel={`${energy}/5`} onChange={setEnergy} />
        <Slider label="Dor" value={pain} min={0} max={10} valueLabel={`${pain}/10`} onChange={setPain} />
      </section>

      {/* Sintomas */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-body-sm font-semibold text-fg">Sintomas</h2>
        <SymptomMultiselect value={symptoms} onChange={setSymptoms} />
      </section>

      {/* Mapa de dor no corpo */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-body-sm font-semibold text-fg">Dor no corpo</h2>
          <button
            type="button"
            onClick={() => setShowMap((s) => !s)}
            aria-expanded={showMap}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-line px-3 text-body-sm font-medium text-fg-soft transition hover:bg-surface-2"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            {showMap ? 'Ocultar mapa' : 'Marcar dor no corpo'}
          </button>
        </div>

        {painPoints.length > 0 && (
          <ul className="mb-3 space-y-2" aria-label="Pontos de dor marcados">
            {painPoints.map((p) => (
              <li
                key={p.bodyRegion}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => setActiveRegion(p.bodyRegion)}
                  className="flex min-h-[44px] flex-1 items-center gap-2 text-left text-body-sm text-fg"
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: painIntensityColor(p.intensity) }}
                    aria-hidden
                  />
                  <span className="font-medium">{bodyRegionLabel(p.bodyRegion)}</span>
                  <span className="text-fg-soft">intensidade {p.intensity}/10</span>
                </button>
                <button
                  type="button"
                  onClick={() => removePoint(p.bodyRegion)}
                  aria-label={`Remover ponto de dor em ${bodyRegionLabel(p.bodyRegion)}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-status-alert-ink"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {showMap && (
          <div className="rounded-xl border border-line bg-surface-2/40 p-4">
            <BodyPainMap points={painPoints} onPickRegion={handlePickRegion} />
            <p className="mt-3 text-body-sm leading-relaxed text-fg-soft">{PAIN_DISCLAIMER}</p>
          </div>
        )}
      </section>

      {/* Vitais */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 text-body-sm font-semibold text-fg">Sinais vitais <span className="text-body-sm font-normal text-fg-soft">(opcional)</span></h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VITAL_FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-body-sm text-fg-soft">{f.label}</span>
              <div className="flex items-center rounded-xl border border-line bg-surface-2">
                <input
                  inputMode="decimal"
                  value={vitals[f.key]}
                  onChange={(e) => setVitals((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="min-h-[44px] w-full bg-transparent px-3 text-body-sm text-fg outline-none"
                />
                <span className="px-2 text-body-sm text-fg-soft">{f.unit}</span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Notas + voz */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-body-sm font-semibold text-fg">Notas</h2>
          <VoiceDictationButton onTranscript={(t) => setNote((n) => (n ? `${n} ${t}` : t))} />
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Como foi o seu dia? Você pode ditar por voz."
          className="w-full rounded-xl border border-line bg-surface-2 p-3 text-body-sm text-fg placeholder:text-muted focus:border-sky-400/50 focus:outline-none"
        />
      </section>

      {/*
        Sucesso PARCIAL — a entrada entrou no diário e só os pontos de dor
        ficaram para trás. Não é erro nem sucesso, então não recebe nem o
        vermelho nem o verde: a informação está escrita, que é o canal que
        atravessa daltonismo, sol na tela e prontuário impresso. O aviso mora
        aqui, e não só no toast, porque toast some — e sair da tela agora é o
        que faria as marcações do mapa se perderem de vez.
      */}
      {entradaSalvaId != null && (
        <section
          role="status"
          className="space-y-3 rounded-2xl border border-line bg-surface-2 p-5"
        >
          <h2 className="text-body font-semibold text-fg">Registro salvo. Faltaram os pontos de dor.</h2>
          <p className="text-body-sm leading-relaxed text-fg-soft">
            Humor, energia, dor, sintomas e sinais vitais já estão no seu diário de hoje.{' '}
            {textoPontosFaltando(painPoints.length)} Tentar de novo aqui não cria um segundo
            registro — ele apenas anexa as marcações ao que já foi salvo.
          </p>
          <p className="text-body-sm leading-relaxed text-fg-soft">
            Se você sair desta tela agora, as marcações do mapa não serão guardadas.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={tentarAnexarDeNovo}
              disabled={addPain.isPending}
              className="inline-flex min-h-[44px] items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-body-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 disabled:opacity-60"
            >
              {addPain.isPending ? 'Anexando…' : 'Tentar anexar de novo'}
            </button>
            <Link
              href="/diario"
              className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 text-body-sm text-fg-soft hover:bg-surface"
            >
              Ir para o diário sem os pontos
            </Link>
          </div>
        </section>
      )}

      {entradaSalvaId == null && (
        <div className="flex justify-end gap-2">
          <Link href="/diario" className="inline-flex min-h-[44px] items-center rounded-xl border border-line px-4 text-body-sm text-fg-soft hover:bg-surface-2">Cancelar</Link>
          <button
            onClick={onSubmit}
            disabled={create.isPending || addPain.isPending}
            className="inline-flex min-h-[44px] items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-body-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-90 disabled:opacity-60"
          >
            {create.isPending || addPain.isPending ? 'Salvando…' : 'Salvar registro'}
          </button>
        </div>
      )}

      <PainPointModal
        open={activeRegion != null}
        onClose={() => setActiveRegion(null)}
        regionCode={activeRegion}
        initial={editingPoint}
        onSave={handleSavePoint}
      />
    </div>
  );
}
