import { useRef, useState } from 'react';
import { View, Text, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Pencil, Trash2, Crosshair, ShieldX, Building2 } from 'lucide-react-native';
import { useCommunityMember, useHubPatientsClient } from '@hubpatients/supabase';
import { useAuth } from '@/lib/auth';
import {
  Screen,
  AppHeader,
  Card,
  Input,
  Button,
  Badge,
  EmptyState,
  SectionTitle,
  Divider,
  ErrorState,
} from '@/components/ui';
import { AppSheet, type AppSheetHandle } from '@/components/sheet';
import { toast } from '@/components/toast';
import { FadeInItem } from '@/components/motion';
import { useColors, fonts } from '@/theme';
import {
  type PlaceType,
  type HealthPlace,
  type HealthPlaceInput,
  PLACE_TYPE_LABEL,
  listHealthPlaces,
  createHealthPlace,
  updateHealthPlace,
  deleteHealthPlace,
  geocodeAddress,
} from '@/lib/health-places';

const TYPES: PlaceType[] = ['pharmacy', 'hospital', 'lab', 'clinic'];

/** Estado editável do formulário (strings p/ inputs; coords como número|null). */
type FormState = {
  type: PlaceType;
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  whatsapp: string;
  hoursText: string;
  is24h: boolean;
  link: string;
  active: boolean;
  lat: number | null;
  lng: number | null;
};

function emptyForm(type: PlaceType): FormState {
  return {
    type,
    name: '',
    address: '',
    city: '',
    state: '',
    phone: '',
    whatsapp: '',
    hoursText: '',
    is24h: false,
    link: '',
    active: true,
    lat: null,
    lng: null,
  };
}

function formFromPlace(p: HealthPlace): FormState {
  return {
    type: p.type,
    name: p.name,
    address: p.address ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    phone: p.phone ?? '',
    whatsapp: p.whatsapp ?? '',
    hoursText: p.hours_text ?? '',
    is24h: p.is_24h,
    link: p.link ?? '',
    active: p.active,
    lat: p.lat,
    lng: p.lng,
  };
}

