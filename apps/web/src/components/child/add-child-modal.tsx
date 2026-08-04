'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { addChildSchema, DELIVERY_TYPE_LABELS } from '@hubpatients/core';
import { useAddChild } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Button, Field, Input } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export function AddChildModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const add = useAddChild(user?.id ?? '');

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [birthWeightG, setBirthWeightG] = useState('');
  const [birthLengthCm, setBirthLengthCm] = useState('');
  const [birthHeadCircumferenceCm, setBirthHeadCircumferenceCm] = useState('');
  const [gestationalAgeWeeksAtBirth, setGestationalAge] = useState('');
  const [deliveryType, setDeliveryType] = useState<'vaginal' | 'cesarean' | ''>('');
  const [bloodType, setBloodType] = useState('');
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFullName('');
    setBirthDate('');
    setSex('');
    setBirthWeightG('');
    setBirthLengthCm('');
    setBirthHeadCircumferenceCm('');
    setGestationalAge('');
    setDeliveryType('');
    setBloodType('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit() {
    setError(null);
    const parsed = addChildSchema.safeParse({
      fullName,
      birthDate: birthDate || undefined,
      sex: sex || undefined,
      birthWeightG: birthWeightG || undefined,
      birthLengthCm: birthLengthCm || undefined,
      birthHeadCircumferenceCm: birthHeadCircumferenceCm || undefined,
      gestationalAgeWeeksAtBirth: gestationalAgeWeeksAtBirth || undefined,
      deliveryType: deliveryType || undefined,
      bloodType: bloodType || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Confira os dados.');
      return;
    }
    // Guarda contra o `?? ''`: sem usuário carregado, o app mandaria um
    // responsável vazio e o banco recusaria — com uma mensagem que não ajuda
    // ninguém. Melhor dizer a verdade e não gastar a tentativa.
    if (!user?.id) {
      setError('Sua sessão ainda está carregando. Aguarde um instante e tente de novo.');
      return;
    }
    try {
      await add.mutateAsync({
        fullName: parsed.data.fullName,
        birthDate: birthDate, // 'YYYY-MM-DD' do input date
        sex: parsed.data.sex,
        birthWeightG: parsed.data.birthWeightG,
        birthLengthCm: parsed.data.birthLengthCm,
        birthHeadCircumferenceCm: parsed.data.birthHeadCircumferenceCm,
        gestationalAgeWeeksAtBirth: parsed.data.gestationalAgeWeeksAtBirth,
        deliveryType: parsed.data.deliveryType,
        bloodType: parsed.data.bloodType,
      });
      toast.success('Criança adicionada. 👶');
      reset();
      onClose();
    } catch (err) {
      /*
       * Mostra o motivo REAL. A mensagem genérica escondia um 403 de política
       * de segurança do banco e custou horas de investigação às cegas — num
       * app de saúde, erro que não se explica é erro que não se corrige.
       * `code` e `message` vêm do PostgREST; 42501 é violação de RLS.
       */
      const e = err as { message?: string; code?: string; hint?: string } | null;
      const detalhe = [e?.code, e?.message].filter(Boolean).join(' · ');
      setError(
        detalhe
          ? `Não foi possível adicionar: ${detalhe}`
          : 'Não foi possível adicionar. Tente novamente.',
      );
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Adicionar criança" className="max-w-lg">
      <div className="space-y-4">
        <Field label="Nome completo" htmlFor="child-name">
          <Input id="child-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex.: Maria Silva" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de nascimento" htmlFor="child-birth">
            <Input id="child-birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>
          <Field label="Sexo" htmlFor="child-sex">
            <select
              id="child-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as 'male' | 'female' | '')}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            >
              <option value="">Selecione</option>
              <option value="female">Feminino</option>
              <option value="male">Masculino</option>
            </select>
          </Field>
        </div>

        <p className="text-xs font-medium text-fg-soft">Dados do nascimento (opcionais)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Peso ao nascer (g)" htmlFor="child-bw">
            <Input id="child-bw" type="number" inputMode="numeric" value={birthWeightG} onChange={(e) => setBirthWeightG(e.target.value)} placeholder="Ex.: 3200" />
          </Field>
          <Field label="Comprimento (cm)" htmlFor="child-bl">
            <Input id="child-bl" type="number" inputMode="decimal" value={birthLengthCm} onChange={(e) => setBirthLengthCm(e.target.value)} placeholder="Ex.: 49" />
          </Field>
          <Field label="Perímetro cefálico (cm)" htmlFor="child-bhc">
            <Input id="child-bhc" type="number" inputMode="decimal" value={birthHeadCircumferenceCm} onChange={(e) => setBirthHeadCircumferenceCm(e.target.value)} placeholder="Ex.: 34" />
          </Field>
          <Field label="Idade gestacional (semanas)" htmlFor="child-ga">
            <Input id="child-ga" type="number" inputMode="numeric" value={gestationalAgeWeeksAtBirth} onChange={(e) => setGestationalAge(e.target.value)} placeholder="Ex.: 39" />
          </Field>
          <Field label="Tipo de parto" htmlFor="child-delivery">
            <select
              id="child-delivery"
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as 'vaginal' | 'cesarean' | '')}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            >
              <option value="">Não informado</option>
              <option value="vaginal">{DELIVERY_TYPE_LABELS.vaginal}</option>
              <option value="cesarean">{DELIVERY_TYPE_LABELS.cesarean}</option>
            </select>
          </Field>
          <Field label="Tipo sanguíneo" htmlFor="child-blood">
            <select
              id="child-blood"
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg"
            >
              <option value="">Não informado</option>
              {BLOOD_TYPES.map((bt) => (
                <option key={bt} value={bt}>{bt}</option>
              ))}
            </select>
          </Field>
        </div>

        {error && (
          <p className="text-xs text-status-alert-ink" role="alert">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={handleClose} className="inline-flex h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-soft hover:bg-surface-2">
            Cancelar
          </button>
          <Button onClick={onSubmit} disabled={add.isPending}>
            {add.isPending ? 'Salvando…' : 'Adicionar criança'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
