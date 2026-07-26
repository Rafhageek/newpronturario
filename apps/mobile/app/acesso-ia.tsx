import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Bot, KeyRound, Sparkles, Check, Trash2, Copy } from 'lucide-react-native';
import {
  useMyTokens,
  useCreateToken,
  useRevokeToken,
  useHasAiAssistant,
  useHubPatientsClient,
  PatMfaRequiredError,
} from '@hubpatients/supabase';
import { AI_TOKEN_SCOPES, AI_ACCESS_DISCLAIMER } from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { AiDisclosure } from '@/components/ai-disclosure';
import { Screen, AppHeader, Card, Input, Button, Badge, EmptyState, SectionTitle, Divider } from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

export default function AcessoIaScreen() {
  useScreenGuard('acesso-ia');
  const colors = useColors();
  const { user } = useAuth();
  const supabase = useHubPatientsClient();
  const userId = user?.id ?? '';
  const { data: tokens } = useMyTokens(user?.id);
  const { data: eligible } = useHasAiAssistant(user?.id);
  const create = useCreateToken(userId);
  const revoke = useRevokeToken(userId);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read:profile', 'read:medications']);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  function toggle(key: string) {
    setScopes((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  }

  async function onGenerate() {
    if (!name.trim() || scopes.length === 0) {
      toast.info('Dê um nome e marque ao menos um escopo.');
      return;
    }
    if (!password) {
      toast.info('Confirme sua senha (segunda etapa).');
      return;
    }
    setBusy(true);
    try {
      const email = user?.email;
      if (!email) {
        toast.error('Sessão inválida. Entre novamente.');
        return;
      }
      // Reautenticação obrigatória antes de emitir o token (espelha a web).
      const reauth = await supabase.auth.signInWithPassword({ email, password });
      if (reauth.error) {
        toast.error('Não foi possível confirmar sua identidade.');
        return;
      }
      const token = await create.mutateAsync({
        name: name.trim(),
        scopes,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      });
      setGenerated(token);
      setName('');
      setPassword('');
    } catch (error) {
      toast.error(
        error instanceof PatMfaRequiredError
          ? 'Ative ou conclua a verificação em duas etapas (2FA) e tente novamente.'
          : 'Não foi possível gerar o token.',
      );
    } finally {
      setBusy(false);
    }
  }

  const active = (tokens ?? []).filter(
    (t) => !t.revoked_at && Boolean(t.expires_at) && new Date(t.expires_at as string) > new Date(),
  );

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Acesso de IA" subtitle="Token de leitura para seu assistente" icon={Bot} back />
      <Screen>
        <View className="flex-row items-start gap-2.5 rounded-2xl border border-trust-100 bg-trust-50 px-4 py-3">
          <KeyRound size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-5 text-fg-soft">
            {AI_ACCESS_DISCLAIMER}
          </Text>
        </View>

        {/* Disclosure de IA (CFM 2.454/2026): tudo que o assistente responder a
            partir daqui é apoio de IA — com direito de recusa a qualquer momento. */}
        <AiDisclosure
          taskType="record_access"
          sources={['Seus dados de prontuário, restritos aos escopos marcados abaixo']}
          note="Um token dá ao seu assistente de IA acesso de LEITURA ao seu prontuário. Tudo que ele responder a partir desses dados é apoio de IA — estimativa educativa, nunca diagnóstico. O modelo e a versão de prompt dependem do assistente que você conectar e, por isso, não são registrados pelo HubPatients."
        />

        {eligible != null ? (
          <Badge tone={eligible ? 'ok' : 'neutral'}>
            {eligible ? 'Assistente de IA habilitado' : 'Você já pode gerar tokens de leitura'}
          </Badge>
        ) : null}

        {/* Token recém-gerado */}
        {generated ? (
          <Card className="gap-2 border-health-400/40">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
              Seu novo token (copie agora!)
            </Text>
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
              Por segurança, ele não será exibido de novo. Segure para copiar.
            </Text>
            <Text
              selectable
              style={{ fontFamily: fonts.regular }}
              className="rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-fg"
            >
              {generated}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Copy size={13} color={colors.faint} />
              <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
                Segure no texto acima → Copiar
              </Text>
            </View>
          </Card>
        ) : null}

        {/* Gerar */}
        <SectionTitle>Gerar novo token</SectionTitle>
        <Card className="gap-3">
          <Input label="Nome (ex.: Meu Claude)" value={name} onChangeText={setName} placeholder="Meu assistente" />
          <View className="gap-1.5">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
              Escopos (somente leitura)
            </Text>
            {AI_TOKEN_SCOPES.map((s) => {
              const on = scopes.includes(s.key);
              return (
                <Pressable
                  key={s.key}
                  onPress={() => toggle(s.key)}
                  style={{ borderCurve: 'continuous' }}
                  className={`flex-row items-center gap-3 rounded-2xl border px-3 py-2.5 ${on ? 'border-health-400/50 bg-health-300/15' : 'border-line bg-surface-2'}`}
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded-md border ${on ? 'border-accent bg-accent' : 'border-line bg-surface'}`}
                  >
                    {on ? <Check size={14} color="#fff" /> : null}
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
          </View>
          <Input
            label="Confirme sua senha (segunda etapa)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            placeholder="••••••••"
          />
          <Button label="Gerar token" icon={Sparkles} loading={busy} onPress={onGenerate} />
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-faint">
            Endpoint: GET /api/v1/me com Authorization: Bearer. Expira em 90 dias.
          </Text>
        </Card>

        {/* Ativos */}
        <SectionTitle>Tokens ativos</SectionTitle>
        {active.length === 0 ? (
          <EmptyState icon={KeyRound} title="Nenhum token ativo" subtitle="Gere um para conectar seu assistente de IA." />
        ) : (
          <Card className="gap-0.5">
            {active.map((t, i) => (
              <FadeInItem key={t.id} index={i}>
                <View>
                  {i > 0 ? <Divider /> : null}
                  <View className="flex-row items-center gap-3 py-2.5">
                    <View className="flex-1">
                      <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                        {t.name}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                        {t.token_prefix} · {t.last_used_at ? `usado ${new Date(t.last_used_at).toLocaleDateString('pt-BR')}` : 'nunca usado'}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                        {t.expires_at
                          ? `Expira em ${new Date(t.expires_at).toLocaleDateString('pt-BR')}`
                          : 'Requer rotação'}
                      </Text>
                      <View className="mt-1 flex-row flex-wrap gap-1">
                        {t.scopes.map((sc) => (
                          <Badge key={sc} tone="info">
                            {sc.replace('read:', '')}
                          </Badge>
                        ))}
                      </View>
                    </View>
                    <Pressable
                      onPress={() => revoke.mutate(t.id)}
                      className="h-9 w-9 items-center justify-center rounded-xl border border-rose-200 active:bg-rose-50"
                    >
                      <Trash2 size={16} color={colors.alert} />
                    </Pressable>
                  </View>
                </View>
              </FadeInItem>
            ))}
          </Card>
        )}
      </Screen>
    </View>
  );
}
