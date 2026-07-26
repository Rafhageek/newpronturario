'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Globe, Stethoscope } from 'lucide-react';
import { socialProfileSchema, type SocialProfileInput, type SocialProfile } from '@hubpatients/core';
import { useUpsertSocialProfile } from '@hubpatients/supabase';
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
      </div>

      <Field label="Nome de exibição" htmlFor="sp-name" error={errors.displayName?.message}><Input id="sp-name" {...register('displayName')} placeholder="Como quer aparecer no fórum" /></Field>
      <Field label="Bio" htmlFor="sp-bio" error={errors.bio?.message}><Input id="sp-bio" {...register('bio')} placeholder="Uma frase sobre você (sem dados de saúde)" /></Field>

      <Row label="Perfil público (LGPD: você escolhe expor)"><Switch on={isPublic} onChange={(v) => setValue('isPublic', v, { shouldDirty: true })} /></Row>
      <Row label="Mostrar conquistas no feed"><Switch on={showAchievements} onChange={(v) => setValue('showAchievements', v, { shouldDirty: true })} /></Row>

      <div className="flex items-center justify-between gap-3">
        <Link href="/configuracoes/verificacao-profissional" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Stethoscope className="h-3.5 w-3.5" /> Solicitar selo médico
        </Link>
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
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-line'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}
