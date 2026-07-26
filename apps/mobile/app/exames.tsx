import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { FlaskConical, Plus, Info, FileText, ChevronRight, Camera } from 'lucide-react-native';
import {
  ExamRecordPersistedError,
  removeExamFile,
  useExams,
  useMonthlyUploadCount,
  useHasPlusAccess,
  useCreateExam,
  useHubPatientsClient,
  queryKeys,
} from '@hubpatients/supabase';
import {
  EXAM_CATEGORY_LABELS,
  FREE_UPLOAD_LIMIT,
  safeExamFileName,
  validateExamUpload,
  type ExamCategory,
} from '@hubpatients/core';
import { useActiveProfile } from '@/lib/active-profile';
import { Screen, AppHeader, Card, Input, Button, EmptyState, ErrorState, IconCircle, Badge, SectionTitle } from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { SwipeRow, SkeletonList } from '@/components/feedback';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

const PERIODS = [
  { days: 0, label: 'Tudo' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
];

// base64 → bytes (sem dependência externa) para subir ao storage do Supabase.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i] ?? 'A');
    const b = B64.indexOf(clean[i + 1] ?? 'A');
    const c = clean[i + 2] ? B64.indexOf(clean[i + 2] as string) : 64;
    const d = clean[i + 3] ? B64.indexOf(clean[i + 3] as string) : 64;
    out[p++] = (a << 2) | (b >> 4);
    if (c !== 64) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== 64) out[p++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, p);
}
const CATS: { key: ExamCategory | ''; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'lab', label: 'Laboratorial' },
  { key: 'imaging', label: 'Imagem' },
  { key: 'cardio', label: 'Cardio' },
];

