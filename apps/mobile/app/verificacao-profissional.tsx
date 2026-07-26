import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Stethoscope, BadgeCheck, Clock, ShieldAlert, Info, Upload, FileText } from 'lucide-react-native';
import { useMyVerification, useSubmitProfessionalVerification, useHubPatientsClient } from '@hubpatients/supabase';
import { PROFESSIONAL_DISCLAIMER, type Json } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, Badge, SectionTitle } from '@/components/ui';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

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

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB',
  'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

type StatusTone = 'attention' | 'ok' | 'alert';

const STATUS_META: Record<string, { label: string; tone: StatusTone; icon: typeof Clock; hint: string }> = {
  pending: {
    label: 'Em análise',
    tone: 'attention',
    icon: Clock,
    hint: 'Recebemos seu pedido. Um administrador vai revisar seus dados em breve.',
  },
  approved: {
    label: 'Selo ativo',
    tone: 'ok',
    icon: BadgeCheck,
    hint: 'Seu selo de médico está ativo no fórum. Revalidamos seu registro a cada 90 dias.',
  },
  rejected: {
    label: 'Não aprovado',
    tone: 'alert',
    icon: ShieldAlert,
    hint: 'Não foi possível confirmar seu registro. Confira os dados e envie novamente.',
  },
  expired: {
    label: 'Expirado',
    tone: 'alert',
    icon: ShieldAlert,
    hint: 'A revalidação venceu. Reenvie seus dados para reativar o selo.',
  },
};

