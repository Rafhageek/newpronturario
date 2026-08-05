import { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Clock,
  QrCode,
  Share2,
  ShieldCheck,
  Stethoscope,
  Trash2,
  TriangleAlert,
} from 'lucide-react-native';
import {
  useAccessTokens,
  useIssueAccessToken,
  useRevokeAccessToken,
  PatMfaRequiredError,
  SHARE_SCOPES,
  CONSULTATION_SCOPES,
  SHARE_PRESETS,
  DEFAULT_SHARE_SCOPES,
  DEFAULT_SHARE_PRESET,
  buildShareUrl,
  formatTimeLeft,
  isShareActive,
  shareScopeLabel,
  type IssuedAccess,
  type SharePresetId,
  type ShareScope,
} from '@hubpatients/supabase';

/**
 * O que a tela oferece: apenas os escopos que `issue_consultation_access_token`
 * aceita. `SHARE_SCOPES` é a lista do token de API, mais larga — oferecer
 * "Identificação" aqui era uma armadilha: a caixa marcava e o banco derrubava a
 * emissão inteira. Derivado (não redigitado) para as legendas seguirem uma
 * fonte só.
 */
const ESCOLHAS = SHARE_SCOPES.filter((s) =>
  (CONSULTATION_SCOPES as readonly string[]).includes(s.key),
);

import { DISCLAIMERS } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, SectionTitle, EmptyState, Button, Badge } from '@/components/ui';
import { toast } from '@/components/toast';
import { useColors, fonts } from '@/theme';

/**
 * Modo Consulta (mobile) — "Mostrar ao meu médico".
 *
 * Gera um acesso temporário e só de leitura, exibe o QR em tamanho grande para
 * o médico apontar a câmera e lista os acessos ativos com revogação imediata.
 *
 * Sem `Intl` em nenhuma formatação: o Hermes não traz `RelativeTimeFormat` e
 * derruba o app. A contagem regressiva vem de `formatTimeLeft` (feita à mão).
 */

/**
 * Base pública da web. O link precisa apontar para o domínio onde roda o
 * `apps/web` (rota `/consulta/<token>`).
 * TODO: expor `webUrl` em `app.config.ts > extra` para não depender de env solto
 * no bundle (hoje o fallback vale para o domínio de produção).
 */
const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://hubpatients.app';

