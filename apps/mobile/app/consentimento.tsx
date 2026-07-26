import { useState } from 'react';
import { View, Text, Switch, Modal, Pressable, TextInput, ActivityIndicator, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  Download,
  Trash2,
  Info,
  ScrollText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useConsents, useSetConsent, useAuditLog, useExportData, useDeleteAccount } from '@hubpatients/supabase';
import {
  CONSENT_TEXT_VERSION,
  DATA_CATEGORY_LABELS,
  LEGAL_BASIS_LABEL,
  NO_DATA_FOR_BENEFIT_NOTICE,
  SECTOR_CONSENT_NOTICE,
  SECTOR_LABELS,
  SECTOR_ORDER,
  SHARING_MODE_LABELS,
  scopesBySector,
  type AuditAction,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, SectionTitle, Button, Divider } from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Criou',
  read: 'Acessou',
  update: 'Alterou',
  delete: 'Excluiu',
  export: 'Exportou',
  print: 'Imprimiu',
  share: 'Compartilhou',
};
const RESOURCE_LABELS: Record<string, string> = {
  consent: 'consentimento',
  exam: 'exame',
  vitals: 'sinais vitais',
  medication: 'medicamento',
};

const PAGE_SIZE = 10;
const EXPORT_FILENAME = 'hubpatients-meus-dados.json';

