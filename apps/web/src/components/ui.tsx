'use client';

import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Spinner } from '@/components/ui/spinner';

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Mostra spinner e desabilita o botão durante uma ação assíncrona. */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, loading, disabled, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cx(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-label font-semibold text-white shadow-[0_8px_22px_rgb(4_66_191_/_0.18)]',
          'transition-[background-color,box-shadow,transform] hover:-translate-y-px hover:bg-primary-hover hover:shadow-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </button>
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cx(
          'min-h-11 w-full rounded-chip border border-line-strong bg-surface px-3 text-body-sm text-fg shadow-xs',
          'placeholder:text-hint focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
          className,
        )}
        {...props}
      />
    );
  },
);

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;

  /*
   * Liga o erro ao campo para leitores de tela (aria-describedby/aria-invalid).
   *
   * Três sutilezas que já custaram caro:
   *  - o campo nem sempre vem sozinho (ex.: <Input> + <datalist> na Condição).
   *    Marcamos o PRIMEIRO elemento, que é o controle, em vez de desistir
   *    quando há mais de um filho — antes, esses campos ficavam sem
   *    `aria-invalid` e o erro só existia para quem enxerga a tela;
   *  - se o campo já tem um `aria-describedby` (o texto de ajuda "pode deixar
   *    as duas datas em branco", por exemplo), o erro SOMA a ele. Substituir
   *    trocaria uma informação pela outra bem na hora em que as duas importam;
   *  - a transformação roda SEMPRE, com erro e sem erro. Se ela só rodasse no
   *    estado com erro, a FORMA do filho mudaria junto com o estado (elemento
   *    solto, sem chave, virava lista com chave '.0'), o React não casaria as
   *    duas versões e DESMONTARIA o <input> a cada aparecer/sumir do erro.
   *    Na prática: o foco que o react-hook-form põe no campo inválido caía no
   *    <body>, e — como a revalidação é 'onChange' — o campo era recriado no
   *    meio da digitação, engolindo as letras seguintes. Rodando nos dois
   *    estados, as chaves ficam idênticas e só as props mudam.
   */
  let controleMarcado = false;
  const field: ReactNode = Children.map(children, (filho) => {
    if (controleMarcado || !isValidElement<Record<string, unknown>>(filho)) return filho;
    controleMarcado = true;

    const controle: ReactElement<Record<string, unknown>> = filho;
    const jaDescrito = controle.props['aria-describedby'];
    const descrito = [
      typeof jaDescrito === 'string' && jaDescrito.trim() !== '' ? jaDescrito : null,
      error ? errorId : null,
    ]
      .filter(Boolean)
      .join(' ');

    return cloneElement(controle, {
      // sem erro, devolvemos o que o próprio campo declarou (não apagamos nada)
      'aria-invalid': error ? true : controle.props['aria-invalid'],
      'aria-describedby': descrito !== '' ? descrito : undefined,
    });
  });

  return (
    <div className="space-y-1.5">
      {/*
        O RÓTULO é o que diz à pessoa o que escrever ali — "Substância",
        "Diagnóstico em (opcional)", "CID-10". Ele saía em `text-sm`, e
        `--text-sm` NÃO é redefinido neste projeto (vale o padrão do Tailwind,
        0.875rem = 14px): ficava ABAIXO do piso de 15px desta rodada e, pior,
        MENOR que o próprio campo (`Input`, 15px) e que a mensagem de erro
        logo abaixo (15px). O rótulo tinha virado o menor texto do formulário
        — o inverso da hierarquia que o cliente pediu.

        Agora `text-label` (--text-label, 0.9375rem = 15px), o mesmo degrau do
        erro. É `rem` PURO, então o Modo Sênior e os botões A/A+/A++ levam o
        rótulo junto — um `text-[15px]` aqui desligaria essa escala.

        Tinta MEDIDA (fórmula da WCAG 2.x) — `text-fg-soft` sobre os fundos
        REAIS onde o <Field> aparece (`--surface` do cartão e `--surface-2` do
        bloco de formulário), nos quatro temas da casca `.hp-clinical-shell`:

                                 sobre --surface   sobre --surface-2
          claro     #354056         10,40:1             9,80:1
          escuro    #cfd4dd         12,05:1            10,82:1
          AC claro  #2b2620         14,99:1            14,13:1
          AC escuro #ededed         15,31:1            13,75:1

        Fora da casca (login/cadastro, tema base) o token é #413c36 no claro:
        10,91:1 sobre --surface e 9,67:1 sobre --surface-2; o escuro é o mesmo
        #cfd4dd da tabela. A AA pede 4,5:1 para texto normal — o pior caso
        medido é 9,67:1. O tamanho mudou, a tinta não: nenhuma dessas medidas
        piorou em relação ao que já estava em produção.
      */}
      <label htmlFor={htmlFor} className="block text-label font-medium text-fg-soft">
        {label}
      </label>
      {field}
      {/*
        A mensagem de erro sai em 15px (`text-label`), e não nos 12px de antes:
        o piso desta rodada é 13px, e a frase que explica por que o botão
        "Salvar" não salvou é o último lugar do app onde economizar pixel.
        A tinta de alerta aqui é do SISTEMA (validação de formulário), não
        julgamento do corpo do paciente — é o mesmo token que o arquivo já usa.
      */}
      {error ? (
        <p id={errorId} className="text-label font-medium text-status-alert-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-surface p-5 text-fg shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