export default function VerificacaoProfissionalScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: verification, isLoading } = useMyVerification(user?.id);
  const submit = useSubmitProfessionalVerification(userId);
  const client = useHubPatientsClient();

  const [number, setNumber] = useState('');
  const [uf, setUf] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [docName, setDocName] = useState<string | null>(null);
  const [docPath, setDocPath] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const status = verification ? STATUS_META[verification.status] : undefined;
  const canResubmit =
    !verification || verification.status === 'rejected' || verification.status === 'expired';

  // Anexa o documento: abre a galeria, sobe a foto do CRM/comprovante para o
  // bucket privado `professional-docs` (pasta = user id, exigida pela RLS) e
  // guarda o storage_path retornado para enviar à mutation.
  async function onPickDocument() {
    setError(null);
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.info('Autorize o acesso às fotos para anexar o documento.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setDocUploading(true);
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = base64ToBytes(b64);
      const ext = asset.mimeType?.includes('png') ? 'png' : 'jpg';
      const path = `${userId}/${Date.now()}_crm.${ext}`;
      const { error: upErr } = await client.storage.from('professional-docs').upload(path, bytes, {
        contentType: asset.mimeType ?? 'image/jpeg',
        upsert: false,
      });
      if (upErr) throw upErr;
      setDocPath(path);
      setDocName(asset.fileName ?? `documento.${ext}`);
      toast.success('Documento anexado.');
    } catch {
      toast.error('Não foi possível anexar o documento.');
    } finally {
      setDocUploading(false);
    }
  }

  async function handleSubmit() {
    setError(null);
    if (!userId) return;
    if (!/^\d{4,6}$/.test(number.trim())) {
      setError('Informe o número do CRM (4 a 6 dígitos).');
      return;
    }
    if (!uf) {
      setError('Selecione o estado (UF) do registro.');
      return;
    }
    if (!docPath) {
      setError('Anexe um documento que comprove seu registro.');
      return;
    }
    try {
      // Consulta informativa ao verify-crm (não concede selo; vira auditoria).
      let verifyResponse: Json | null = null;
      const crm = `${number.trim()}-${uf}`;
      const { data: vData } = await client.functions.invoke('verify-crm', { body: { crm } });
      verifyResponse = (vData as Json) ?? null;

      // Cria o pedido 'pending' — aprovação é do admin.
      await submit.mutateAsync({
        registryNumber: number.trim(),
        registryState: uf,
        documentPath: docPath,
        verifyResponse,
      });
      setNumber('');
      setUf('');
      setSpecialty('');
      setDocName(null);
      setDocPath(null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o pedido.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Verificação profissional" subtitle="Selo de médico" back icon={Stethoscope} />
      <Screen>
        {/* Explicação do selo */}
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-health-300/40 bg-health-300/10 px-4 py-3">
          <BadgeCheck size={18} color={colors.accent} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            Médicos com registro verificado ganham um selo de credibilidade no fórum. {PROFESSIONAL_DISCLAIMER}
          </Text>
        </View>

        {/* Status atual */}
        {isLoading ? (
          <Card>
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
              Carregando seu status…
            </Text>
          </Card>
        ) : status ? (
          <Card className="gap-2">
            <View className="flex-row items-center gap-2">
              <status.icon size={16} color={colors.fg} />
              <Badge tone={status.tone}>{status.label}</Badge>
              {verification?.registry_number ? (
                <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">
                  CRM {verification.registry_number}-{verification.registry_state}
                </Text>
              ) : null}
            </View>
            <Text style={{ fontFamily: fonts.regular }} className="text-[13px] leading-5 text-fg-soft">
              {status.hint}
            </Text>
          </Card>
        ) : null}

        {/* Confirmação do envio */}
        {done ? (
          <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
            <Info size={18} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
              Pedido enviado! Avisaremos quando for revisado.
            </Text>
          </View>
        ) : null}

        {/* Formulário de solicitação */}
        {canResubmit && !done ? (
          <>
            <SectionTitle>Solicitar selo</SectionTitle>
            <Card className="gap-4">
              <Input
                label="Número do CRM"
                value={number}
                onChangeText={(t) => setNumber(t.replace(/\D/g, ''))}
                placeholder="12345"
                keyboardType="number-pad"
                maxLength={6}
              />

              <View className="gap-1.5">
                <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
                  UF do registro
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                >
                  {UFS.map((u) => {
                    const active = uf === u;
                    return (
                      <Pressable
                        key={u}
                        onPress={() => setUf(u)}
                        style={{ borderCurve: 'continuous' }}
                        className={`h-10 min-w-[44px] items-center justify-center rounded-2xl border px-3 active:opacity-80 ${
                          active ? 'border-health-600 bg-health-300/30' : 'border-line bg-surface'
                        }`}
                      >
                        <Text
                          style={{ fontFamily: fonts.semibold }}
                          className={`text-[13px] ${active ? 'text-health-600' : 'text-muted'}`}
                        >
                          {u}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <Input
                label="Especialidade (opcional)"
                value={specialty}
                onChangeText={setSpecialty}
                placeholder="Ex.: Cardiologia"
                autoCapitalize="words"
              />

              {/* Documento comprobatório (obrigatório, espelha a web) */}
              <View className="gap-1.5">
                <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
                  Documento comprobatório (foto do CRM/comprovante)
                </Text>
                <Pressable
                  onPress={onPickDocument}
                  disabled={docUploading}
                  accessibilityRole="button"
                  style={{ borderCurve: 'continuous' }}
                  className={`flex-row items-center gap-2 rounded-2xl border border-dashed px-3 py-3 active:opacity-80 ${
                    docPath ? 'border-health-600 bg-health-300/15' : 'border-line bg-surface-2'
                  }`}
                >
                  {docPath ? (
                    <FileText size={18} color={colors.accent} />
                  ) : (
                    <Upload size={18} color={colors.muted} />
                  )}
                  <Text
                    style={{ fontFamily: fonts.medium }}
                    numberOfLines={1}
                    className={`flex-1 text-[13px] ${docPath ? 'text-accent' : 'text-muted'}`}
                  >
                    {docUploading
                      ? 'Enviando documento…'
                      : docName ?? 'Anexar documento (foto do CRM/comprovante)'}
                  </Text>
                </Pressable>
                <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-4 text-faint">
                  Guardado em armazenamento privado, visível só para você e a moderação.
                </Text>
              </View>

              {error ? (
                <Text style={{ fontFamily: fonts.regular }} className="text-xs text-semaphore-alert">
                  {error}
                </Text>
              ) : null}

              <Button
                label="Enviar para verificação"
                variant="accent"
                icon={BadgeCheck}
                loading={submit.isPending || docUploading}
                onPress={handleSubmit}
              />
            </Card>
          </>
        ) : null}

        {/* Disclaimer fixo */}
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <Info size={16} color={colors.faint} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[11px] leading-5 text-muted">
            O selo é apenas informativo: confirma um registro profissional, mas as participações no fórum não
            substituem uma consulta. A aprovação é feita manualmente pela moderação.
          </Text>
        </View>
      </Screen>
    </View>
  );
}