export default function CompartilharScreen() {
  const colors = useColors();
  const { user } = useAuth();
  const uid = user?.id;

  /*
   * `isError` não é detalhe de UX aqui. "Ninguém está vendo seus registros
   * agora" é uma afirmação sobre a privacidade da pessoa, e a lista vazia da
   * falha produzia exatamente essa frase: alguém confere a tela, lê que não há
   * acesso ativo e sai tranquila — com um link aberto que ela teria revogado se
   * soubesse. Falha é falha, com chance de tentar de novo.
   */
  const {
    data: accesses = [],
    isLoading,
    isError: accessesFailed,
    isFetching: accessesFetching,
    refetch: refetchAccesses,
  } = useAccessTokens(uid);
  const issue = useIssueAccessToken(uid);
  const revoke = useRevokeAccessToken(uid);

  const [preset, setPreset] = useState<SharePresetId>(DEFAULT_SHARE_PRESET);
  const [scopes, setScopes] = useState<ShareScope[]>(DEFAULT_SHARE_SCOPES);
  const [issued, setIssued] = useState<IssuedAccess | null>(null);
  const [issuedUrl, setIssuedUrl] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);

  // Relógio de 1 s para a contagem regressiva.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function toggleScope(key: ShareScope) {
    setScopes((current) =>
      current.includes(key) ? current.filter((s) => s !== key) : [...current, key],
    );
  }

  async function handleGenerate() {
    if (issue.isPending) return;
    if (scopes.length === 0) {
      toast.info('Escolha ao menos uma informação para compartilhar.');
      return;
    }
    setNeedsMfa(false);
    try {
      const result = await issue.mutateAsync({ scopes, preset });
      setIssued(result);
      setIssuedUrl(buildShareUrl(WEB_BASE_URL, result.token));
      toast.success('Acesso criado. Mostre o QR ao seu médico.');
    } catch (error) {
      if (error instanceof PatMfaRequiredError) {
        setNeedsMfa(true);
        toast.error('Ative a verificação em duas etapas para gerar um acesso.');
        return;
      }
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o acesso.');
    }
  }

  async function handleShare() {
    if (!issuedUrl) return;
    try {
      await Share.share({
        message: `Meu resumo de saúde no HubPatients (acesso temporário): ${issuedUrl}`,
        url: issuedUrl,
      });
    } catch {
      toast.error('Não foi possível abrir o compartilhamento.');
    }
  }

  async function handleRevoke(id: string) {
    if (revoke.isPending) return;
    try {
      await revoke.mutateAsync(id);
      if (issued?.id === id) {
        setIssued(null);
        setIssuedUrl('');
      }
      toast.success('Acesso encerrado. O link parou de funcionar agora.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível encerrar.');
    }
  }

  const active = useMemo(
    () => accesses.filter((a) => isShareActive(a, now)),
    [accesses, now],
  );

  const issuedExpiresMs = issued ? Date.parse(issued.expiresAt) : Number.NaN;
  const issuedLeft = Number.isFinite(issuedExpiresMs) ? issuedExpiresMs - now : 0;
  const issuedExpired = issued != null && issuedLeft <= 0;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Mostrar ao médico" subtitle="Acesso temporário ao seu resumo" back />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 56, gap: 16 }}>
        {/* Como funciona */}
        <Card className="flex-row gap-2.5">
          <ShieldCheck size={16} color={colors.primary} style={{ marginTop: 2 }} />
          <Text
            style={{ fontFamily: fonts.regular }}
            className="flex-1 text-[12px] leading-5 text-fg-soft"
          >
            {DISCLAIMERS.dataSharing} O acesso expira sozinho, é só de leitura e mostra apenas o que
            você marcar.
          </Text>
        </Card>

        {/* QR do acesso recém-criado */}
        {issued ? (
          <Card className="gap-3">
            {issuedExpired ? (
              <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                Este acesso expirou. Gere outro quando precisar.
              </Text>
            ) : (
              <>
                <View className="flex-row items-center gap-2">
                  <Text
                    style={{ fontFamily: fonts.semibold }}
                    className="flex-1 text-[14px] text-fg"
                  >
                    Pronto! Mostre este código.
                  </Text>
                  <View className="flex-row items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1">
                    <Clock size={12} color={colors.muted} />
                    <Text style={{ fontFamily: fonts.medium }} className="text-[11px] text-muted">
                      {formatTimeLeft(issuedLeft)}
                    </Text>
                  </View>
                </View>

                {/* Fundo branco fixo: leitores precisam de contraste real mesmo no tema escuro. */}
                <View
                  style={{ borderCurve: 'continuous' }}
                  className="items-center self-center rounded-2xl border border-line bg-white p-4"
                >
                  <QRCode value={issuedUrl} size={240} color="#000000" backgroundColor="#ffffff" />
                </View>

                <Text
                  style={{ fontFamily: fonts.regular }}
                  className="text-center text-[12px] text-muted"
                >
                  Peça para o médico apontar a câmera. O link aparece só agora — saindo da tela,
                  gere um novo se precisar.
                </Text>

                <Button label="Enviar link" icon={Share2} variant="outline" onPress={handleShare} />
                <Pressable
                  onPress={() => void handleRevoke(issued.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Encerrar este acesso agora"
                  className="flex-row items-center justify-center gap-1.5 py-2 active:opacity-60"
                >
                  <Trash2 size={14} color={colors.alert} />
                  <Text
                    style={{ fontFamily: fonts.medium }}
                    className="text-[13px] text-semaphore-alert"
                  >
                    Encerrar agora
                  </Text>
                </Pressable>
              </>
            )}
          </Card>
        ) : null}

        {/* Validade */}
        <SectionTitle>Por quanto tempo?</SectionTitle>
        <Card className="gap-2">
          {SHARE_PRESETS.map((p) => {
            const selected = preset === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPreset(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${p.label}. ${p.hint}`}
                style={{ borderCurve: 'continuous' }}
                className={`flex-row items-center gap-3 rounded-2xl border px-3 py-3 active:opacity-70 ${
                  selected ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'
                }`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selected ? 'border-trust-600' : 'border-line'
                  }`}
                >
                  {selected ? <View className="h-2.5 w-2.5 rounded-full bg-trust-600" /> : null}
                </View>
                <View className="flex-1">
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                    {p.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                    {p.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </Card>

        {/* Escopos */}
        <SectionTitle>O que o médico verá?</SectionTitle>
        <Card className="gap-2">
          {ESCOLHAS.map((s) => {
            const checked = scopes.includes(s.key);
            return (
              <Pressable
                key={s.key}
                onPress={() => toggleScope(s.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${s.label}. ${s.hint}`}
                style={{ borderCurve: 'continuous' }}
                className={`flex-row items-center gap-3 rounded-2xl border px-3 py-3 active:opacity-70 ${
                  checked ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface-2'
                }`}
              >
                <View
                  className={`h-5 w-5 items-center justify-center rounded-md border-2 ${
                    checked ? 'border-trust-600 bg-trust-600' : 'border-line'
                  }`}
                >
                  {checked ? (
                    <Text style={{ fontFamily: fonts.bold }} className="text-[11px] text-white">
                      ✓
                    </Text>
                  ) : null}
                </View>
                <View className="flex-1">
                  <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                    {s.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                    {s.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {needsMfa ? (
            <View className="flex-row gap-2 rounded-2xl bg-amber-100 px-3 py-2.5">
              <TriangleAlert size={14} color={colors.attention} style={{ marginTop: 2 }} />
              <Text
                style={{ fontFamily: fonts.regular }}
                className="flex-1 text-[11px] leading-4 text-fg-soft"
              >
                Para criar um acesso é preciso ter a verificação em duas etapas (2FA) ativa e
                concluída nesta sessão. Ative em Configurações.
              </Text>
            </View>
          ) : null}

          <Button
            label={issue.isPending ? 'Gerando…' : 'Gerar acesso para o médico'}
            icon={QrCode}
            variant="primary"
            onPress={handleGenerate}
            disabled={issue.isPending || scopes.length === 0}
          />
        </Card>

        {/* Acessos ativos */}
        <SectionTitle>Acessos ativos</SectionTitle>
        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : accessesFailed ? (
          <Card className="gap-2">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
              Não foi possível carregar seus acessos
            </Text>
            <Text
              style={{ fontFamily: fonts.regular }}
              className="text-[12px] leading-4 text-fg-soft"
            >
              Esta lista não carregou, então ela não prova que ninguém está vendo seus registros:
              pode haver acesso ativo que não aparece aqui. Tente de novo antes de considerar a
              lista vazia.
            </Text>
            <Button
              label="Tentar de novo"
              size="sm"
              variant="outline"
              loading={accessesFetching}
              onPress={() => void refetchAccesses()}
            />
          </Card>
        ) : active.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="Nenhum acesso ativo"
            subtitle="Ninguém está vendo seus registros agora."
          />
        ) : (
          <Card className="gap-1">
            {active.map((a, i) => {
              const left = a.expires_at ? Date.parse(a.expires_at) - now : 0;
              return (
                <View
                  key={a.id}
                  className={`flex-row items-center gap-3 py-3 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <View className="flex-1 gap-1">
                    <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                      {a.name}
                    </Text>
                    <View className="flex-row flex-wrap gap-1">
                      {a.scopes.map((sc) => (
                        <Badge key={sc} tone="info">
                          {shareScopeLabel(sc)}
                        </Badge>
                      ))}
                    </View>
                    <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                      Expira em {formatTimeLeft(left)}
                      {' · '}
                      {a.last_used_at ? 'já foi aberto' : 'ainda não aberto'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void handleRevoke(a.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Revogar acesso ${a.name}`}
                    hitSlop={8}
                    style={{ borderCurve: 'continuous' }}
                    className="flex-row items-center gap-1 rounded-xl border border-line px-2.5 py-2 active:opacity-60"
                  >
                    <Trash2 size={14} color={colors.alert} />
                    <Text
                      style={{ fontFamily: fonts.medium }}
                      className="text-[12px] text-semaphore-alert"
                    >
                      Revogar
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}

        <Text
          style={{ fontFamily: fonts.regular }}
          className="text-[11px] leading-4 text-muted"
        >
          Registros informados por você — não constituem laudo médico. {DISCLAIMERS.notDiagnosis}
        </Text>
      </ScrollView>
    </View>
  );
}
