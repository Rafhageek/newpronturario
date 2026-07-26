import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import {
  Users,
  UserPlus,
  Check,
  ShieldCheck,
  HeartHandshake,
  Trash2,
  ChevronDown,
  Mail,
  BellRing,
  Pill,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRelationships,
  useInvitesForMe,
  useSentInvites,
  useFamilyMutations,
  useProfile,
  queryKeys,
  useDoseGuardianSettings,
  useSaveDoseGuardianSettings,
  useDisableDoseGuardian,
  useMedicationsCriticality,
  useSetMedicationCritical,
  useDoseGuardianActivePatients,
  DOSE_GUARDIAN_DELAY_OPTIONS,
} from '@hubpatients/supabase';
import {
  CARE_KIND_LABELS,
  CAREGIVER_PERMISSIONS,
  DEFAULT_CAREGIVER_PERMISSIONS,
  type CaregiverInviteRole,
  type CaregiverPermissions,
  type CareRelationshipKind,
} from '@hubpatients/core';
import { useAuth } from '@/lib/auth';
import { Screen, AppHeader, Card, Input, Button, EmptyState, ErrorState, IconCircle, Badge, SectionTitle, Divider } from '@/components/ui';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';

const KIND_ORDER: CareRelationshipKind[] = ['family', 'caregiver', 'doctor', 'lab'];