export default function ExamesScreen() {
  useScreenGuard('exames');
  const colors = useColors();
  const { patientId, active: activeProfile } = useActiveProfile();
  const router = useRouter();
  const qc = useQueryClient();
  const pid = patientId || undefined;
  const isPlus = useHasPlusAccess(pid).data ?? false;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela. exams(pid) cobre a lista filtrada
      // (chave estendida com os filtros) por correspondência parcial.
      if (pid) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.exams(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.monthlyUploads(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.hasPlusAccess(pid) }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const [category, setCategory] = useState<ExamCategory | ''>('');
  const [period, setPeriod] = useState(0);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [addCat, setAddCat] = useState<ExamCategory>('lab');
  const [examDate, setExamDate] = useState('');
  const [lab, setLab] = useState('');
  const formSheetRef = useRef<AppSheetHandle>(null);

  const sinceIso = period > 0 ? new Date(Date.now() - period * 86400000).toISOString().slice(0, 10) : undefined;
  const { data: exams, isLoading, isError, refetch } = useExams(pid, { category: category || undefined, sinceIso });
  const { data: monthlyCount } = useMonthlyUploadCount(pid);
  const create = useCreateExam(pid ?? '');
  const client = useHubPatientsClient();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setOpen(false);
    setName('');
    setExamDate('');
    setLab('');
  }, [pid]);

  const used = monthlyCount ?? 0;

  async function onUpload() {
    if (!pid) return;
    if (!isPlus && used >= FREE_UPLOAD_LIMIT) {
      toast.info(`Você atingiu ${FREE_UPLOAD_LIMIT} envios neste mês. Assine o Plus para enviar mais.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.info('Autorize o acesso às fotos para enviar o exame.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploading(true);
    let storagePath: string | null = null;
    try {
      const fileInfo = asset.fileSize == null ? await FileSystem.getInfoAsync(asset.uri) : null;
      const fileSize = asset.fileSize
        ?? (fileInfo?.exists && 'size' in fileInfo ? fileInfo.size : undefined);
      const fileName = asset.fileName ?? asset.uri.split('/').pop() ?? 'exame';
      const validation = validateExamUpload({ name: fileName, type: asset.mimeType, size: fileSize });
      if (!validation.valid) {
        toast.error(validation.message);
        return;
      }

      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = base64ToBytes(b64);
      const path = `${pid}/${Date.now()}_${safeExamFileName(fileName)}`;
      const { error } = await client.storage.from('exams').upload(path, bytes, {
        contentType: validation.mime,
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      storagePath = path;
      await create.mutateAsync({
        exam: {
          title: `Exame ${new Date().toLocaleDateString('pt-BR')}`,
          category: 'lab',
          exam_date: new Date().toISOString().slice(0, 10),
          storage_path: path,
          file_mime: validation.mime,
          status: 'uploaded',
        },
        metrics: [],
      });
      toast.success('Exame enviado. A leitura por IA processa em segundo plano.');
    } catch (error) {
      if (storagePath && !(error instanceof ExamRecordPersistedError)) {
        try {
          await removeExamFile(client, storagePath);
        } catch {
          // Preserva o erro original. Reconciliação server-side cobre falhas raras.
        }
      }
      toast.error(
        error instanceof ExamRecordPersistedError
          ? 'O exame foi salvo, mas o processamento dos resultados falhou.'
          : 'Não foi possível enviar o exame.',
      );
    } finally {
      setUploading(false);
    }
  }

  async function onAdd() {
    if (name.trim().length < 2) {
      toast.info('Informe o nome do exame.');
      return;
    }
    try {
      await create.mutateAsync({
        exam: {
          title: name.trim(),
          category: addCat,
          exam_date: examDate || null,
          lab_name: lab || null,
          status: 'processed',
        },
        metrics: [],
      });
      setName('');
      setExamDate('');
      setLab('');
      formSheetRef.current?.close();
      toast.success('Exame adicionado.');
    } catch {
      toast.error('Não foi possível adicionar o exame.');
    }
  }

  const list = exams ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader
        title="Exames"
        subtitle={activeProfile.isSelf ? 'Sua narrativa de saúde' : `Dados de ${activeProfile.name}`}
        back
        right={
          !isPlus ? (
            <Badge tone="neutral">
              {used}/{FREE_UPLOAD_LIMIT} mês
            </Badge>
          ) : undefined
        }
      />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
          <Info size={16} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            Organizamos e explicamos seus exames em linguagem simples. Apenas seu médico interpreta com o
            contexto completo.
          </Text>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1">
            <Button label="Enviar foto" variant="accent" icon={Camera} loading={uploading} onPress={onUpload} />
          </View>
          <View className="flex-1">
            <Button label="Manual" variant="outline" icon={Plus} onPress={() => setOpen(true)} />
          </View>
        </View>

        {/* Filtros */}
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            {CATS.map((c) => (
              <Pressable
                key={c.key || 'all'}
                onPress={() => setCategory(c.key)}
                style={{ borderCurve: 'continuous' }}
                className={`rounded-full border px-3 py-1.5 ${category === c.key ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'}`}
              >
                <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${category === c.key ? 'text-primary' : 'text-muted'}`}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ borderCurve: 'continuous' }} className="flex-row self-start rounded-xl border border-line bg-surface p-1">
            {PERIODS.map((p) => (
              <Pressable
                key={p.days}
                onPress={() => setPeriod(p.days)}
                style={{ borderCurve: 'continuous' }}
                className={`rounded-lg px-3 py-1.5 ${period === p.days ? 'bg-trust-100' : ''}`}
              >
                <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${period === p.days ? 'text-primary' : 'text-muted'}`}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {isLoading ? (
          <View className="gap-3">
            <SectionTitle>Seus exames</SectionTitle>
            <SkeletonList rows={4} />
          </View>
        ) : isError && !exams ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : list.length > 0 ? (
          <View className="gap-3">
            <SectionTitle>Seus exames</SectionTitle>
            {list.map((e, i) => (
              <FadeInItem key={e.id} index={i} animateExit>
                <SwipeRow
                  rightActions={[
                    { label: 'Abrir', icon: FileText, tone: 'primary', onPress: () => router.push(`/exames/${e.id}` as never) },
                  ]}
                >
                  <Card onPress={() => router.push(`/exames/${e.id}` as never)} className="flex-row items-center gap-3">
                    <IconCircle icon={FileText} tone={e.category === 'cardio' ? 'alert' : e.category === 'imaging' ? 'attention' : 'primary'} size={44} />
                    <View className="flex-1">
                      <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg" numberOfLines={1}>
                        {e.title}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                        {EXAM_CATEGORY_LABELS[e.category]}
                        {e.exam_date ? ` · ${new Date(e.exam_date).toLocaleDateString('pt-BR')}` : ''}
                        {e.lab_name ? ` · ${e.lab_name}` : ''}
                      </Text>
                    </View>
                    <ChevronRight size={20} color={colors.faint} />
                  </Card>
                </SwipeRow>
              </FadeInItem>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={FlaskConical}
            title={category || period ? 'Nenhum exame neste filtro' : 'Nenhum exame ainda'}
            subtitle="Adicione seus exames para acompanhar a evolução dos resultados."
            actionLabel={!category && !period ? 'Adicionar exame' : undefined}
            actionIcon={Plus}
            onAction={!category && !period ? () => setOpen(true) : undefined}
          />
        )}
      </Screen>

      {/* Form manual em bottom sheet arrastável */}
      {open ? (
        <AppSheet ref={formSheetRef} onClose={() => setOpen(false)} title="Adicionar exame manualmente">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-3">
              <Input label="Nome do exame" value={name} onChangeText={setName} placeholder="Ex.: Hemograma completo" />
              <View className="flex-row gap-2">
                {CATS.filter((c) => c.key).map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => setAddCat(c.key as ExamCategory)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: addCat === c.key }}
                    style={{ borderCurve: 'continuous' }}
                    className={`flex-1 items-center rounded-xl border py-2 ${addCat === c.key ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${addCat === c.key ? 'text-accent' : 'text-muted'}`}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input label="Data (AAAA-MM-DD)" value={examDate} onChangeText={setExamDate} placeholder="opcional" />
                </View>
                <View className="flex-1">
                  <Input label="Laboratório" value={lab} onChangeText={setLab} placeholder="opcional" />
                </View>
              </View>
              <Button label="Salvar exame" icon={Plus} loading={create.isPending} onPress={onAdd} />
            </View>
          </ScrollView>
        </AppSheet>
      ) : null}
    </View>
  );
}
