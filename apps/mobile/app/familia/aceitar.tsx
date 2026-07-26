import { useState } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HeartHandshake, Link2Off, CheckCircle2, ShieldCheck, LogIn } from 'lucide-react-native';
import { useFamilyMutations } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Button, IconCircle } from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInBlock } from '@/components/motion';
import { useColors, fonts } from '@/theme';

/**
 * Aceitar convite de família por token (link / deep link).
 *
 * Esta rota responde a `/familia/aceitar?token=XYZ` — inclusive via deep link
 * `hubpatients://familia/aceitar?token=XYZ`, que o expo-router resolve pelo `scheme`
 * já configurado para o OAuth. Lê o token com `useLocalSearchParams` e oferece
 * aceitar ou adiar. O _layout raiz já redireciona para o login quando não há
 * sessão; ainda assim tratamos o caso "não logado" para não chamar o aceite com
 * um usuário ausente enquanto a sessão é restaurada.
 */
export default function AceitarConviteScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuth();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { accept } = useFamilyMutations(user?.id ?? '');

  // 'expired' cobre tanto inválido quanto expirado/não destinado à conta.
  const [status, setStatus] = useState<'idle' | 'expired' | 'done'>('idle');

  const goToFamilia = () => router.replace('/familia');

  async function handleAccept() {
    if (!token) return;
    try {
      await accept.mutateAsync(token);
      setStatus('done');
      toast.success('Vínculo criado! Você já está conectado.');
      setTimeout(goToFamilia, 1200);
    } catch {
      setStatus('expired');
      toast.error('Convite inválido, expirado ou não é para a sua conta.');
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Convite de cuidado" subtitle="Conectar com quem cuida de você" icon={HeartHandshake} back />
      <Screen>
        <FadeInBlock>
          {/* Sem token: link incompleto/inválido. */}
          {!token ? (
            <Card className="items-center gap-3 py-8">
              <IconCircle icon={Link2Off} tone="alert" size={56} />
              <Text style={{ fontFamily: fonts.display }} className="text-center text-[17px] text-fg">
                Link de convite inválido
              </Text>
              <Text
                selectable
                style={{ fontFamily: fonts.regular }}
                className="text-center text-[14px] leading-5 text-muted"
              >
                Este link não contém um convite válido. Peça para a pessoa enviar o convite novamente.
              </Text>
              <View className="mt-1 w-full">
                <Button label="Ir para Família" variant="outline" onPress={goToFamilia} />
              </View>
            </Card>
          ) : !user ? (
            /* Sessão ainda não resolvida / não logado. O _layout leva ao login;
               aqui só explicamos enquanto isso acontece. */
            <Card className="items-center gap-3 py-8">
              <IconCircle icon={LogIn} tone="primary" size={56} />
              <Text style={{ fontFamily: fonts.display }} className="text-center text-[17px] text-fg">
                Entre para aceitar
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-center text-[14px] leading-5 text-muted">
                Faça login na sua conta para aceitar este convite de cuidado.
              </Text>
            </Card>
          ) : status === 'expired' ? (
            /* Aceite falhou: token inválido/expirado/de outra conta. */
            <Card className="items-center gap-3 py-8">
              <IconCircle icon={Link2Off} tone="alert" size={56} />
              <Text style={{ fontFamily: fonts.display }} className="text-center text-[17px] text-fg">
                Convite inválido ou expirado
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-center text-[14px] leading-5 text-muted">
                Não foi possível usar este convite. Ele pode ter expirado, já ter sido aceito ou ser para outra conta.
              </Text>
              <View className="mt-1 w-full">
                <Button label="Ir para Família" variant="outline" onPress={goToFamilia} />
              </View>
            </Card>
          ) : status === 'done' ? (
            /* Sucesso: feedback antes do redirect automático. */
            <Card className="items-center gap-3 py-8">
              <IconCircle icon={CheckCircle2} tone="accent" size={56} />
              <Text style={{ fontFamily: fonts.display }} className="text-center text-[17px] text-fg">
                Vínculo criado!
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-center text-[14px] leading-5 text-muted">
                Tudo certo. Levando você para a Família…
              </Text>
            </Card>
          ) : (
            /* Estado inicial: cartão de convite com aceitar / agora não. */
            <Card className="gap-4 py-6">
              <View className="items-center gap-3">
                <IconCircle icon={HeartHandshake} tone="primary" size={56} />
                <Text style={{ fontFamily: fonts.display }} className="text-center text-[18px] text-fg">
                  Você foi convidado para conectar
                </Text>
                <Text
                  style={{ fontFamily: fonts.regular }}
                  className="text-center text-[14px] leading-5 text-muted"
                >
                  Ao aceitar, será criado um vínculo de cuidado conforme as permissões definidas por quem te convidou.
                </Text>
              </View>

              <View className="flex-row items-start gap-2.5 rounded-2xl bg-surface-2 p-3" style={{ borderCurve: 'continuous' }}>
                <ShieldCheck size={18} color={colors.primary} />
                <Text style={{ fontFamily: fonts.regular }} className="flex-1 text-[12px] leading-4 text-muted">
                  Você pode revisar ou encerrar este vínculo a qualquer momento na tela Família.
                </Text>
              </View>

              <View className="gap-2">
                <Button
                  label="Aceitar convite"
                  icon={CheckCircle2}
                  loading={accept.isPending}
                  onPress={handleAccept}
                />
                <Button
                  label="Agora não"
                  variant="ghost"
                  disabled={accept.isPending}
                  onPress={goToFamilia}
                />
              </View>
            </Card>
          )}
        </FadeInBlock>
      </Screen>
    </View>
  );
}