export default function FamiliaScreen() {
  const { user } = useAuth();
  const uid = user?.id ?? '';
  const { data: profile } = useProfile(user?.id);
  const { data: relationships, isError, refetch } = useRelationships(user?.id);
  const { data: invites } = useInvitesForMe(true);
  const { data: sent } = useSentInvites(user?.id);
  const m = useFamilyMutations(uid);

  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Invalida só as chaves desta tela (vínculos, convites recebidos/enviados + perfil).
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.invitesForMe() }),
        ...(uid
          ? [
              qc.invalidateQueries({ queryKey: queryKeys.relationships(uid) }),
              qc.invalidateQueries({ queryKey: queryKeys.sentInvites(uid) }),
              qc.invalidateQueries({ queryKey: queryKeys.profile(uid) }),
            ]
          : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CaregiverInviteRole>('i_am_caregiver');
  const [kind, setKind] = useState<CareRelationshipKind>('family');
  const [permissions, setPermissions] = useState<CaregiverPermissions>(DEFAULT_CAREGIVER_PERMISSIONS);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const rels = relationships ?? [];
  const iCareFor = rels.filter((r) => r.direction === 'i_care_for');
  const caresForMe = rels.filter((r) => r.direction === 'cares_for_me');
  const pending = invites ?? [];
  const sentPending = sent ?? [];

  function resetForm() {
    setEmail('');
    setRole('i_am_caregiver');
    setKind('family');
    setPermissions(DEFAULT_CAREGIVER_PERMISSIONS);
  }

  function sendInvite() {
    if (!/.+@.+\..+/.test(email)) {
      toast.info('Informe o e-mail de quem você quer convidar.');
      return;
    }
    m.invite.mutate(
      { inviterName: profile?.full_name ?? 'Alguém', email: email.trim(), role, kind, permissions },
      {
        onSuccess: (created) => {
          resetForm();
          // Sem window.location no RN: montamos o caminho que a web resolve em /familia/aceitar.
          setInviteLink(`/familia/aceitar?token=${created.token}`);
          toast.success('Convite criado. Compartilhe o link com a pessoa.');
        },
        onError: () => toast.error('Não foi possível enviar o convite.'),
      },
    );
  }

  function confirmRevoke(id: string, name: string) {
    Alert.alert(
      'Remover vínculo?',
      `O acesso de ${name} aos seus dados (ou aos dados da pessoa) será encerrado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            m.revoke.mutate(id, {
              onSuccess: () => toast.success('Vínculo removido.'),
              onError: () => toast.error('Não foi possível remover.'),
            }),
        },
      ],
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Família" subtitle="Quem cuida de você, junto" icon={Users} back />
      <Screen onRefresh={onRefresh} refreshing={refreshing}>
        {/* Convites pendentes pra mim */}
        {pending.length > 0 ? (
          <View className="gap-2">
            <SectionTitle>Convites para você</SectionTitle>
            {pending.map((inv) => (
              <Card key={inv.id} className="gap-2">
                <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">
                  {inv.inviter_name ?? 'Alguém'} convidou você ({CARE_KIND_LABELS[inv.kind]})
                </Text>
                <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                  {inv.role === 'i_am_caregiver' ? 'Para cuidar de você' : 'Para você cuidar'}
                </Text>
                <Button
                  label="Aceitar"
                  size="sm"
                  icon={Check}
                  onPress={() =>
                    m.accept.mutate(inv.token, {
                      onSuccess: () => toast.success('Vínculo aceito.'),
                      onError: () => toast.error('Não foi possível aceitar.'),
                    })
                  }
                />
              </Card>
            ))}
          </View>
        ) : null}

        {/* Convidar */}
        <Card className="gap-3">
          <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">Convidar alguém</Text>
          <Input label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="pessoa@email.com" />

          <View className="gap-1.5">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">Qual o vínculo?</Text>
            <View className="flex-row gap-2">
              {([
                { v: 'i_am_caregiver', label: 'Vou cuidar dela' },
                { v: 'i_am_patient', label: 'Ela cuida de mim' },
              ] as const).map((o) => {
                const active = role === o.v;
                return (
                  <Pressable
                    key={o.v}
                    onPress={() => setRole(o.v)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={o.label}
                    style={{ borderCurve: 'continuous' }}
                    className={`flex-1 items-center rounded-2xl border py-2.5 ${active ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${active ? 'text-accent' : 'text-muted'}`}>
                      {o.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-1.5">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">Relação</Text>
            <View className="flex-row flex-wrap gap-2">
              {KIND_ORDER.map((k) => {
                const active = kind === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={CARE_KIND_LABELS[k]}
                    style={{ borderCurve: 'continuous' }}
                    className={`rounded-2xl border px-3.5 py-2 ${active ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
                  >
                    <Text style={{ fontFamily: fonts.semibold }} className={`text-[12px] ${active ? 'text-accent' : 'text-muted'}`}>
                      {CARE_KIND_LABELS[k]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-2">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
              {role === 'i_am_caregiver' ? 'Permissões que terei' : 'Permissões que concedo'}
            </Text>
            <PermissionToggles value={permissions} onChange={setPermissions} />
          </View>

          <Button label="Enviar convite" icon={UserPlus} loading={m.invite.isPending} onPress={sendInvite} />

          {inviteLink ? (
            <View style={{ borderCurve: 'continuous' }} className="gap-1.5 rounded-2xl border border-line bg-surface-2 p-3">
              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg">Link do convite (válido por 48h)</Text>
              <Text
                selectable
                style={{ fontFamily: fonts.regular }}
                className="text-[12px] text-primary"
              >
                {inviteLink}
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                Toque e segure para copiar e envie à pessoa abrir no site. Envio automático por e-mail entra na Fase 4.
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Eu cuido de */}
        {iCareFor.length > 0 ? (
          <View className="gap-2">
            <SectionTitle>Eu cuido de</SectionTitle>
            <Card className="gap-0.5">
              {iCareFor.map((r, i) => (
                <FadeInItem key={r.relationship.id} index={i}>
                  <View>
                    {i > 0 ? <Divider /> : null}
                    <RelRow
                      r={r}
                      icon={HeartHandshake}
                      onRevoke={() => confirmRevoke(r.relationship.id, r.other.full_name)}
                      onUpdatePermissions={(p) => m.updatePermissions.mutate({ id: r.relationship.id, permissions: p })}
                      savingPermissions={m.updatePermissions.isPending}
                    />
                  </View>
                </FadeInItem>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Cuidam de mim */}
        {caresForMe.length > 0 ? (
          <View className="gap-2">
            <SectionTitle>Cuidam de mim</SectionTitle>
            <Card className="gap-0.5">
              {caresForMe.map((r, i) => (
                <FadeInItem key={r.relationship.id} index={i}>
                  <View>
                    {i > 0 ? <Divider /> : null}
                    <RelRow
                      r={r}
                      icon={ShieldCheck}
                      onRevoke={() => confirmRevoke(r.relationship.id, r.other.full_name)}
                      onUpdatePermissions={(p) => m.updatePermissions.mutate({ id: r.relationship.id, permissions: p })}
                      savingPermissions={m.updatePermissions.isPending}
                    />
                  </View>
                </FadeInItem>
              ))}
            </Card>
          </View>
        ) : null}

        {/* Guardião de Dose — consentimento do PACIENTE para avisar seus cuidadores */}
        <DoseGuardianCard uid={uid} caresForMe={caresForMe} iCareFor={iCareFor} />

        {/* Convites enviados */}
        {sentPending.length > 0 ? (
          <View className="gap-2">
            <SectionTitle>Convites enviados</SectionTitle>
            <Card className="gap-0.5">
              {sentPending.map((inv, i) => (
                <View key={inv.id}>
                  {i > 0 ? <Divider /> : null}
                  <View className="flex-row items-center gap-3 py-2.5">
                    <IconCircle icon={Mail} tone="neutral" size={40} />
                    <View className="flex-1">
                      <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg" numberOfLines={1}>
                        {inv.invitee_email}
                      </Text>
                      <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                        {CARE_KIND_LABELS[inv.kind]}
                      </Text>
                    </View>
                    <Badge tone="attention">Pendente</Badge>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {isError && !relationships ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : rels.length === 0 && pending.length === 0 && sentPending.length === 0 ? (
          <EmptyState icon={Users} title="Ninguém conectado ainda" subtitle="Convide um familiar ou cuidador para acompanhar você." />
        ) : null}
      </Screen>
    </View>
  );
}

/* ==========================================================================
   Guardião de Dose
   --------------------------------------------------------------------------
   LGPD: avisar um cuidador de que faltou a confirmação de uma dose é
   compartilhar dado de saúde sensível (art. 11). O consentimento é do TITULAR
   — o paciente liga, escolhe o prazo, escolhe QUAIS remédios entram e desliga
   sozinho. O cuidador não altera nada (a policy do banco é owner-only).
   Ética: mensagem neutra ("não houve confirmação"), nunca "fulano não tomou";
   sem histórico de adesão para terceiros; sem vigilância oculta — quem cuida
   também enxerga que o recurso está ativo.
   ========================================================================== */

type RelLite = {
  relationship: { id: string; status: string; permissions: unknown };
  other: { id: string; full_name: string };
};

/** Mesmas chaves que dose_guardian_permission_granted() confere no banco. */
function recebeAvisoDeDose(permissions: unknown): boolean {
  const p = (permissions ?? {}) as Partial<Record<string, boolean>>;
  return Boolean(p.registrar_tomada || p.receber_alertas || p.medications);
}

/** Sem Intl no Hermes — formatação manual. */
function formatarAtraso(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h} h` : `${h} h ${resto} min`;
}

function GuardianSwitch({
  value,
  onChange,
  label,
  disabled,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={8}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        justifyContent: 'center',
        paddingHorizontal: 3,
        backgroundColor: value ? colors.accent : colors.line,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          backgroundColor: colors.white,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}

function DoseGuardianCard({
  uid,
  caresForMe,
  iCareFor,
}: {
  uid: string;
  caresForMe: RelLite[];
  iCareFor: RelLite[];
}) {
  const colors = useColors();
  const { data: settings } = useDoseGuardianSettings(uid || undefined);
  const { data: meds } = useMedicationsCriticality(uid || undefined);
  const { data: ativos } = useDoseGuardianActivePatients(iCareFor.length > 0);
  const save = useSaveDoseGuardianSettings(uid || undefined);
  const disable = useDisableDoseGuardian(uid || undefined);
  const marcar = useSetMedicationCritical(uid || undefined);

  const enabled = settings?.enabled ?? false;
  const delay = settings?.delay_minutes ?? 90;
  const salvando = save.isPending || disable.isPending;

  // Só cuidador com vínculo aceito E permissão de medicamentos recebe o aviso.
  const avisados = caresForMe.filter(
    (c) => c.relationship.status === 'accepted' && recebeAvisoDeDose(c.relationship.permissions),
  );
  const lista = meds ?? [];
  const criticos = lista.filter((m) => m.is_critical);
  const exemplo = criticos.length > 0 ? (criticos[0]?.name ?? 'Losartana') : 'Losartana';

  // Transparência do outro lado: quem eu cuido e mantém o recurso ligado.
  const dependentesComGuardiao = iCareFor.filter((d) =>
    (ativos ?? []).some((a) => a.patient_id === d.other.id),
  );

  function alternar(next: boolean) {
    if (next) {
      save.mutate(
        { enabled: true, delay_minutes: delay },
        {
          onSuccess: () => toast.success('Guardião ativado. Você pode desligar quando quiser.'),
          onError: () => toast.error('Não foi possível salvar.'),
        },
      );
    } else {
      disable.mutate(undefined, {
        onSuccess: () => toast.success('Guardião desligado. Ninguém mais será avisado.'),
        onError: () => toast.error('Não foi possível salvar.'),
      });
    }
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-start gap-3">
        <IconCircle icon={BellRing} tone="accent" size={40} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.display }} className="text-[15px] text-fg">
            Guardião de Dose
          </Text>
          <Text style={{ fontFamily: fonts.regular }} className="mt-0.5 text-[12px] leading-[17px] text-muted">
            Se você não confirmar uma dose que marcou como importante, avisamos quem cuida de você —
            para dar uma força, não para cobrar.
          </Text>
        </View>
        <GuardianSwitch
          value={enabled}
          onChange={alternar}
          label="Ativar Guardião de Dose"
          disabled={salvando}
        />
      </View>

      {enabled ? (
        <>
          <Divider />

          {/* Prazo de tolerância */}
          <View className="gap-2">
            <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
              Esperar quanto tempo antes de avisar?
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DOSE_GUARDIAN_DELAY_OPTIONS.map((min) => {
                const active = min === delay;
                return (
                  <Pressable
                    key={min}
                    onPress={() =>
                      save.mutate(
                        { delay_minutes: min },
                        { onError: () => toast.error('Não foi possível salvar o prazo.') },
                      )
                    }
                    disabled={salvando}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={formatarAtraso(min)}
                    style={{ borderCurve: 'continuous' }}
                    className={`rounded-2xl border px-3.5 py-2 ${active ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'}`}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className={`text-[12px] ${active ? 'text-accent' : 'text-muted'}`}
                    >
                      {formatarAtraso(min)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
              Prazo curto demais gera alarme falso. {formatarAtraso(delay)} costuma ser um bom começo.
            </Text>
          </View>

          <Divider />

          {/* Quais remédios entram (consentimento granular) */}
          <View className="gap-2">
            <View className="flex-row items-center gap-1.5">
              <Pill size={14} color={colors.accent} />
              <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
                Quais remédios são importantes o bastante
              </Text>
            </View>
            {lista.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                Você ainda não tem medicamentos ativos. Cadastre em Medicamentos para escolher aqui.
              </Text>
            ) : (
              lista.map((m) => (
                <View key={m.id} className="flex-row items-center gap-3">
                  <View className="flex-1">
                    <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg" numberOfLines={1}>
                      {m.name}
                    </Text>
                    {m.dosage ? (
                      <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">
                        {m.dosage}
                      </Text>
                    ) : null}
                  </View>
                  <GuardianSwitch
                    value={m.is_critical}
                    label={`Marcar ${m.name} como dose importante`}
                    disabled={marcar.isPending}
                    onChange={(next) =>
                      marcar.mutate(
                        { medicationId: m.id, isCritical: next },
                        { onError: () => toast.error('Não foi possível atualizar.') },
                      )
                    }
                  />
                </View>
              ))
            )}
            {criticos.length === 0 && lista.length > 0 ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-semaphore-attention">
                Nenhum remédio marcado ainda — enquanto isso, ninguém é avisado.
              </Text>
            ) : null}
          </View>

          <Divider />

          {/* Quem é avisado e o que a pessoa vê */}
          <View style={{ borderCurve: 'continuous' }} className="gap-2 rounded-2xl border border-line bg-surface-2 p-3">
            <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg">
              Quem vai receber o aviso
            </Text>
            {avisados.length === 0 ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                Ninguém, por enquanto. Só recebem cuidadores com vínculo aceito e com a permissão de
                medicamentos ligada.
              </Text>
            ) : (
              avisados.map((c) => (
                <Text
                  key={c.relationship.id}
                  style={{ fontFamily: fonts.regular }}
                  className="text-[12px] text-fg-soft"
                >
                  · {c.other.full_name}
                </Text>
              ))
            )}

            <Text style={{ fontFamily: fonts.semibold }} className="mt-1 text-[12px] text-fg">
              O que a pessoa vai ver
            </Text>
            <View style={{ borderCurve: 'continuous' }} className="gap-0.5 rounded-2xl border border-line bg-bg p-2.5">
              <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg">
                Sem confirmação de dose
              </Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] leading-[17px] text-muted">
                Não houve confirmação da dose de {exemplo} às 08:00. Pode ser só o registro que faltou —
                se puder, mande uma mensagem carinhosa.
              </Text>
            </View>
            <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-[16px] text-muted">
              Só isso. A pessoa nunca vê “você não tomou”, não recebe histórico de faltas e não vê nenhum
              outro dado seu além do que você já autorizou nas permissões.
            </Text>
          </View>

          {/* Revogação — tão fácil quanto ativar (LGPD art. 8º, §5º) */}
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-[16px] text-muted">
            Você pode desligar quando quiser, sem justificar. Ao desligar, os avisos param na hora.
          </Text>
          <Button
            label="Desligar agora"
            variant="ghost"
            size="sm"
            loading={disable.isPending}
            onPress={() => alternar(false)}
          />
        </>
      ) : (
        <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-[16px] text-muted">
          Está desligado. Nada é enviado a ninguém enquanto você não ativar.
        </Text>
      )}

      {/* Transparência do lado de quem cuida */}
      {dependentesComGuardiao.length > 0 ? (
        <View style={{ borderCurve: 'continuous' }} className="gap-1 rounded-2xl border border-line bg-surface-2 p-3">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[12px] text-fg">
            Você é guardião de:
          </Text>
          {dependentesComGuardiao.map((d) => (
            <Text
              key={d.relationship.id}
              style={{ fontFamily: fonts.regular }}
              className="text-[12px] text-fg-soft"
            >
              · {d.other.full_name}
            </Text>
          ))}
          <Text style={{ fontFamily: fonts.regular }} className="text-[11px] leading-[16px] text-muted">
            Essas pessoas ativaram o Guardião de Dose e escolheram avisar você. Elas podem desligar a
            qualquer momento — se isso acontecer, os avisos simplesmente param.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

/** Lista de toggles de permissão — espelha permissions-editor.tsx da web. */
function PermissionToggles({
  value,
  onChange,
  readOnly,
}: {
  value: CaregiverPermissions;
  onChange?: (v: CaregiverPermissions) => void;
  readOnly?: boolean;
}) {
  const colors = useColors();
  return (
    <View className="gap-2.5">
      {CAREGIVER_PERMISSIONS.map((perm) => {
        const on = value[perm.key];
        return (
          <View key={perm.key} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg">{perm.label}</Text>
              <Text style={{ fontFamily: fonts.regular }} className="text-[11px] text-muted">{perm.description}</Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={perm.label}
              accessibilityState={{ checked: on, disabled: !!readOnly }}
              disabled={readOnly}
              onPress={() => onChange?.({ ...value, [perm.key]: !on })}
              hitSlop={8}
              style={{
                width: 44,
                height: 26,
                borderRadius: 999,
                justifyContent: 'center',
                paddingHorizontal: 3,
                backgroundColor: on ? colors.accent : colors.line,
                opacity: readOnly ? 0.6 : 1,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  backgroundColor: colors.white,
                  alignSelf: on ? 'flex-end' : 'flex-start',
                }}
              />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

function RelRow({
  r,
  onRevoke,
  onUpdatePermissions,
  icon,
  savingPermissions,
}: {
  r: {
    relationship: { id: string; kind: keyof typeof CARE_KIND_LABELS; status: string; permissions: unknown };
    direction: 'i_care_for' | 'cares_for_me';
    other: { full_name: string };
  };
  onRevoke: () => void;
  onUpdatePermissions: (p: CaregiverPermissions) => void;
  icon: typeof Users;
  savingPermissions: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  // Só o paciente (quem é cuidado) controla as permissões dos seus cuidadores.
  const canEdit = r.direction === 'cares_for_me';
  const perms: CaregiverPermissions = {
    ...DEFAULT_CAREGIVER_PERMISSIONS,
    ...((r.relationship.permissions as Partial<CaregiverPermissions> | null) ?? {}),
  };

  return (
    <View className="py-2.5">
      <View className="flex-row items-center gap-3">
        <IconCircle icon={icon} tone="accent" size={40} />
        <View className="flex-1">
          <Text style={{ fontFamily: fonts.semibold }} className="text-[14px] text-fg">{r.other.full_name}</Text>
          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">{CARE_KIND_LABELS[r.relationship.kind]}</Text>
        </View>
        <Badge tone={r.relationship.status === 'accepted' ? 'ok' : 'attention'}>
          {r.relationship.status === 'accepted' ? 'Ativo' : 'Pendente'}
        </Badge>
        <Pressable onPress={onRevoke} accessibilityRole="button" accessibilityLabel="Remover vínculo" hitSlop={8} className="p-1.5">
          <Trash2 size={16} color={colors.faint} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel="Permissões"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        className="mt-1.5 flex-row items-center gap-1 self-start"
      >
        <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-muted">Permissões</Text>
        <ChevronDown size={14} color={colors.muted} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
      </Pressable>

      {open ? (
        <View className="mt-2.5 border-t border-line pt-2.5">
          <PermissionToggles
            value={perms}
            onChange={canEdit && !savingPermissions ? onUpdatePermissions : undefined}
            readOnly={!canEdit}
          />
          {!canEdit ? (
            <Text style={{ fontFamily: fonts.regular }} className="mt-2 text-[11px] text-muted">
              As permissões são definidas pela pessoa cuidada.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
