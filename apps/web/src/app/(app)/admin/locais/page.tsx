'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Plus, Trash2, Crosshair, ShieldX, Pencil, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCommunityMember,
  useHealthPlaces,
  useCreateHealthPlace,
  useUpdateHealthPlace,
  useDeleteHealthPlace,
  useHubPatientsClient,
  geocodeAddress,
  PLACE_TYPES,
  PLACE_TYPE_LABEL,
  type PlaceType,
  type HealthPlace,
  type HealthPlaceInput,
} from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Button, Input, Field } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Modal } from '@/components/ui/modal';

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
  return { type, name: '', address: '', city: '', state: '', phone: '', whatsapp: '', hoursText: '', is24h: false, link: '', active: true, lat: null, lng: null };
}

function formFromPlace(p: HealthPlace): FormState {
  return {
    type: p.type, name: p.name, address: p.address ?? '', city: p.city ?? '', state: p.state ?? '',
    phone: p.phone ?? '', whatsapp: p.whatsapp ?? '', hoursText: p.hours_text ?? '', is24h: p.is_24h,
    link: p.link ?? '', active: p.active, lat: p.lat, lng: p.lng,
  };
}

const orNull = (v: string): string | null => (v.trim().length > 0 ? v.trim() : null);

function toInput(f: FormState): HealthPlaceInput {
  return {
    type: f.type, name: f.name.trim(), address: orNull(f.address), city: orNull(f.city), state: orNull(f.state),
    phone: orNull(f.phone), whatsapp: orNull(f.whatsapp), hours_text: orNull(f.hoursText), is_24h: f.is24h,
    link: orNull(f.link), active: f.active, lat: f.lat, lng: f.lng,
  };
}