/** Normaliza string vazia → null (a tabela aceita null nos campos opcionais). */
function orNull(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function toInput(f: FormState): HealthPlaceInput {
  return {
    type: f.type,
    name: f.name.trim(),
    address: orNull(f.address),
    city: orNull(f.city),
    state: orNull(f.state),
    phone: orNull(f.phone),
    whatsapp: orNull(f.whatsapp),
    hours_text: orNull(f.hoursText),
    is_24h: f.is24h,
    link: orNull(f.link),
    active: f.active,
    lat: f.lat,
    lng: f.lng,
  };
}

export default function AdminLocaisScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const client = useHubPatientsClient();
  const queryClient = useQueryClient();

  const { data: me, isLoading: loadingMe } = useCommunityMember(user?.id);
  const isAdmin = me?.staff_role === 'admin';

  const [type, setType] = useState<PlaceType>('pharmacy');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm('pharmacy'));
  const [geocoded, setGeocoded] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef<AppSheetHandle>(null);

  const query = useQuery({
    queryKey: ['health-places-admin', type],
    queryFn: () => listHealthPlaces(client, type, { includeInactive: true }),
    enabled: isAdmin,
  });

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['health-places-admin'] });
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm(type));
    setGeocoded(null);
    setSheetOpen(true);
  }

  function openEdit(p: HealthPlace) {
    setEditingId(p.id);
    setForm(formFromPlace(p));
    setGeocoded(null);
    setSheetOpen(true);
  }

  async function onGeocode() {
    const address = form.address.trim();
    if (address.length < 3) {
      toast.info('Informe o endereço antes de buscar as coordenadas.');
      return;
    }
    setGeocoding(true);
    try {
      const res = await geocodeAddress(client, address);
      if (res.ok) {
        patch('lat', res.lat);
        patch('lng', res.lng);
        setGeocoded(res.formattedAddress);
      } else {
        setGeocoded(null);
        toast.error(res.reason);
      }
    } catch {
      toast.error('Falha ao buscar coordenadas. Tente novamente.');
    } finally {
      setGeocoding(false);
    }
  }

  async function onSave() {
    const name = form.name.trim();
    if (name.length < 2) {
      toast.info('Informe um nome com pelo menos 2 letras.');
      return;
    }
    if (form.lat == null || form.lng == null) {
      toast.info('Sem coordenadas: o local não mostrará a distância para os usuários.');
    }
    setSaving(true);
    try {
      const input = toInput(form);
      if (editingId) {
        await updateHealthPlace(client, editingId, input);
        toast.success('Local atualizado.');
      } else {
        await createHealthPlace(client, input);
        toast.success('Local cadastrado.');
      }
      invalidate();
      sheetRef.current?.close();
    } catch (err) {
      const msg = err instanceof Error ? err.message.replace(/^.*:\s*/, '') : 'Falha ao salvar o local.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function onDelete(p: HealthPlace) {
    Alert.alert(
      'Excluir local',
      `Tem certeza que deseja excluir "${p.name}"? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteHealthPlace(client, p.id);
              invalidate();
              toast.success('Local excluído.');
            } catch (err) {
              const msg = err instanceof Error ? err.message.replace(/^.*:\s*/, '') : 'Falha ao excluir o local.';
              toast.error(msg);
            }
          },
        },
      ],
    );
  }

  // Guard de acesso: enquanto carrega o membro, não revela a tela; depois exige admin.
  if (!loadingMe && !isAdmin) {
    return (
      <View className="flex-1 bg-bg">
        <AppHeader title="Locais de saúde" subtitle="Área administrativa" back />
        <Screen>
          <EmptyState
            icon={ShieldX}
            title="Acesso restrito"
            subtitle="Esta área é exclusiva de administradores."
          />
        </Screen>
      </View>
    );
  }

  const list = query.data ?? [];

  return (
    <View className="flex-1 bg-bg">
      <AppHeader title="Locais de saúde" subtitle="Farmácias, hospitais, laboratórios e clínicas" back />
      <Screen>
        {loadingMe ? null : (
          <>
            {/* Seletor de tipo */}
            <View className="flex-row flex-wrap gap-2">
              {TYPES.map((t) => {
                const active = type === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={PLACE_TYPE_LABEL[t]}
                    style={{ borderCurve: 'continuous' }}
                    className={`rounded-full border px-3.5 py-2 ${
                      active ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'
                    }`}
                  >
                    <Text
                      style={{ fontFamily: fonts.semibold }}
                      className={`text-[13px] ${active ? 'text-accent' : 'text-muted'}`}
                    >
                      {PLACE_TYPE_LABEL[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Button label="Novo local" icon={Plus} onPress={openNew} />

            <SectionTitle
              action={list.length > 0 ? <Text className="text-[12px] text-muted">{list.length}</Text> : undefined}
            >
              {PLACE_TYPE_LABEL[type]}
            </SectionTitle>

            {query.isError ? (
              <ErrorState onRetry={() => void query.refetch()} />
            ) : query.isLoading ? null : list.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Nenhum local cadastrado"
                subtitle="Toque em “Novo local” para adicionar o primeiro."
              />
            ) : (
              list.map((p, i) => (
                <FadeInItem key={p.id} index={i}>
                  <Card className="gap-2.5" onPress={() => openEdit(p)}>
                    <View className="flex-row items-start gap-3">
                      <View className="flex-1">
                        <Text style={{ fontFamily: fonts.semibold }} className="text-[15px] text-fg">
                          {p.name}
                        </Text>
                        {p.address ? (
                          <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                            {p.address}
                            {p.city ? ` · ${p.city}` : ''}
                            {p.state ? `/${p.state}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      <Pressable
                        onPress={() => onDelete(p)}
                        accessibilityRole="button"
                        accessibilityLabel={`Excluir ${p.name}`}
                        hitSlop={8}
                        style={{ borderCurve: 'continuous' }}
                        className="h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 active:opacity-70"
                      >
                        <Trash2 size={17} color={colors.alert} />
                      </Pressable>
                    </View>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Badge tone="info">{PLACE_TYPE_LABEL[p.type]}</Badge>
                      {p.is_24h ? <Badge tone="ok">24h</Badge> : null}
                      {p.lat == null || p.lng == null ? <Badge tone="attention">sem coords</Badge> : null}
                      {!p.active ? <Badge tone="alert">inativo</Badge> : null}
                    </View>
                  </Card>
                </FadeInItem>
              ))
            )}
          </>
        )}
      </Screen>

      {sheetOpen ? (
        <AppSheet
          ref={sheetRef}
          onClose={() => setSheetOpen(false)}
          title={editingId ? 'Editar local' : 'Novo local'}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
            <View className="gap-3">
            {/* Tipo */}
            <View className="gap-1.5">
              <Text style={{ fontFamily: fonts.medium }} className="text-[13px] text-fg-soft">
                Tipo
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {TYPES.map((t) => {
                  const active = form.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => patch('type', t)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={PLACE_TYPE_LABEL[t]}
                      style={{ borderCurve: 'continuous' }}
                      className={`rounded-xl border px-3 py-2 ${
                        active ? 'border-accent bg-health-300/15' : 'border-line bg-surface-2'
                      }`}
                    >
                      <Text
                        style={{ fontFamily: fonts.semibold }}
                        className={`text-[12px] ${active ? 'text-accent' : 'text-muted'}`}
                      >
                        {PLACE_TYPE_LABEL[t]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Input
              label="Nome *"
              value={form.name}
              onChangeText={(t) => patch('name', t)}
              placeholder="Ex.: Drogaria São Paulo — Centro"
            />

            <Input
              label="Endereço"
              value={form.address}
              onChangeText={(t) => {
                patch('address', t);
                setGeocoded(null);
              }}
              placeholder="Rua, número, bairro"
            />

            <Button
              label="Buscar coordenadas"
              icon={Crosshair}
              variant="outline"
              size="sm"
              loading={geocoding}
              onPress={onGeocode}
            />
            {geocoded ? (
              <Text style={{ fontFamily: fonts.medium }} className="text-[12px] text-health-600">
                ✓ localizado em {geocoded}
              </Text>
            ) : form.lat != null && form.lng != null ? (
              <Text style={{ fontFamily: fonts.regular }} className="text-[12px] text-muted">
                Coordenadas: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}
              </Text>
            ) : null}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Cidade"
                  value={form.city}
                  onChangeText={(t) => patch('city', t)}
                  placeholder="São Paulo"
                />
              </View>
              <View style={{ width: 96 }}>
                <Input
                  label="UF"
                  value={form.state}
                  onChangeText={(t) => patch('state', t.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Input
                  label="Telefone"
                  value={form.phone}
                  onChangeText={(t) => patch('phone', t)}
                  placeholder="(11) 0000-0000"
                  keyboardType="phone-pad"
                />
              </View>
              <View className="flex-1">
                <Input
                  label="WhatsApp"
                  value={form.whatsapp}
                  onChangeText={(t) => patch('whatsapp', t)}
                  placeholder="(11) 90000-0000"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <Input
              label="Horário"
              value={form.hoursText}
              onChangeText={(t) => patch('hoursText', t)}
              placeholder="Seg–Sáb 8h–22h"
            />

            <Input
              label="Link"
              value={form.link}
              onChangeText={(t) => patch('link', t)}
              placeholder="https://…"
              autoCapitalize="none"
              keyboardType="url"
            />

            <View className="flex-row items-center justify-between py-1">
              <Text style={{ fontFamily: fonts.medium }} className="text-[14px] text-fg">
                Funciona 24 horas
              </Text>
              <Switch
                value={form.is24h}
                onValueChange={(v) => patch('is24h', v)}
                accessibilityLabel="Funciona 24 horas"
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>

            <View className="flex-row items-center justify-between py-1">
              <Text style={{ fontFamily: fonts.medium }} className="text-[14px] text-fg">
                Ativo
              </Text>
              <Switch
                value={form.active}
                onValueChange={(v) => patch('active', v)}
                accessibilityLabel="Local ativo"
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor="#ffffff"
              />
            </View>

            <Divider />

            <Button
              label={editingId ? 'Salvar alterações' : 'Cadastrar local'}
              icon={editingId ? Pencil : Building2}
              loading={saving}
              onPress={onSave}
            />
            </View>
          </ScrollView>
        </AppSheet>
      ) : null}
    </View>
  );
}
