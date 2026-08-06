'use client';

import Link from 'next/link';
import { ArrowLeft, Ban, HeartHandshake, Lock, MessageCircle, ShieldCheck, Stethoscope } from 'lucide-react';
import { CRISIS_NOTICE } from '@hubpatients/core';

const RULES = [
  { icon: HeartHandshake, title: 'Respeito sempre', text: 'Acolhemos experiências e dúvidas sem julgamento. Nada de ataques, preconceito ou exposição de outras pessoas.' },
  { icon: Stethoscope, title: 'Sem prescrição', text: 'Compartilhe o que viveu — mas recomendações de dose, troca ou suspensão de remédio só vêm do seu médico.' },
  { icon: Ban, title: 'Sem venda de remédios', text: 'Compra, venda, troca ou doação de medicamentos é proibida por lei no Brasil e não é permitida aqui.' },
  { icon: MessageCircle, title: 'Sem desinformação', text: 'Evite “curas milagrosas” e informações falsas de saúde. Na dúvida, traga a fonte e fale com seu médico.' },
  { icon: Lock, title: 'Privacidade', text: 'Não publique dados de terceiros. Você pode postar com pseudônimo ou de forma anônima a qualquer momento.' },
  { icon: ShieldCheck, title: 'Moderação', text: 'Conteúdos que violam as regras podem ser ocultados. Advertências repetidas suspendem a publicação por um período (a leitura continua).' },
];

export default function RegrasPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page hp-page--community">
      <Link href="/comunidade" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Comunidade
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>Regras da comunidade</h1>
        <p className="text-sm text-muted">Um espaço seguro de apoio entre quem vive desafios de saúde parecidos.</p>
      </header>

      <div className="space-y-2.5">
        {RULES.map((r) => (
          <div key={r.title} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-primary">
              <r.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-fg">{r.title}</p>
              <p className="text-xs leading-relaxed text-muted">{r.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
        <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-fg-soft">{CRISIS_NOTICE}</p>
      </div>
    </div>
  );
}
