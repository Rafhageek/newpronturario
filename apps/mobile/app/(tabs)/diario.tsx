import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { NotebookPen, CalendarDays, Plus, Activity, ChevronDown, ChevronUp, ChevronRight, MapPin, X, Trash2 } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useDiaryEntries, useCreateDiaryEntryFull, useAddPainPoints, useVitalsAllRange, queryKeys } from '@hubpatients/supabase';
import {
  diaryEntrySchema,
  painPointSchema,
  bodyRegion,
  bodyRegionLabel,
  painIntensityColor,
  painIntensityTextColor,
  formatVital,
  VITAL_TYPES,
  PAIN_TYPES,
  PAIN_TYPE_LABELS,
  PAIN_DISCLAIMER,
  COMMON_SYMPTOMS,
  type PainPointInput,
  type Vital,
} from '@hubpatients/core';
import { useActiveProfile } from '@/lib/active-profile';
import { Screen, AppHeader, Card, Input, Button, EmptyState, Badge, IconCircle } from '@/components/ui';
import { BodyPainMap, type BodyPainMapPoint } from '@/components/body-pain-map';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { VoiceInput } from '@/components/voice-input';
import { toast } from '@/components/toast';
import { haptics } from '@/components/feedback';
import { FadeInItem } from '@/components/motion';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

const MOOD_EMOJI = ['😣', '😕', '😐', '🙂', '😄'];
const PAIN_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Períodos do filtro da timeline — espelha a web (7/30/90/Tudo).
const PERIODS: { days: number; label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 3650, label: 'Tudo' },
];

type SideValue = 'left' | 'right' | 'center';
const SIDE_OPTIONS: SideValue[] = ['left', 'center', 'right'];
const SIDE_LABELS: Record<SideValue, string> = {
  left: 'Esquerdo',
  center: 'Centro',
  right: 'Direito',
};

type VitalsState = {
  systolic: string;
  diastolic: string;
  heartRate: string;
  temperature: string;
  weight: string;
  glucose: string;
  oxygen: string;
};
const EMPTY_VITALS: VitalsState = {
  systolic: '', diastolic: '', heartRate: '', temperature: '', weight: '', glucose: '', oxygen: '',
};