export default function AdminLocaisPage() {
  const { user } = useAuth();
  const client = useHubPatientsClient();
  const { data: me, isLoading: loadingMe } = useCommunityMember(user?.id);
  const isAdmin = me?.staff_role === 'admin';

  const [type, setType] = useState<PlaceType>('pharmacy');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm('pharmacy'));
  const [geocoded, setGeocoded] = useState<string | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  const query = useHealthPlaces(type, { includeInactive: true });
  const createM = useCreateHealthPlace();
  const updateM = useUpdateHealthPlace();
  const deleteM = useDeleteHealthPlace();

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm(type));
    setGeocoded(null);
    setOpen(true);
  }
  function openEdit(p: HealthPlace) {
    setEditingId(p.id);
    setForm(formFromPlace(p));
    setGeocoded(null);
    setOpen(true);
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
    if (form.name.trim().length < 2) {
      toast.info('Informe um nome com pelo menos 2 letras.');
      return;
    }
    try {
      const input = toInput(form);
      if (editingId) {
        await updateM.mutateAsync({ id: editingId, input });
        toast.success('Local atualizado.');
      } else {
        await createM.mutateAsync(input);
        toast.success('Local cadastrado.');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*:\s*/, '') : 'Falha ao salvar o local.');
    }
  }

  async function onDelete(p: HealthPlace) {
    if (!window.confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteM.mutateAsync(p.id);
      toast.success('Local excluído.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message.replace(/^.*:\s*/, '') : 'Falha ao excluir o local.');
    }
  }

  if (loadingMe) {
    return <div className="mx-auto max-w-3xl"><div className="h-40 animate-pulse rounded-2xl bg-surface-2" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <ShieldX className="mx-auto h-10 w-10 text-status-alert-ink" />
        <h1 className="mt-3 text-lg font-bold text-fg">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted">Esta área é exclusiva de administradores.</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar</Link>
      </div>
    );
  }

  const list = query.data ?? [];
  const saving = createM.isPending || updateM.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 text-primary">
          <MapPin className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Locais de saúde</h1>
          <p className="text-sm text-muted">Cadastre farmácias, hospitais, laboratórios e clínicas.</p>
        </div>
      </header>

      {/* Seletor de tipo */}
      <div className="flex flex-wrap gap-2">
        {PLACE_TYPES.map((t) => {
          const active = type === t;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active ? 'border-sky-400/50 bg-sky-500/15 text-primary' : 'border-line bg-surface text-fg-soft hover:bg-surface-2'
              }`}
            >
              {PLACE_TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>

      <Button onClick={openNew} className="w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Novo local
      </Button>

      {query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <ListSkeleton rows={3} />
      ) : list.length === 0 ? (
        <EmptyState icon={MapPin} title="Nenhum local cadastrado" description="Clique em “Novo local” para adicionar o primeiro." />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <button onClick={() => openEdit(p)} className="min-w-0 flex-1 text-left">
                <p className="text-[15px] font-semibold text-fg">{p.name}</p>
                {p.address ? (
                  <p className="text-xs text-muted">{p.address}{p.city ? ` · ${p.city}` : ''}{p.state ? `/${p.state}` : ''}</p>
                ) : null}
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone="info">{PLACE_TYPE_LABEL[p.type]}</Badge>
                  {p.is_24h ? <Badge tone="success">24h</Badge> : null}
                  {p.lat == null || p.lng == null ? <Badge tone="warning">sem coords</Badge> : null}
                  {!p.active ? <Badge tone="danger">inativo</Badge> : null}
                </span>
              </button>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted hover:bg-surface-2">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(p)} aria-label={`Excluir ${p.name}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/15 text-status-alert-ink hover:bg-rose-500/25">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Editar local' : 'Novo local'} className="max-w-xl">
        <div className="space-y-3">
          {/* Tipo */}
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-fg-soft">Tipo</span>
            <div className="flex flex-wrap gap-2">
              {PLACE_TYPES.map((t) => {
                const active = form.type === t;
                return (
                  <button key={t} type="button" onClick={() => patch('type', t)} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-sky-400/50 bg-sky-500/15 text-primary' : 'border-line bg-surface-2 text-muted hover:bg-surface'}`}>
                    {PLACE_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="Nome *" htmlFor="np-name">
            <Input id="np-name" value={form.name} onChange={(e) => patch('name', e.target.value)} placeholder="Ex.: Drogaria São Paulo — Centro" />
          </Field>

          <Field label="Endereço" htmlFor="np-address">
            <Input id="np-address" value={form.address} onChange={(e) => { patch('address', e.target.value); setGeocoded(null); }} placeholder="Rua, número, bairro" />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onGeocode} disabled={geocoding} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-primary hover:bg-surface-2 disabled:opacity-60">
              <Crosshair className="h-4 w-4" /> {geocoding ? 'Buscando…' : 'Buscar coordenadas'}
            </button>
            {geocoded ? (
              <span className="text-xs font-medium text-status-ok-ink">✓ localizado em {geocoded}</span>
            ) : form.lat != null && form.lng != null ? (
              <span className="text-xs text-muted">Coordenadas: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
            <Field label="Cidade" htmlFor="np-city">
              <Input id="np-city" value={form.city} onChange={(e) => patch('city', e.target.value)} placeholder="São Paulo" />
            </Field>
            <Field label="UF" htmlFor="np-state">
              <Input id="np-state" value={form.state} onChange={(e) => patch('state', e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" maxLength={2} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone" htmlFor="np-phone">
              <Input id="np-phone" value={form.phone} onChange={(e) => patch('phone', e.target.value)} placeholder="(11) 0000-0000" inputMode="tel" />
            </Field>
            <Field label="WhatsApp" htmlFor="np-wa">
              <Input id="np-wa" value={form.whatsapp} onChange={(e) => patch('whatsapp', e.target.value)} placeholder="(11) 90000-0000" inputMode="tel" />
            </Field>
          </div>

          <Field label="Horário" htmlFor="np-hours">
            <Input id="np-hours" value={form.hoursText} onChange={(e) => patch('hoursText', e.target.value)} placeholder="Seg–Sáb 8h–22h" />
          </Field>

          <Field label="Link" htmlFor="np-link">
            <Input id="np-link" value={form.link} onChange={(e) => patch('link', e.target.value)} placeholder="https://…" inputMode="url" />
          </Field>

          <label className="flex items-center justify-between py-1 text-sm font-medium text-fg">
            Funciona 24 horas
            <input type="checkbox" checked={form.is24h} onChange={(e) => patch('is24h', e.target.checked)} className="h-5 w-5 accent-sky-500" />
          </label>
          <label className="flex items-center justify-between py-1 text-sm font-medium text-fg">
            Ativo
            <input type="checkbox" checked={form.active} onChange={(e) => patch('active', e.target.checked)} className="h-5 w-5 accent-sky-500" />
          </label>

          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-fg-soft hover:bg-surface-2">
              Cancelar
            </button>
            <Button onClick={onSave} loading={saving}>
              {editingId ? <Pencil className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              {editingId ? 'Salvar alterações' : 'Cadastrar local'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
