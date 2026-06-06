'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { BadgeCheck, Globe } from 'lucide-react';
import { socialProfileSchema, type SocialProfileInput, type SocialProfile } from '@vidalog/core';
import { useUpsertSocialProfile } from '@vidalog/supabase';
import { Button, Field, Input } from '@/components/ui';

export function ProfileEditor({ userId, profile }: { userId: string; profile: SocialProfile | null }) {
  const upsert = useUpsertSocialProfile(userId);
  const { register, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<SocialProfileInput>({
    resolver: zodResolver(socialProfileSchema),
    defaultValues: {
      displayName: profile?.display_name ?? '',
      bio: profile?.bio ?? '',
      isPublic: profile?.is_public ?? false,
      showAchievements: profile?.show_achievements ?? true,
      crm: profile?.crm ?? '',
    },
  });

  const isPublic = watch('isPublic');
  const showAchievements = watch('showAchievements');

  async function onSubmit(values: SocialProfileInput) {
    try {
      await upsert.mutateAsync({
        display_name: values.displayName || null,
        bio: values.bio || null,
        is_public: values.isPublic,
        show_achievements: values.showAchievements,
        crm: values.crm || null,
      });
      toast.success('Perfil público atualizado.');
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-line bg-surface p-5" noValidate>
      <div className="flex items-center gap-2.5">
        <Globe className="h-5 w-5 text-primary" />
        <h2 className="text-sm font-semibold text-fg">Perfil público</h2>
        {profile?.verified_crm && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"><BadgeCheck className="h-3 w-3" /> Verificado</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome de exibição" htmlFor="sp-name" error={errors.displayName?.message}><Input id="sp-name" {...register('displayName')} placeholder="Como quer aparecer" /></Field>
        <Field label="CRM (opcional)" htmlFor="sp-crm"><Input id="sp-crm" {...register('crm')} placeholder="Para solicitar selo médico" /></Field>
      </div>
      <Field label="Bio" htmlFor="sp-bio" error={errors.bio?.message}><Input id="sp-bio" {...register('bio')} placeholder="Uma frase sobre você" /></Field>

      <Row label="Perfil público (LGPD: você escolhe expor)"><Switch on={isPublic} onChange={(v) => setValue('isPublic', v, { shouldDirty: true })} /></Row>
      <Row label="Mostrar conquistas no feed"><Switch on={showAchievements} onChange={(v) => setValue('showAchievements', v, { shouldDirty: true })} /></Row>

      <div className="flex items-center justify-between">
        <button type="button" onClick={() => toast.info('Verificação de CRM (CFM) entra em produção em breve.')} className="text-xs text-primary hover:underline">
          Solicitar selo médico
        </button>
        <Button type="submit" disabled={upsert.isPending || !isDirty}>{upsert.isPending ? 'Salvando…' : 'Salvar'}</Button>
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm text-fg-soft">{label}</span>{children}</div>;
}
function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-white/15'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
