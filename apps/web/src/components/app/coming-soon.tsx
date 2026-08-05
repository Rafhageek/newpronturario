import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { EmptyState, Seal } from '@/components/ui/painel';

/**
 * Stub elegante para seções planejadas em fases futuras.
 *
 * ⚠️ ESTE ARQUIVO É UM SERVER COMPONENT — e é o caso de teste que pegou o bug.
 *
 * A primeira tentativa de reescrevê-lo com as primitivas do Painel derrubou o
 * `next build`: "Functions cannot be passed directly to Client Components", e o
 * `/assinatura` parou de prerenderizar. A causa não era o ícone: era o
 * `'use client'` que as primitivas carregavam sem precisar, e que transformava
 * cada prop numa travessia de fronteira.
 *
 * As primitivas deixaram de ser `'use client'`, então este arquivo pode passar
 * `icon={Icon}` normalmente. Se ele voltar a quebrar, é sinal de que a marca
 * voltou para `components/ui/painel/primitives.tsx` — e só o `next build` avisa.
 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  phase,
  plus,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase?: number;
  plus?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-16">
      <EmptyState
        icon={Icon}
        tone="ardosia"
        // O vazio aqui já está solto na página, sem cartão em volta — mas
        // `bare` porque a moldura tracejada sugere "some algo aqui em breve",
        // e o que a página diz é outra coisa: a seção inteira ainda não existe.
        variant="bare"
        title={title}
        description={
          <>
            {description}
            {plus ? (
              <span className="mt-3 block text-caption font-semibold uppercase tracking-wide text-primary">
                Recurso Plus
              </span>
            ) : null}
          </>
        }
      />
      <Seal icon={Sparkles} className="mt-4">
        {phase ? `Em desenvolvimento · Fase ${phase}` : 'Em desenvolvimento'}
      </Seal>
    </div>
  );
}
