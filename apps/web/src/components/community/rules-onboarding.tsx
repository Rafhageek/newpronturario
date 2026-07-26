'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ban, HeartHandshake, Stethoscope } from 'lucide-react';
import { useCommunityMember, useAcceptCommunityRules } from '@hubpatients/supabase';
import { useAuth } from '@/components/auth-provider';
import { Modal } from '@/components/ui/modal';

/** Modal de boas-vindas no primeiro acesso ao fórum; registra o aceite das regras. */
export function RulesOnboarding() {
  const { user } = useAuth();
  const { data: me } = useCommunityMember(user?.id);
  const accept = useAcceptCommunityRules(user?.id ?? '');
  const [dismissed, setDismissed] = useState(false);

  const show = Boolean(user && me && !me.community_rules_accepted_at && !dismissed);

  return (
    <Modal
      open={show}
      onClose={() => setDismissed(true)}
      title="Bem-vindo(a) à Comunidade 💙"
      description="Um espaço seguro de apoio entre quem vive desafios de saúde parecidos."
      className="max-w-md"
    >
      <ul className="space-y-2.5">
        <Item icon={HeartHandshake} title="Respeito e acolhimento" text="Experiências e dúvidas são bem-vindas, sem julgamento." />
        <Item icon={Stethoscope} title="Sem prescrição" text="Relatos pessoais sim; dose ou troca de remédio, só com seu médico." />
        <Item icon={Ban} title="Sem venda de remédios" text="Compra, venda ou troca de medicamentos não é permitida." />
      </ul>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link href="/comunidade/regras" onClick={() => setDismissed(true)} className="text-xs text-primary hover:underline">
          Ver regras completas
        </Link>
        <button
          onClick={() => accept.mutate(undefined, { onSuccess: () => setDismissed(true) })}
          disabled={accept.isPending}
          className="inline-flex h-10 items-center rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Li e concordo
        </button>
      </div>
    </Modal>
  );
}

function Item({ icon: Icon, title, text }: { icon: typeof Ban; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-xs text-muted">{text}</p>
      </div>
    </li>
  );
}
