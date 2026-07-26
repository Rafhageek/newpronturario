import { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Constants from 'expo-constants';
import { FileText, Printer } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Card, Button, IconCircle } from '@/components/ui';
import { toast } from '@/components/toast';
import { fonts } from '@/theme';

/**
 * "Gerar resumo para a consulta" (mobile).
 *
 * Abre o relatório A4 da Edge Function `clinical-report` no NAVEGADOR DO
 * SISTEMA (Linking.openURL). O navegador é quem imprime/salva em PDF — nenhuma
 * biblioteca nativa nova, então isto sai por OTA, sem exigir APK novo.
 *
 * Privacidade: o token de sessão vai no FRAGMENTO da URL (`#t=…`). Fragmento
 * não é enviado ao servidor — não aparece em log de requisição do gateway — e a
 * página apaga o fragmento da barra de endereço assim que carrega.
 *
 * O relatório NÃO é laudo: só o dado, a data e a série, sem interpretação.
 */

type SectionKey = 'alergias' | 'medicamentos' | 'vitais' | 'exames' | 'diario' | 'linha_do_tempo';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'alergias', label: 'Alergias' },
  { key: 'medicamentos', label: 'Medicamentos' },
  { key: 'vitais', label: 'Medidas' },
  { key: 'exames', label: 'Exames' },
  { key: 'diario', label: 'Diário' },
  { key: 'linha_do_tempo', label: 'Últimos registros' },
];

const DEFAULT_SECTIONS: SectionKey[] = ['alergias', 'medicamentos', 'vitais', 'exames', 'diario'];

const PERIODS = [
  { days: 30 as const, label: '30 dias' },
  { days: 90 as const, label: '90 dias' },
];

const extra = Constants.expoConfig?.extra as { supabaseUrl?: string } | undefined;
const SUPABASE_URL = (extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');

export function ClinicalReportButton({ patientId }: { patientId: string }) {
  const [days, setDays] = useState<30 | 90>(30);
  const [sections, setSections] = useState<SectionKey[]>(DEFAULT_SECTIONS);
  const [busy, setBusy] = useState(false);

  function toggleSection(key: SectionKey) {
    setSections((current) =>
      current.includes(key) ? current.filter((s) => s !== key) : [...current, key],
    );
  }

  async function open() {
    if (!patientId || !SUPABASE_URL) {
      toast.error('Não foi possível montar o resumo agora.');
      return;
    }
    if (sections.length === 0) {
      toast.info('Escolha pelo menos uma parte para incluir.');
      return;
    }

    setBusy(true);
    try {
      const { data: current } = await supabase.auth.getSession();
      let session = current.session;
      // Token quase vencido: renova ANTES de mandar para o navegador — lá fora
      // não há como renovar, e o resumo falharia depois de abrir a aba.
      if (!session || (session.expires_at ?? 0) * 1000 - Date.now() < 120_000) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session ?? session;
      }
      const token = session?.access_token;
      if (!token) {
        toast.error('Sua sessão expirou. Entre novamente.');
        return;
      }

      // Montado à mão: o URLSearchParams do React Native é um polyfill parcial
      // (não codifica os valores). encodeURIComponent aqui é explícito e seguro.
      const hash = [
        `t=${encodeURIComponent(token)}`,
        `p=${encodeURIComponent(patientId)}`,
        `days=${days}`,
        `sections=${encodeURIComponent(sections.join(','))}`,
      ].join('&');
      const url = `${SUPABASE_URL}/functions/v1/clinical-report#${hash}`;
      await Linking.openURL(url);
    } catch {
      toast.error('Não foi possível abrir o navegador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <IconCircle icon={FileText} tone="primary" size={44} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
            Resumo para a consulta
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[13px] text-muted">
            Uma página com o que você registrou, para imprimir ou salvar em PDF.
          </Text>
        </View>
      </View>

      {/* Período */}
      <View className="gap-1.5">
        <Text
          maxFontSizeMultiplier={1.6}
          style={{ fontFamily: fonts.medium }}
          className="text-[13px] text-fg-soft"
        >
          Período
        </Text>
        <View style={{ borderCurve: 'continuous' }} className="flex-row rounded-2xl border border-line bg-surface-2 p-1">
          {PERIODS.map((p) => {
            const on = days === p.days;
            return (
              <Pressable
                key={p.days}
                onPress={() => setDays(p.days)}
                accessibilityRole="button"
                accessibilityLabel={`Últimos ${p.days} dias`}
                accessibilityState={{ selected: on }}
                style={{ borderCurve: 'continuous' }}
                className={`flex-1 items-center rounded-xl py-2.5 ${on ? 'bg-trust-100' : ''}`}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-[13px] ${on ? 'text-primary' : 'text-muted'}`}
                >
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Seções */}
      <View className="gap-1.5">
        <Text
          maxFontSizeMultiplier={1.6}
          style={{ fontFamily: fonts.medium }}
          className="text-[13px] text-fg-soft"
        >
          O que incluir
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {SECTIONS.map((s) => {
            const on = sections.includes(s.key);
            return (
              <Pressable
                key={s.key}
                onPress={() => toggleSection(s.key)}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                accessibilityState={{ selected: on }}
                style={{ borderCurve: 'continuous' }}
                className={`rounded-full border px-3.5 py-2 ${on ? 'border-trust-600 bg-trust-100' : 'border-line bg-surface'}`}
              >
                <Text
                  style={{ fontFamily: fonts.semibold }}
                  className={`text-[13px] ${on ? 'text-primary' : 'text-muted'}`}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Button
        label="Gerar resumo para a consulta"
        icon={Printer}
        loading={busy}
        disabled={sections.length === 0}
        onPress={open}
      />

      <Text
        maxFontSizeMultiplier={1.6}
        style={{ fontFamily: fonts.regular }}
        className="text-[12px] text-muted"
      >
        Abre no navegador do celular. Toque em “Imprimir ou salvar em PDF”. Dados autorreferidos pelo
        paciente. Não constitui laudo nem substitui avaliação profissional.
      </Text>
    </Card>
  );
}