export default function ConsentimentoScreen() {
  useScreenGuard('consentimento');
  const colors = useColors();
  const { user, signOut } = useAuth();
  const userId = user?.id ?? '';
  const { data: consents } = useConsents(user?.id);
  const setConsent = useSetConsent(userId);

  const [page, setPage] = useState(0);
  const { data: auditPage } = useAuditLog(user?.id, page, PAGE_SIZE);

  const exportData = useExportData(userId);
  const del = useDeleteAccount();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const granted = new Map((consents ?? []).map((c) => [c.purpose, c.granted]));

  const entries = auditPage?.entries ?? [];
  const total = auditPage?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleExport() {
    try {
      // Mesmo export paginado/fail-closed da web, com manifesto e schema.
      const data = await exportData.mutateAsync();
      const json = JSON.stringify(data, null, 2);

      // Escreve o JSON completo num arquivo de cache e compartilha o ARQUIVO de verdade.
      const uri = `${FileSystem.cacheDirectory ?? ''}${EXPORT_FILENAME}`;
      await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });

      try {
        // expo-sharing anexa o arquivo de verdade (inclusive no Android, onde o Share
        // do RN não aceita arquivo). Share.share fica só como último recurso.
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/json',
            dialogTitle: 'Meus dados — HubPatients (LGPD Art. 18)',
            UTI: 'public.json',
          });
        } else {
          await Share.share({
            title: 'Meus dados — HubPatients (LGPD Art. 18)',
            message: `Seus dados foram exportados em JSON e salvos no dispositivo:\n${uri}`,
          });
        }
      } finally {
        // PHI (LGPD): não deixar o JSON no cache após compartilhar/cancelar.
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      toast.error('Não foi possível exportar seus dados agora. Tente de novo em instantes.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Privacidade" subtitle="Você no controle dos seus dados (LGPD)" back />
      <Screen>
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
          <Info size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[12px] leading-5 text-fg-soft">
            Você decide quem vê seus dados. Pode ativar ou revogar qualquer permissão a qualquer momento,
            conforme a LGPD.
          </Text>
        </View>

        {/* Nada é enviado automaticamente. Dizer isso é transparência (art. 9º):
            prometer compartilhamento que não existe seria informação falsa. */}
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <Info size={16} color={colors.muted} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            {SECTOR_CONSENT_NOTICE}
          </Text>
        </View>

        {SECTOR_ORDER.map((sector) => {
          const scopes = scopesBySector(sector);
          if (scopes.length === 0) return null;
          return (
            <View key={sector}>
              <SectionTitle>{SECTOR_LABELS[sector]}</SectionTitle>
              <Card className="gap-1">
                {scopes.map((scope, i) => {
                  const on = granted.get(scope.purpose) ?? false;
                  return (
                    <View key={scope.purpose}>
                      {i > 0 ? <Divider /> : null}
                      <View className="py-2.5">
                        <View className="flex-row items-center gap-3">
                          <View className="flex-1">
                            <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                              {scope.label}
                            </Text>
                            <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                              {scope.description}
                            </Text>
                          </View>
                          <Switch
                            value={on}
                            onValueChange={(v) =>
                              // `version` = qual texto a pessoa leu ao decidir.
                              // É a prova de consentimento do art. 8º, §1º.
                              setConsent.mutate({
                                purpose: scope.purpose,
                                granted: v,
                                scope: {
                                  data: scope.defaultData,
                                  sharing: scope.sharing,
                                  legalBasis: scope.legalBasis,
                                },
                                version: CONSENT_TEXT_VERSION,
                              })
                            }
                            trackColor={{ false: colors.line, true: colors.accent }}
                            thumbColor="#ffffff"
                            accessibilityRole="switch"
                            accessibilityState={{ checked: on }}
                            accessibilityLabel={scope.label}
                          />
                        </View>

                        {/* O que sai daqui aparece SEMPRE, não só quando ligado:
                            a pessoa precisa saber antes de decidir. */}
                        <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-[11px] text-muted">
                          {SHARING_MODE_LABELS[scope.sharing]}
                        </Text>

                        {scope.limit ? (
                          <Text
                            style={{ fontFamily: fonts.regular }}
                            className="mt-1.5 text-[11px] leading-4 text-fg-soft"
                          >
                            {scope.limit}
                          </Text>
                        ) : null}

                        {on && scope.defaultData.length > 0 ? (
                          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                            {scope.defaultData.map((d) => (
                              <View key={d} className="rounded-full bg-trust-50 px-2.5 py-1">
                                <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-primary">
                                  {DATA_CATEGORY_LABELS[d]}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-[11px] text-hint">
                          {scope.legalBasis}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>
          );
        })}

        {/* Por que não existe "dados em troca de desconto" — é expectativa
            razoável de quem lê a tela, e merece resposta em vez de silêncio. */}
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-line bg-surface-2 px-4 py-3">
          <Info size={16} color={colors.muted} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            {NO_DATA_FOR_BENEFIT_NOTICE}
          </Text>
        </View>

        {/* Log de acessos / auditoria */}
        <SectionTitle action={total > 0 ? <Text className="text-[12px] text-muted">{total}</Text> : undefined}>
          Log de acessos
        </SectionTitle>
        <Card className="gap-1">
          <View className="mb-1 flex-row items-center gap-2">
            <ScrollText size={18} color={colors.primary} />
            <Text className="flex-1 text-[12px] text-muted">Quem acessou ou alterou seus dados, e quando.</Text>
          </View>

          {entries.length === 0 ? (
            <Text className="py-2 text-[13px] text-muted">Nenhum acesso registrado ainda.</Text>
          ) : (
            entries.map((e, i) => {
              const purpose = (e.metadata as { purpose?: string } | null)?.purpose;
              const action = ACTION_LABELS[e.action] ?? e.action;
              const resource = RESOURCE_LABELS[e.resource_type] ?? e.resource_type;
              const when = new Date(e.created_at).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <FadeInItem key={e.id} index={i}>
                  {i > 0 ? <Divider /> : null}
                  <View className="flex-row items-center justify-between gap-3 py-2.5">
                    <View className="flex-1">
                      <Text className="text-[14px] text-fg">
                        {action} {resource}
                        {purpose ? ` · ${purpose}` : ''}
                      </Text>
                      <Text className="text-[11px] text-muted">{LEGAL_BASIS_LABEL}</Text>
                    </View>
                    <Text className="shrink-0 text-[11px] text-muted">{when}</Text>
                  </View>
                </FadeInItem>
              );
            })
          )}

          {pages > 1 ? (
            <View className="mt-1 flex-row items-center justify-end gap-3">
              <Pressable
                disabled={page === 0}
                onPress={() => setPage((p) => p - 1)}
                className="rounded-lg p-1 active:opacity-60"
                style={page === 0 ? { opacity: 0.4 } : undefined}
              >
                <ChevronLeft size={18} color={colors.muted} />
              </Pressable>
              <Text className="text-[12px] text-muted">
                {page + 1} / {pages}
              </Text>
              <Pressable
                disabled={page + 1 >= pages}
                onPress={() => setPage((p) => p + 1)}
                className="rounded-lg p-1 active:opacity-60"
                style={page + 1 >= pages ? { opacity: 0.4 } : undefined}
              >
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
        </Card>

        <SectionTitle>Seus dados</SectionTitle>
        <Card className="gap-2">
          <Button
            label={exportData.isPending ? 'Exportando…' : 'Exportar meus dados'}
            variant="outline"
            icon={Download}
            loading={exportData.isPending}
            onPress={handleExport}
          />
          <Text className="px-1 text-[11px] leading-4 text-muted">
            JSON completo com manifesto, schema e todos os registros estruturados vinculados à sua conta.
          </Text>
          <Button label="Solicitar exclusão da conta" variant="ghost" icon={Trash2} onPress={() => setDeleteOpen(true)} />
        </Card>
      </Screen>

      <DeleteAccountModal
        open={deleteOpen}
        email={user?.email ?? ''}
        pending={del.isPending}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async (password) => {
          try {
            await del.mutateAsync({ email: user?.email ?? '', password });
            toast.success('Solicitação registrada. Sua sessão será encerrada.');
            // O RPC registra e audita; o provider sincroniza a sessão local.
            await signOut();
            setDeleteOpen(false);
            // A navegação para o login é feita pelo RootNavigator ao detectar a sessão nula.
          } catch {
            toast.error('Senha incorreta ou falha ao processar. Tente novamente.');
          }
        }}
      />
    </View>
  );
}

function DeleteAccountModal({
  open,
  email,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  email: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const colors = useColors();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function reset() {
    setPassword('');
    setConfirm('');
  }

  function close() {
    reset();
    onClose();
  }

  const canSubmit = password.length >= 6 && confirm.trim().toUpperCase() === 'EXCLUIR' && !pending;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <View
          style={{ borderCurve: 'continuous' }}
          className="gap-4 rounded-t-3xl border border-line bg-surface px-5 pb-8 pt-5"
        >
          <View className="flex-row items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <AlertTriangle size={20} color={colors.alert} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[13px] leading-5 text-fg-soft">
              A solicitação será registrada e sua sessão será encerrada. Os dados não são apagados
              imediatamente: o processamento considera obrigações legais de guarda e será confirmado quando concluído.
            </Text>
          </View>

          <View className="gap-1.5">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
              Sua senha
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              placeholder="••••••"
              placeholderTextColor={colors.faint}
              style={[{ fontFamily: fonts.regular }, { borderCurve: 'continuous' }]}
              className="h-12 rounded-2xl border border-line bg-bg px-4 text-[15px] text-fg"
            />
          </View>

          <View className="gap-1.5">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
              Digite <Text className="font-bold text-rose-700">EXCLUIR</Text> para confirmar
            </Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="EXCLUIR"
              placeholderTextColor={colors.faint}
              style={[{ fontFamily: fonts.regular }, { borderCurve: 'continuous' }]}
              className="h-12 rounded-2xl border border-line bg-bg px-4 text-[15px] text-fg"
            />
          </View>

          <View className="mt-1 flex-row gap-3">
            <View className="flex-1">
              <Button label="Cancelar" variant="outline" onPress={close} />
            </View>
            <Pressable
              onPress={() => onConfirm(password)}
              disabled={!canSubmit}
              style={[{ height: 50, borderRadius: 16, borderCurve: 'continuous' }, !canSubmit ? { opacity: 0.5 } : null]}
              className="flex-1 flex-row items-center justify-center gap-2 bg-rose-500 px-4 active:opacity-85"
            >
              {pending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Trash2 size={18} color={colors.white} />
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-white">
                    Enviar solicitação
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {email ? (
            <Text className="text-center text-[11px] text-faint">Solicitação para {email}</Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