export default function DiarioScreen() {
  useScreenGuard('diario');
  const colors = useColors();
  const router = useRouter();
  const { patientId, active: activeProfile } = useActiveProfile();
  const pid = patientId;
  const { data: entries } = useDiaryEntries(pid || undefined);
  // Vitais de até 1 ano para cruzar com a timeline (mesma janela da web).
  const { data: rangeVitals } = useVitalsAllRange(pid || undefined, 365);
  const create = useCreateDiaryEntryFull(pid);
  const addPain = useAddPainPoints(pid);

  // ── Filtros da timeline ───────────────────────────────────────────────────
  const [period, setPeriod] = useState(30);
  const [symptomFilter, setSymptomFilter] = useState('');

  // Vitais agrupados por data (yyyy-mm-dd) para exibir junto de cada entrada.
  const vitalsByDate = useMemo(() => {
    const map = new Map<string, Vital[]>();
    for (const v of rangeVitals ?? []) {
      const key = v.measured_at.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(v);
      map.set(key, arr);
    }
    return map;
  }, [rangeVitals]);

  // Sintomas distintos vistos nas entradas (para o seletor de filtro).
  const allSymptoms = useMemo(() => {
    const set = new Set<string>();
    (entries ?? []).forEach((e) => e.symptoms.forEach((s) => set.add(s)));
    return [...set].sort();
  }, [entries]);

  // Aplica período + sintoma, espelhando a página web.
  const filteredEntries = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - period);
    return (entries ?? []).filter((e) => {
      if (new Date(e.entry_date) < cutoff) return false;
      if (symptomFilter && !e.symptoms.includes(symptomFilter)) return false;
      return true;
    });
  }, [entries, period, symptomFilter]);

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela (entradas do diário + vitais da timeline).
      if (pid) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.diary(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.vitalsAll(pid, 365) }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const [mood, setMood] = useState<number | undefined>();
  const [energy, setEnergy] = useState<number | undefined>();
  const [pain, setPain] = useState<number | undefined>();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [note, setNote] = useState('');
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [vitals, setVitals] = useState<VitalsState>(EMPTY_VITALS);

  // ── Mapa de dor (múltiplos pontos numa mesma entrada) ─────────────────────
  const [mapOpen, setMapOpen] = useState(false);
  const [painPoints, setPainPoints] = useState<PainPointInput[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  useEffect(() => {
    setMood(undefined);
    setEnergy(undefined);
    setPain(undefined);
    setSymptoms([]);
    setCustomSymptom('');
    setNote('');
    setVitals(EMPTY_VITALS);
    setVitalsOpen(false);
    setPainPoints([]);
    setMapOpen(false);
    setActiveRegion(null);
    setSymptomFilter('');
  }, [pid]);

  const setVital = (key: keyof VitalsState, v: string) => setVitals((s) => ({ ...s, [key]: v }));

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function addCustomSymptom() {
    const t = customSymptom.trim();
    if (t && !symptoms.includes(t)) setSymptoms((prev) => [...prev, t]);
    setCustomSymptom('');
  }

  function handleSavePoint(point: PainPointInput) {
    setPainPoints((prev) => {
      const rest = prev.filter((p) => p.bodyRegion !== point.bodyRegion);
      return [...rest, point];
    });
    setActiveRegion(null);
  }
  function removePoint(code: string) {
    setPainPoints((prev) => prev.filter((p) => p.bodyRegion !== code));
  }

  const editingPoint = activeRegion ? painPoints.find((p) => p.bodyRegion === activeRegion) : undefined;
  const heatmapPoints: BodyPainMapPoint[] = painPoints.map((p) => ({
    bodyRegion: p.bodyRegion,
    intensity: p.intensity,
  }));

  const num = (v: string) => {
    if (v.trim() === '') return undefined;
    // Teclado decimal pt-BR gera vírgula ("36,5"); normaliza p/ não virar NaN.
    const n = Number(v.replace(',', '.').trim());
    return Number.isFinite(n) ? n : undefined;
  };

  async function onAdd() {
    const anyVital = Object.values(vitals).some((v) => v.trim() !== '');
    const vitalsInput = anyVital
      ? {
          systolic: num(vitals.systolic),
          diastolic: num(vitals.diastolic),
          heartRate: num(vitals.heartRate),
          temperature: num(vitals.temperature),
          weight: num(vitals.weight),
          glucose: num(vitals.glucose),
          oxygen: num(vitals.oxygen),
        }
      : undefined;

    const parsed = diaryEntrySchema.safeParse({
      entryDate: new Date(),
      mood,
      energy,
      pain,
      symptoms,
      note: note || undefined,
      vitals: vitalsInput,
    });
    if (!parsed.success) {
      toast.info(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    // PA exige os dois valores: se preencheu sistólica OU diastólica, exigir ambas.
    if ((parsed.data.vitals?.systolic == null) !== (parsed.data.vitals?.diastolic == null)) {
      toast.info('Informe sistólica e diastólica juntas.');
      return;
    }

    try {
      const entry = await create.mutateAsync(parsed.data);
      // Pontos de dor são opcionais — falha aqui não invalida a entrada.
      if (painPoints.length > 0) {
        try {
          await addPain.mutateAsync({
            diaryEntryId: entry.id,
            points: painPoints.map((p) => ({
              bodyRegion: p.bodyRegion,
              side: p.side,
              intensity: p.intensity,
              type: p.type,
              notes: p.notes,
            })),
          });
        } catch {
          toast.error('Entrada salva, mas não foi possível anexar os pontos de dor.');
        }
      }
      setMood(undefined); setEnergy(undefined); setPain(undefined);
      setSymptoms([]); setCustomSymptom(''); setNote('');
      setVitals(EMPTY_VITALS); setVitalsOpen(false);
      setPainPoints([]); setMapOpen(false);
      toast.success('Entrada do diário salva.');
      /*
       * SEM confete aqui. Registrar o diário é rotina DIÁRIA: confete todo dia
       * esvazia a celebração (o marco deixa de significar marco) e joga dezenas
       * de elementos se movendo ao mesmo tempo, o pior caso vestibular (P5). O
       * `celebrate()` continua existindo em `components/celebration.tsx` para
       * marcos de verdade.
       *
       * O que confirma a ação agora: háptico de RESULTADO (a escrita concluiu)
       * + o formulário zerado + a entrada nova entrando na timeline pelo
       * `FadeInItem` (FadeInDown em springPhysics.calm, ζ = 1,0) — um elemento
       * se movendo por vez, exatamente onde a pessoa vai olhar.
       */
      haptics.success();
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Diário"
        subtitle={activeProfile.isSelf ? 'Como você se sente hoje' : `Registro de ${activeProfile.name}`}
        icon={NotebookPen}
      />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        {/* Atalho para o histórico de dor (mapa corporal) */}
        <Card onPress={() => router.push('/diario/dor' as never)} className="flex-row items-center gap-3">
          <IconCircle icon={Activity} tone="alert" size={40} />
          <View className="flex-1">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">Histórico de dor</Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">Mapa corporal acumulado por região</Text>
          </View>
          <ChevronRight size={20} color={colors.faint} />
        </Card>

        <Card className="gap-4">
          <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">Nova entrada</Text>

          <Scale label="Humor" value={mood} onChange={setMood} render={(i) => MOOD_EMOJI[i - 1] ?? ''} />
          <Scale label="Energia" value={energy} onChange={setEnergy} render={(i) => String(i)} />

          {/* Dor 0–10 (escala completa) */}
          <View>
            <View className="mb-1.5 flex-row items-center justify-between">
              <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">Dor</Text>
              {pain != null ? (
                <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-muted">{pain}/10</Text>
              ) : null}
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {PAIN_SCALE.map((v) => {
                const on = pain === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setPain(v)}
                    accessibilityRole="button"
                    accessibilityLabel={`Dor ${v} de 10`}
                    accessibilityState={{ selected: on }}
                    style={{ borderCurve: 'continuous', backgroundColor: on ? painIntensityColor(v) : undefined }}
                    className={`h-9 w-9 items-center justify-center rounded-xl border ${on ? 'border-transparent' : 'border-line bg-surface-2'}`}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold, color: on ? painIntensityTextColor(v) : colors.muted }}
                      className="text-[13px]"
                    >
                      {v}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sintomas — multiselect por chips + custom */}
          <View>
            <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Sintomas</Text>
            <View className="flex-row flex-wrap gap-2">
              {COMMON_SYMPTOMS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => toggleSymptom(s)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={{ borderCurve: 'continuous' }}
                    className={`rounded-full border px-3 py-1.5 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-primary' : 'text-muted'}`}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Sintomas personalizados (fora da lista comum) com remover */}
            {symptoms.filter((s) => !COMMON_SYMPTOMS.includes(s)).length > 0 ? (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {symptoms.filter((s) => !COMMON_SYMPTOMS.includes(s)).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => toggleSymptom(s)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover sintoma ${s}`}
                    style={{ borderCurve: 'continuous' }}
                    className="flex-row items-center gap-1.5 rounded-full border border-trust-600 bg-trust-100 px-3 py-1.5"
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-primary">{s}</Text>
                    <X size={12} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View className="mt-2 flex-row items-end gap-2">
              <View className="flex-1">
                <Input
                  value={customSymptom}
                  onChangeText={setCustomSymptom}
                  placeholder="Outro sintoma…"
                  returnKeyType="done"
                  onSubmitEditing={addCustomSymptom}
                />
              </View>
              <Button label="Add" icon={Plus} variant="outline" size="sm" onPress={addCustomSymptom} />
            </View>
          </View>

          {/*
            Anotação — o único campo de texto livre da entrada, e onde digitar
            mais dói (tremor, artrose, presbiopia). O ditado fica colado no
            campo, não escondido num menu; e o que for reconhecido só entra
            aqui depois de a pessoa conferir no painel.
          */}
          <View className="gap-2">
            <Input label="Anotação" value={note} onChangeText={setNote} placeholder="Como foi seu dia?" multiline />
            <VoiceInput
              title="Ditar a anotação"
              hint="Conte como foi o seu dia: o que sentiu, quando começou e o que melhorou."
              contextualStrings={COMMON_SYMPTOMS}
              onConfirm={(texto) =>
                setNote((atual) => (atual.trim().length > 0 ? `${atual.trim()} ${texto}` : texto))
              }
            />
          </View>

          {/* Mapa de dor no corpo (interativo) */}
          <View>
            <Pressable
              onPress={() => setMapOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityState={{ expanded: mapOpen }}
              className="flex-row items-center gap-2"
            >
              <MapPin size={16} color={colors.primary} />
              <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[13px] text-primary">
                {mapOpen ? 'Ocultar mapa de dor' : 'Marcar dor no corpo'}
              </Text>
              {mapOpen ? <ChevronUp size={16} color={colors.faint} /> : <ChevronDown size={16} color={colors.faint} />}
            </Pressable>

            {painPoints.length > 0 ? (
              <View className="mt-2 gap-2" accessibilityLabel="Pontos de dor marcados">
                {painPoints.map((p) => (
                  <View
                    key={p.bodyRegion}
                    style={{ borderCurve: 'continuous' }}
                    className="flex-row items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2"
                  >
                    <Pressable
                      onPress={() => setActiveRegion(p.bodyRegion)}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar dor em ${bodyRegionLabel(p.bodyRegion)}, intensidade ${p.intensity} de 10`}
                      className="flex-1 flex-row items-center gap-2"
                    >
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: painIntensityColor(p.intensity) }} />
                      <Text style={{ fontFamily: fonts.semibold }} className="text-[13px] text-fg">{bodyRegionLabel(p.bodyRegion)}</Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">intensidade {p.intensity}/10</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => removePoint(p.bodyRegion)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ponto de dor em ${bodyRegionLabel(p.bodyRegion)}`}
                      hitSlop={8}
                      className="h-9 w-9 items-center justify-center rounded-xl active:opacity-70"
                    >
                      <Trash2 size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {mapOpen ? (
              <View
                style={{ borderCurve: 'continuous' }}
                className="mt-3 rounded-2xl border border-line bg-surface-2 p-4"
              >
                <BodyPainMap
                  points={heatmapPoints}
                  onPickRegion={setActiveRegion}
                  selectedRegion={activeRegion}
                />
                <Text style={{ fontFamily: fonts.regular }} className="mt-3 text-[11px] leading-4 text-muted">{PAIN_DISCLAIMER}</Text>
              </View>
            ) : null}
          </View>

          {/* Sinais vitais opcionais (7 campos) */}
          <Pressable
            onPress={() => setVitalsOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: vitalsOpen }}
            className="flex-row items-center gap-2"
          >
            <Activity size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[13px] text-primary">Registrar sinais vitais (opcional)</Text>
            {vitalsOpen ? <ChevronUp size={16} color={colors.faint} /> : <ChevronDown size={16} color={colors.faint} />}
          </Pressable>
          {vitalsOpen ? (
            <View className="gap-3">
              <View className="flex-row gap-3">
                <View className="flex-1"><Input label="Sistólica (mmHg)" value={vitals.systolic} onChangeText={(v) => setVital('systolic', v)} keyboardType="number-pad" placeholder="120" /></View>
                <View className="flex-1"><Input label="Diastólica (mmHg)" value={vitals.diastolic} onChangeText={(v) => setVital('diastolic', v)} keyboardType="number-pad" placeholder="80" /></View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1"><Input label="Freq. cardíaca (bpm)" value={vitals.heartRate} onChangeText={(v) => setVital('heartRate', v)} keyboardType="number-pad" placeholder="72" /></View>
                <View className="flex-1"><Input label="Temperatura (°C)" value={vitals.temperature} onChangeText={(v) => setVital('temperature', v)} keyboardType="decimal-pad" placeholder="36.5" /></View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1"><Input label="Glicemia (mg/dL)" value={vitals.glucose} onChangeText={(v) => setVital('glucose', v)} keyboardType="number-pad" placeholder="95" /></View>
                <View className="flex-1"><Input label="SpO₂ (%)" value={vitals.oxygen} onChangeText={(v) => setVital('oxygen', v)} keyboardType="number-pad" placeholder="98" /></View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1"><Input label="Peso (kg)" value={vitals.weight} onChangeText={(v) => setVital('weight', v)} keyboardType="decimal-pad" placeholder="72" /></View>
                <View className="flex-1" />
              </View>
            </View>
          ) : null}

          <Button label="Adicionar ao diário" icon={Plus} loading={create.isPending} onPress={onAdd} />
        </Card>

        {/* Filtros da timeline — período + sintoma (espelha a web) */}
        {entries && entries.length > 0 ? (
          <View className="gap-2.5">
            {/* Período: 7 / 30 / 90 / Tudo */}
            <View
              style={{ borderCurve: 'continuous' }}
              className="flex-row rounded-2xl border border-line bg-surface p-1"
            >
              {PERIODS.map((p) => {
                const on = period === p.days;
                return (
                  <Pressable
                    key={p.days}
                    onPress={() => setPeriod(p.days)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar por ${p.label}`}
                    accessibilityState={{ selected: on }}
                    style={{ borderCurve: 'continuous' }}
                    className={`flex-1 items-center justify-center rounded-xl py-2 ${on ? 'bg-trust-100' : ''}`}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className={`text-[12px] ${on ? 'text-primary' : 'text-muted'}`}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Sintoma: chips horizontais ("Todos" + cada sintoma visto) */}
            {allSymptoms.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                accessibilityLabel="Filtrar por sintoma"
              >
                {[''].concat(allSymptoms).map((s) => {
                  const on = symptomFilter === s;
                  const label = s === '' ? 'Todos' : s;
                  return (
                    <Pressable
                      key={s === '' ? '__all__' : s}
                      onPress={() => setSymptomFilter(s)}
                      accessibilityRole="button"
                      accessibilityLabel={s === '' ? 'Todos os sintomas' : `Filtrar por ${s}`}
                      accessibilityState={{ selected: on }}
                      style={{ borderCurve: 'continuous' }}
                      className={`rounded-full border px-3 py-1.5 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
                    >
                      <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-primary' : 'text-muted'}`}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {entries && entries.length > 0 ? (
          filteredEntries.length > 0 ? (
            <View className="gap-3">
              {filteredEntries.map((entry, i) => {
                const dayVitals = vitalsByDate.get(entry.entry_date) ?? [];
                return (
                  <FadeInItem key={entry.id} index={i}>
                    <Card>
                      <View className="flex-row items-center gap-2.5">
                        <IconCircle icon={CalendarDays} tone="primary" size={36} />
                        <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
                          {new Date(entry.entry_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </Text>
                        {entry.mood ? <Text className="text-[18px]">{MOOD_EMOJI[entry.mood - 1] ?? ''}</Text> : null}
                      </View>
                      {entry.symptoms.length > 0 ? (
                        <View className="mt-2 flex-row flex-wrap gap-1.5">
                          {entry.symptoms.map((s) => <Badge key={s} tone="attention">{s}</Badge>)}
                        </View>
                      ) : null}
                      {/* Sinais vitais registrados nesse dia (cruzados por data) */}
                      {dayVitals.length > 0 ? (
                        <View className="mt-2 flex-row flex-wrap gap-1.5" accessibilityLabel="Sinais vitais do dia">
                          {dayVitals.map((v) => (
                            <View
                              key={v.id}
                              style={{ borderCurve: 'continuous' }}
                              className="flex-row items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1"
                            >
                              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">{VITAL_TYPES[v.type].label}:</Text>
                              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg">{formatVital(v)}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {entry.note ? <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-[14px] leading-5 text-fg-soft">{entry.note}</Text> : null}
                      {(entry.energy != null || entry.pain != null) ? (
                        <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-[12px] text-muted">
                          {entry.energy != null ? `Energia ${entry.energy}/5` : ''}
                          {entry.energy != null && entry.pain != null ? ' · ' : ''}
                          {entry.pain != null ? `Dor ${entry.pain}/10` : ''}
                        </Text>
                      ) : null}
                    </Card>
                  </FadeInItem>
                );
              })}
            </View>
          ) : (
            <EmptyState icon={NotebookPen} title="Nenhum registro neste período" subtitle="Ajuste o período ou o sintoma para ver mais entradas do seu diário." />
          )
        ) : (
          <EmptyState icon={NotebookPen} title="Seu diário está vazio" subtitle="Registrar humor, sintomas e sinais ajuda você e seu médico a ver padrões." />
        )}
      </Screen>

      {/* Folha de registro de um ponto de dor (intensidade/lado/tipo/nota) */}
      {activeRegion != null ? (
        <PainPointSheet
          regionCode={activeRegion}
          initial={editingPoint}
          onClose={() => setActiveRegion(null)}
          onSave={handleSavePoint}
        />
      ) : null}
    </View>
  );
}

function Scale({ label, value, onChange, render }: { label: string; value?: number; onChange: (v: number) => void; render: (i: number) => string }) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">{label}</Text>
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            onPress={() => onChange(i)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${i} de 5`}
            accessibilityState={{ selected: value === i }}
            style={{ borderCurve: 'continuous' }}
            className={`h-11 flex-1 items-center justify-center rounded-2xl border ${value === i ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
          >
            <Text style={{ fontFamily: fonts.semibold }} className={`text-[16px] ${value === i ? 'text-accent' : 'text-muted'}`}>
              {render(i)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Folha de registro de um ponto de dor — espelha o pain-point-modal da web:
 * intensidade 0–10, lado (com default no lado da região), tipo e nota.
 * Valida com `painPointSchema` antes de devolver ao pai.
 */
function PainPointSheet({
  regionCode,
  initial,
  onClose,
  onSave,
}: {
  regionCode: string;
  initial?: PainPointInput;
  onClose: () => void;
  onSave: (point: PainPointInput) => void;
}) {
  const colors = useColors();
  const sheetRef = useRef<AppSheetHandle>(null);
  const region = bodyRegion(regionCode);
  const isLateral = region?.side === 'left' || region?.side === 'right';

  const [intensity, setIntensity] = useState<number>(initial?.intensity ?? 3);
  const [side, setSide] = useState<SideValue>(
    (initial?.side as SideValue) ?? (region?.side as SideValue) ?? 'center',
  );
  const [type, setType] = useState<string | undefined>(initial?.type);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // Guarda o ponto validado e fecha com animação; o pai recebe via onClose.
  const pendingRef = useRef<PainPointInput | null>(null);

  function handleSave() {
    const parsed = painPointSchema.safeParse({
      bodyRegion: regionCode,
      side,
      intensity,
      type: type || undefined,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      toast.info(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    pendingRef.current = parsed.data;
    sheetRef.current?.close();
  }

  return (
    <AppSheet
      ref={sheetRef}
      onClose={() => {
        const pending = pendingRef.current;
        if (pending) onSave(pending);
        else onClose();
      }}
      title={region ? `Dor em: ${region.label_pt}` : 'Registrar dor'}
    >
      <View className="gap-4 pb-2">
        {/* Intensidade 0–10 */}
        <View>
          <View className="mb-1.5 flex-row items-center justify-between">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">Intensidade</Text>
            <View
              style={{ backgroundColor: painIntensityColor(intensity), borderCurve: 'continuous' }}
              className="h-7 min-w-[32px] items-center justify-center rounded-lg px-2"
            >
              <Text style={{ fontFamily: fonts.semibold, color: painIntensityTextColor(intensity) }} className="text-[13px]">
                {intensity}
              </Text>
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {PAIN_SCALE.map((v) => {
              const on = intensity === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setIntensity(v)}
                  accessibilityRole="button"
                  accessibilityLabel={`Intensidade ${v} de 10`}
                  accessibilityState={{ selected: on }}
                  style={{ borderCurve: 'continuous', backgroundColor: on ? painIntensityColor(v) : undefined }}
                  className={`h-9 w-9 items-center justify-center rounded-xl border ${on ? 'border-transparent' : 'border-line bg-surface-2'}`}
                >
                  <Text style={{ fontFamily: fonts.semibold, color: on ? painIntensityTextColor(v) : colors.muted }} className="text-[13px]">
                    {v}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Lado */}
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Lado</Text>
          <View className="flex-row flex-wrap gap-2">
            {SIDE_OPTIONS.map((s) => {
              const on = side === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSide(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ borderCurve: 'continuous' }}
                  className={`rounded-xl border px-4 py-2.5 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className={`text-[13px] ${on ? 'text-primary' : 'text-fg-soft'}`}>
                    {SIDE_LABELS[s]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {isLateral ? (
            <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-[11px] text-muted">
              Esta região já indica um lado; você pode ajustar se necessário.
            </Text>
          ) : null}
        </View>

        {/* Tipo de dor */}
        <View>
          <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Tipo de dor (opcional)</Text>
          <View className="flex-row flex-wrap gap-2">
            {PAIN_TYPES.map((t) => {
              const on = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(on ? undefined : t)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={{ borderCurve: 'continuous' }}
                  className={`rounded-full border px-4 py-2 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'}`}
                >
                  <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${on ? 'text-primary' : 'text-fg-soft'}`}>
                    {PAIN_TYPE_LABELS[t] ?? t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notas */}
        <Input
          label="Notas (opcional)"
          value={notes}
          onChangeText={setNotes}
          maxLength={300}
          placeholder="Ex.: piora ao caminhar"
        />

        <Button label="Salvar ponto" onPress={handleSave} />
      </View>
    </AppSheet>
  );
}
