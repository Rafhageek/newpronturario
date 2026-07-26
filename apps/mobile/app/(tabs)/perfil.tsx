import { useState, type ReactNode } from 'react';
import { View, Text, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import {
  User, LogOut, ChevronDown, ChevronUp, Plus, Trash2, ShieldAlert, Stethoscope,
  Scissors, Users, CreditCard, FileDown, type LucideIcon, AlertTriangle,
} from 'lucide-react-native';
import {
  useProfile, useUpdateProfile, useAllergies, useAllergyMutations, useConditions,
  useConditionMutations, useSurgeries, useSurgeryMutations, useFamilyHistory, useFamilyHistoryMutations,
  useInsurance, useUpsertInsurance, useHasPlusAccess, queryKeys,
} from '@hubpatients/supabase';
import { useQueryClient } from '@tanstack/react-query';
import {
  BIOLOGICAL_SEX_LABELS, ALLERGY_SEVERITY, CONDITION_STATUS_LABELS, FAMILY_RELATIONSHIP_LABELS,
  calculateAge, DISCLAIMERS, formatCPF, profileSchema,
  type AllergySeverity, type ConditionStatus, type FamilyRelationship, type BloodType,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { AppHeader, Card, Input, Button, IconCircle, Badge, Divider } from '@/components/ui';
import { useTabBarSpace } from '@/components/tab-bar';
import { toast } from '@/components/toast';
import { useScreenGuard } from '@/components/screen-guard';
import { useColors, fonts } from '@/theme';

const BLOOD: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

export default function PerfilScreen() {
  useScreenGuard('perfil');
  const colors = useColors();
  const tabBarSpace = useTabBarSpace();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const pid = user?.id ?? '';
  const { data: profile } = useProfile(user?.id);
  const { data: allergies } = useAllergies(user?.id);
  const { data: conditions } = useConditions(pid || undefined);
  const { data: surgeries } = useSurgeries(pid || undefined);
  const { data: familyHistory } = useFamilyHistory(pid || undefined);
  const { data: insuranceData } = useInsurance(pid || undefined);
  const insurance = Array.isArray(insuranceData) ? insuranceData[0] : insuranceData;
  const age = profile?.date_of_birth ? calculateAge(profile.date_of_birth) : null;
  const severe = (allergies ?? []).filter((a) => a.severity === 'severe');

  const isPlus = useHasPlusAccess(pid || undefined).data ?? false;
  const [exporting, setExporting] = useState(false);

  // Exportar PDF — espelha o "Exportar PDF" da web (resumo do prontuário p/ levar ao médico).
  // Gated por Plus: sem Plus → toast + /planos; com Plus → gera HTML e compartilha via expo-print/expo-sharing.
  async function handleExportPdf() {
    if (!isPlus) {
      toast.info('Exportar o prontuário em PDF faz parte do HubPatients Plus.');
      router.push('/planos');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const html = buildProntuarioHtml({
        profile,
        age,
        insurance,
        allergies: allergies ?? [],
        conditions: conditions ?? [],
        surgeries: surgeries ?? [],
        familyHistory: familyHistory ?? [],
      });
      const { uri } = await Print.printToFileAsync({ html });
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            UTI: 'com.adobe.pdf',
            dialogTitle: 'Resumo do prontuário',
          });
        } else {
          toast.info('Compartilhamento indisponível neste dispositivo.');
        }
      } finally {
        // PHI (LGPD): não deixar o PDF do prontuário no cache após compartilhar/cancelar.
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
    } catch {
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setExporting(false);
    }
  }

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela (prontuário pessoal), não o cache inteiro.
      if (pid) {
        await Promise.all([
          qc.invalidateQueries({ queryKey: queryKeys.profile(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.allergies(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.conditions(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.surgeries(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.familyHistory(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.insurance(pid) }),
          qc.invalidateQueries({ queryKey: queryKeys.hasPlusAccess(pid) }),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // QR de emergência: resumo de dados vitais
  const emergencyText =
    `HubPatients — Emergência\nNome: ${profile?.full_name ?? '—'}\n` +
    `Idade: ${age ?? '—'}\nTipo sanguíneo: ${profile && profile.blood_type !== 'unknown' ? profile.blood_type : '—'}\n` +
    `Alergias graves: ${severe.map((a) => a.substance).join(', ') || 'nenhuma'}`;

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Meu perfil" subtitle="Seu prontuário pessoal" icon={User} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarSpace, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Identidade + QR emergência */}
        <Card className="items-center gap-2 py-5">
          <IconCircle icon={User} tone="primary" size={64} />
          <Text style={{ fontFamily: fonts.displayX }} className="text-[20px] text-fg">
            {profile?.full_name ?? 'Seu nome'}
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
            {[age != null ? `${age} anos` : null, profile?.blood_type !== 'unknown' ? profile?.blood_type : null]
              .filter(Boolean)
              .join(' · ') || user?.email}
          </Text>
          {insurance?.operator || severe.length > 0 ? (
            <View className="mt-1 flex-row flex-wrap items-center justify-center gap-1.5">
              {insurance?.operator ? (
                <View className="flex-row items-center gap-1">
                  <CreditCard size={12} color={colors.muted} />
                  <Badge tone="neutral">{insurance.operator}</Badge>
                </View>
              ) : null}
              {severe.map((a) => (
                <View key={a.id} className="flex-row items-center gap-1">
                  <AlertTriangle size={12} color={colors.alert} />
                  <Badge tone="alert">{a.substance}</Badge>
                </View>
              ))}
            </View>
          ) : null}
          <View className="mt-2 items-center gap-1.5 rounded-2xl border border-line bg-surface-2 p-3" style={{ borderCurve: 'continuous' }}>
            <QRCode value={emergencyText} size={120} color={colors.fg} backgroundColor="transparent" />
            <Text style={{ fontFamily: fonts.medium }} className="text-[11px] text-muted">
              Cartão de emergência
            </Text>
          </View>
          <View className="mt-1 w-full">
            <Button
              label={isPlus ? 'Exportar PDF' : 'Exportar PDF (Plus)'}
              variant="outline"
              icon={FileDown}
              loading={exporting}
              onPress={handleExportPdf}
            />
            <Text style={{ fontFamily: fonts.regular }} className="mt-1.5 text-center text-[11px] text-muted">
              Resumo do prontuário para levar ao médico
            </Text>
          </View>
        </Card>

        <PersonalSection profile={profile} userId={pid} />
        <InsuranceSection patientId={pid} />
        <AllergiesSection patientId={pid} />
        <ConditionsSection patientId={pid} />
        <SurgeriesSection patientId={pid} />
        <FamilySection patientId={pid} />

        <Button label="Sair da conta" variant="outline" icon={LogOut} onPress={signOut} />
        <Text style={{ fontFamily: fonts.regular }} className="px-2 text-center text-[11px] leading-4 text-faint">
          {DISCLAIMERS.notDiagnosis}
        </Text>
      </ScrollView>
    </View>
  );
}

/* ─────────────── Exportar PDF (resumo do prontuário) ─────────────── */
// Escape de HTML p/ não quebrar a marcação com dados livres do usuário.
function esc(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type ProntuarioData = {
  profile: ReturnType<typeof useProfile>['data'];
  age: number | null;
  insurance: NonNullable<ReturnType<typeof useInsurance>['data']> | null | undefined;
  allergies: NonNullable<ReturnType<typeof useAllergies>['data']>;
  conditions: NonNullable<ReturnType<typeof useConditions>['data']>;
  surgeries: NonNullable<ReturnType<typeof useSurgeries>['data']>;
  familyHistory: NonNullable<ReturnType<typeof useFamilyHistory>['data']>;
};

function buildProntuarioHtml(d: ProntuarioData): string {
  const { profile, age, insurance } = d;
  const addr = (profile?.address ?? {}) as Address;
  const addressLine = [
    [addr.street, addr.number].filter(Boolean).join(', '),
    addr.complement,
    [addr.city, addr.state].filter(Boolean).join(' - '),
    addr.zip ? `CEP ${addr.zip}` : '',
  ].filter(Boolean).join(' · ');

  const dash = '—';
  const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : dash);

  // Linhas de "Dados pessoais" (sem dados de terceiros).
  const personalRows: [string, string][] = [
    ['Nome', esc(profile?.full_name) || dash],
    ['Nascimento', profile?.date_of_birth ? `${fmtDate(profile.date_of_birth)}${age != null ? ` (${age} anos)` : ''}` : dash],
    ['Sexo biológico', profile?.biological_sex ? esc(BIOLOGICAL_SEX_LABELS[profile.biological_sex]) : dash],
    ['Tipo sanguíneo', profile && profile.blood_type !== 'unknown' ? esc(profile.blood_type) : dash],
    ['Altura', profile?.height_cm ? `${esc(profile.height_cm)} cm` : dash],
    ['CPF', profile?.cpf ? esc(profile.cpf) : dash],
    ['Telefone', profile?.phone ? esc(profile.phone) : dash],
    ['Endereço', addressLine ? esc(addressLine) : dash],
  ];
  const convenioRows: [string, string][] = [
    ['Operadora', insurance?.operator ? esc(insurance.operator) : dash],
    ['Carteirinha', insurance?.card_number ? esc(insurance.card_number) : dash],
    ['Validade', insurance?.valid_until ? esc(fmtDate(insurance.valid_until)) : dash],
  ];

  const rowsHtml = (rows: [string, string][]) =>
    rows.map((r) => `<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('');

  const allergiesHtml = d.allergies.length
    ? `<ul>${d.allergies
        .map((a) => `<li><strong>${esc(a.substance)}</strong> — ${esc(ALLERGY_SEVERITY[a.severity].label)}${a.reaction ? ` · ${esc(a.reaction)}` : ''}</li>`)
        .join('')}</ul>`
    : `<p class="empty">Nenhuma alergia registrada.</p>`;

  const conditionsHtml = d.conditions.length
    ? `<ul>${d.conditions
        .map((c) => `<li><strong>${esc(c.name)}</strong>${c.cid10_code ? ` (${esc(c.cid10_code)})` : ''} — ${esc(CONDITION_STATUS_LABELS[c.status])}</li>`)
        .join('')}</ul>`
    : `<p class="empty">Nenhuma condição registrada.</p>`;

  const surgeriesHtml = d.surgeries.length
    ? `<ul>${d.surgeries
        .map((s) => `<li><strong>${esc(s.procedure)}</strong> — ${fmtDate(s.performed_at)}${s.hospital ? ` · ${esc(s.hospital)}` : ''}</li>`)
        .join('')}</ul>`
    : `<p class="empty">Nenhuma cirurgia registrada.</p>`;

  const familyHtml = d.familyHistory.length
    ? `<ul>${d.familyHistory
        .map((f) => `<li><strong>${esc(f.condition)}</strong> — ${esc(FAMILY_RELATIONSHIP_LABELS[f.relationship])}</li>`)
        .join('')}</ul>`
    : `<p class="empty">Nenhum antecedente registrado.</p>`;

  const emergencyHtml = profile?.emergency_note
    ? `<p>${esc(profile.emergency_note)}</p>`
    : `<p class="empty">Nenhuma observação de emergência.</p>`;

  const generatedAt = new Date().toLocaleString('pt-BR');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1c1917; margin: 0; padding: 32px; font-size: 13px; line-height: 1.5; }
  header { border-bottom: 2px solid #0369a1; padding-bottom: 12px; margin-bottom: 20px; }
  header h1 { color: #0369a1; font-size: 20px; margin: 0; }
  header p { color: #57534e; font-size: 12px; margin: 4px 0 0; }
  section { margin-bottom: 18px; }
  h2 { font-size: 14px; color: #0369a1; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #57534e; font-weight: 600; width: 130px; vertical-align: top; padding: 3px 8px 3px 0; }
  td { vertical-align: top; padding: 3px 0; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 2px 0; }
  .empty { color: #a8a29e; font-style: italic; margin: 0; }
  footer { margin-top: 28px; border-top: 1px solid #e7e5e4; padding-top: 12px; color: #78716c; font-size: 11px; }
</style></head><body>
  <header>
    <h1>HubPatients — Resumo do prontuário</h1>
    <p>${esc(profile?.full_name) || 'Titular'}${age != null ? ` · ${age} anos` : ''}</p>
  </header>

  <section><h2>Dados pessoais</h2><table>${rowsHtml(personalRows)}</table></section>
  <section><h2>Convênio</h2><table>${rowsHtml(convenioRows)}</table></section>
  <section><h2>Alergias</h2>${allergiesHtml}</section>
  <section><h2>Condições de saúde</h2>${conditionsHtml}</section>
  <section><h2>Cirurgias</h2>${surgeriesHtml}</section>
  <section><h2>Antecedentes familiares</h2>${familyHtml}</section>
  <section><h2>Observação de emergência</h2>${emergencyHtml}</section>

  <footer>
    <p>Documento gerado em ${esc(generatedAt)}.</p>
    <p>Documento gerado pelo titular; não substitui avaliação médica.</p>
  </footer>
</body></html>`;
}

/* ─────────────── Collapsible base ─────────────── */
function Section({ icon, title, subtitle, defaultOpen, children }: { icon: LucideIcon; title: string; subtitle?: string; defaultOpen?: boolean; children: ReactNode }) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <Card>
      <Pressable onPress={() => setOpen((o) => !o)} className="flex-row items-center gap-3">
        <IconCircle icon={icon} tone="primary" size={42} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">{title}</Text>
          {subtitle ? <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">{subtitle}</Text> : null}
        </View>
        {open ? <ChevronUp size={20} color={colors.faint} /> : <ChevronDown size={20} color={colors.faint} />}
      </Pressable>
      {open ? <View className="mt-3 gap-3">{children}</View> : null}
    </Card>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => (
        <Pressable
          key={o.v}
          onPress={() => onChange(o.v)}
          style={{ borderCurve: 'continuous' }}
          className={`rounded-full border px-3 py-1.5 ${value === o.v ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
        >
          <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${value === o.v ? 'text-accent' : 'text-muted'}`}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ─────────────── Dados pessoais ─────────────── */
type Address = { zip?: string; street?: string; number?: string; complement?: string; city?: string; state?: string };

function PersonalSection({ profile, userId }: { profile: ReturnType<typeof useProfile>['data']; userId: string }) {
  const update = useUpdateProfile(userId);
  const addr = (profile?.address ?? {}) as Address;
  const [name, setName] = useState(profile?.full_name ?? '');
  const [dob, setDob] = useState(profile?.date_of_birth ?? '');
  const [sex, setSex] = useState(profile?.biological_sex ?? 'unspecified');
  const [blood, setBlood] = useState<BloodType>(profile?.blood_type ?? 'unknown');
  const [height, setHeight] = useState(profile?.height_cm ? String(profile.height_cm) : '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [cpf, setCpf] = useState(profile?.cpf ?? '');
  const [zip, setZip] = useState(addr.zip ?? '');
  const [street, setStreet] = useState(addr.street ?? '');
  const [number, setNumber] = useState(addr.number ?? '');
  const [complement, setComplement] = useState(addr.complement ?? '');
  const [city, setCity] = useState(addr.city ?? '');
  const [state, setState] = useState(addr.state ?? '');
  const [emergencyNote, setEmergencyNote] = useState(profile?.emergency_note ?? '');
  const [cpfError, setCpfError] = useState<string | undefined>(undefined);

  function save() {
    // Validação espelhando o profileSchema da web (sobretudo o CPF com dígitos verificadores).
    const parsed = profileSchema.safeParse({
      fullName: name,
      dateOfBirth: dob || undefined,
      biologicalSex: sex,
      bloodType: blood,
      phone: phone || '',
      cpf: cpf || '',
      address: { zip, street, number, city, state },
      heightCm: height || undefined,
      emergencyNote: emergencyNote || '',
    });
    if (!parsed.success) {
      const cpfIssue = parsed.error.issues.find((i) => i.path[0] === 'cpf');
      setCpfError(cpfIssue?.message);
      toast.error(parsed.error.issues[0]?.message ?? 'Confira os dados informados.');
      return;
    }
    setCpfError(undefined);

    const address: Address = { zip, street, number, complement, city, state };
    update.mutate({
      full_name: name.trim() || undefined,
      date_of_birth: dob || null,
      biological_sex: sex,
      blood_type: blood,
      height_cm: height ? Number(height.replace(',', '.').trim()) : null,
      phone: phone || null,
      cpf: cpf ? formatCPF(cpf) : null,
      address,
      emergency_note: emergencyNote.trim() || null,
    });
    toast.success('Dados pessoais atualizados.');
  }

  return (
    <Section icon={User} title="Dados pessoais" subtitle="Nome, nascimento, CPF, contato e endereço" defaultOpen>
      <Input label="Nome completo" value={name} onChangeText={setName} />
      <Input label="Nascimento (AAAA-MM-DD)" value={dob} onChangeText={setDob} placeholder="1990-05-14" />
      <Input
        label="CPF"
        value={cpf}
        onChangeText={(t) => { setCpf(formatCPF(t)); if (cpfError) setCpfError(undefined); }}
        keyboardType="number-pad"
        placeholder="000.000.000-00"
        maxLength={14}
        error={cpfError}
      />
      <View>
        <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Sexo biológico</Text>
        <Chips value={sex} onChange={setSex} options={(['female', 'male', 'intersex', 'unspecified'] as const).map((v) => ({ v, label: BIOLOGICAL_SEX_LABELS[v] }))} />
      </View>
      <View>
        <Text style={{ fontFamily: fonts.medium }} className="mb-1.5 text-[13px] text-fg-soft">Tipo sanguíneo</Text>
        <Chips value={blood} onChange={setBlood} options={BLOOD.map((v) => ({ v, label: v === 'unknown' ? 'Não sei' : v }))} />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="Altura (cm)" value={height} onChangeText={setHeight} keyboardType="number-pad" /></View>
        <View className="flex-1"><Input label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
      </View>

      <Text style={{ fontFamily: fonts.semibold }} className="mt-1 text-[11px] uppercase tracking-wider text-muted">Endereço</Text>
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="CEP" value={zip} onChangeText={setZip} keyboardType="number-pad" placeholder="00000-000" /></View>
        <View className="flex-1"><Input label="Número" value={number} onChangeText={setNumber} /></View>
      </View>
      <Input label="Rua" value={street} onChangeText={setStreet} />
      <Input label="Complemento" value={complement} onChangeText={setComplement} placeholder="Apto, bloco (opcional)" />
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="Cidade" value={city} onChangeText={setCity} /></View>
        <View className="flex-1"><Input label="UF" value={state} onChangeText={setState} autoCapitalize="characters" maxLength={2} /></View>
      </View>

      <Input
        label="Observação de emergência"
        value={emergencyNote}
        onChangeText={setEmergencyNote}
        placeholder="Ex.: marca-passo, anticoagulante…"
        multiline
      />
      <Button label="Salvar" loading={update.isPending} onPress={save} />
    </Section>
  );
}

/* ─────────────── Convênio ─────────────── */
function InsuranceSection({ patientId }: { patientId: string }) {
  const { data } = useInsurance(patientId || undefined);
  const ins = Array.isArray(data) ? data[0] : data;
  const upsert = useUpsertInsurance(patientId);
  const [operator, setOperator] = useState('');
  const [card, setCard] = useState('');
  const [valid, setValid] = useState('');

  function save() {
    const op = operator.trim() || ins?.operator;
    if (!op) {
      toast.info('Informe a operadora.');
      return;
    }
    upsert.mutate({ operator: op, card_number: card || ins?.card_number || null, valid_until: valid || ins?.valid_until || null, is_primary: true });
    toast.success('Convênio atualizado.');
  }
  return (
    <Section icon={CreditCard} title="Convênio" subtitle={ins?.operator ?? 'Plano de saúde'}>
      <Input label="Operadora" value={operator} onChangeText={setOperator} placeholder={ins?.operator ?? 'Ex.: Unimed'} />
      <Input label="Número da carteirinha" value={card} onChangeText={setCard} placeholder={ins?.card_number ?? '—'} />
      <Input label="Validade (AAAA-MM-DD)" value={valid} onChangeText={setValid} placeholder={ins?.valid_until ?? 'opcional'} />
      <Button label="Salvar convênio" loading={upsert.isPending} onPress={save} />
    </Section>
  );
}

/* ─────────────── Alergias ─────────────── */
function AllergiesSection({ patientId }: { patientId: string }) {
  const colors = useColors();
  const { data } = useAllergies(patientId || undefined);
  const m = useAllergyMutations(patientId);
  const [substance, setSubstance] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('moderate');
  const [reaction, setReaction] = useState('');
  const list = data ?? [];

  function add() {
    if (!substance.trim()) return;
    m.create.mutate({ patient_id: patientId, substance: substance.trim(), severity, reaction: reaction || null });
    setSubstance(''); setReaction('');
  }

  return (
    <Section icon={ShieldAlert} title="Alergias" subtitle={`${list.length} registrada(s)`}>
      {list.map((a) => {
        const sev = ALLERGY_SEVERITY[a.severity];
        return (
          <View key={a.id} className="flex-row items-center gap-2">
            <AlertTriangle size={15} color={sev.tone === 'alert' ? colors.alert : colors.attention} />
            <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">{a.substance}</Text>
            <Badge tone={sev.tone === 'alert' ? 'alert' : 'attention'}>{sev.label}</Badge>
            <Pressable onPress={() => m.remove.mutate(a.id)} className="p-1"><Trash2 size={15} color={colors.faint} /></Pressable>
          </View>
        );
      })}
      <Divider />
      <Input label="Substância" value={substance} onChangeText={setSubstance} placeholder="Ex.: Penicilina" />
      <Chips value={severity} onChange={setSeverity} options={(['mild', 'moderate', 'severe'] as const).map((v) => ({ v, label: ALLERGY_SEVERITY[v].label }))} />
      <Input label="Reação (opcional)" value={reaction} onChangeText={setReaction} />
      <Button label="Adicionar alergia" size="sm" icon={Plus} onPress={add} />
    </Section>
  );
}

/* ─────────────── Condições ─────────────── */
function ConditionsSection({ patientId }: { patientId: string }) {
  const colors = useColors();
  const { data } = useConditions(patientId || undefined);
  const m = useConditionMutations(patientId);
  const [name, setName] = useState('');
  const [cid, setCid] = useState('');
  const [status, setStatus] = useState<ConditionStatus>('active');
  const list = data ?? [];

  function add() {
    if (!name.trim()) return;
    m.create.mutate({ patient_id: patientId, name: name.trim(), cid10_code: cid || null, status });
    setName(''); setCid('');
  }
  return (
    <Section icon={Stethoscope} title="Condições de saúde" subtitle={`${list.length} registrada(s)`}>
      {list.map((c) => (
        <View key={c.id} className="flex-row items-center gap-2">
          <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">
            {c.name}{c.cid10_code ? ` (${c.cid10_code})` : ''}
          </Text>
          <Badge tone={c.status === 'active' ? 'attention' : c.status === 'resolved' ? 'ok' : 'info'}>{CONDITION_STATUS_LABELS[c.status]}</Badge>
          <Pressable onPress={() => m.remove.mutate(c.id)} className="p-1"><Trash2 size={15} color={colors.faint} /></Pressable>
        </View>
      ))}
      <Divider />
      <Input label="Condição" value={name} onChangeText={setName} placeholder="Ex.: Hipertensão" />
      <Input label="CID-10 (opcional)" value={cid} onChangeText={setCid} placeholder="I10" autoCapitalize="characters" />
      <Chips value={status} onChange={setStatus} options={(['active', 'controlled', 'resolved', 'suspected'] as const).map((v) => ({ v, label: CONDITION_STATUS_LABELS[v] }))} />
      <Button label="Adicionar condição" size="sm" icon={Plus} onPress={add} />
    </Section>
  );
}

/* ─────────────── Cirurgias ─────────────── */
function SurgeriesSection({ patientId }: { patientId: string }) {
  const colors = useColors();
  const { data } = useSurgeries(patientId || undefined);
  const m = useSurgeryMutations(patientId);
  const [procedure, setProcedure] = useState('');
  const [date, setDate] = useState('');
  const [hospital, setHospital] = useState('');
  const list = data ?? [];

  function add() {
    if (!procedure.trim()) return;
    m.create.mutate({ patient_id: patientId, procedure: procedure.trim(), performed_at: date || null, hospital: hospital || null });
    setProcedure(''); setDate(''); setHospital('');
  }
  return (
    <Section icon={Scissors} title="Cirurgias" subtitle={`${list.length} registrada(s)`}>
      {list.map((s) => (
        <View key={s.id} className="flex-row items-center gap-2">
          <View className="flex-1">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">{s.procedure}</Text>
            {s.performed_at ? <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">{new Date(s.performed_at).toLocaleDateString('pt-BR')}{s.hospital ? ` · ${s.hospital}` : ''}</Text> : null}
          </View>
          <Pressable onPress={() => m.remove.mutate(s.id)} className="p-1"><Trash2 size={15} color={colors.faint} /></Pressable>
        </View>
      ))}
      <Divider />
      <Input label="Procedimento" value={procedure} onChangeText={setProcedure} placeholder="Ex.: Apendicectomia" />
      <View className="flex-row gap-3">
        <View className="flex-1"><Input label="Data" value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" /></View>
        <View className="flex-1"><Input label="Hospital" value={hospital} onChangeText={setHospital} /></View>
      </View>
      <Button label="Adicionar cirurgia" size="sm" icon={Plus} onPress={add} />
    </Section>
  );
}

/* ─────────────── Antecedentes familiares ─────────────── */
function FamilySection({ patientId }: { patientId: string }) {
  const colors = useColors();
  const { data } = useFamilyHistory(patientId || undefined);
  const m = useFamilyHistoryMutations(patientId);
  const [condition, setCondition] = useState('');
  const [rel, setRel] = useState<FamilyRelationship>('mother');
  const list = data ?? [];

  function add() {
    if (!condition.trim()) return;
    m.create.mutate({ patient_id: patientId, condition: condition.trim(), relationship: rel });
    setCondition('');
  }
  return (
    <Section icon={Users} title="Antecedentes familiares" subtitle={`${list.length} registrado(s)`}>
      {list.map((f) => (
        <View key={f.id} className="flex-row items-center gap-2">
          <Text style={{ fontFamily: fonts.semibold }} className="flex-1 text-[14px] text-fg">{f.condition}</Text>
          <Badge tone="info">{FAMILY_RELATIONSHIP_LABELS[f.relationship]}</Badge>
          <Pressable onPress={() => m.remove.mutate(f.id)} className="p-1"><Trash2 size={15} color={colors.faint} /></Pressable>
        </View>
      ))}
      <Divider />
      <Input label="Condição" value={condition} onChangeText={setCondition} placeholder="Ex.: Diabetes" />
      <Chips value={rel} onChange={setRel} options={(['mother', 'father', 'sibling', 'grandparent', 'child', 'other'] as const).map((v) => ({ v, label: FAMILY_RELATIONSHIP_LABELS[v] }))} />
      <Button label="Adicionar antecedente" size="sm" icon={Plus} onPress={add} />
    </Section>
  );
}
