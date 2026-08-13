'use client';

/**
 * Campo com sugestões da CID-10 embarcada (recorte oficial do DATASUS).
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O campo "Condição" usava um `<datalist>` alimentado por `CID10_COMMON`: 15
 * itens. O cliente digitou "ateros" para registrar a própria aterosclerose,
 * não apareceu nada, e ele concluiu que o app não aceitava a doença dele —
 * quando `I70 Aterosclerose` estava na base do projeto desde 25/07, só nunca
 * ligada aqui. Agora a busca é sobre `searchCid10()`, com as 310 categorias
 * do recorte, sem acento e por código ou por descrição.
 *
 * O TEXTO LIVRE É A REGRA, A LISTA É O ATALHO
 * O recorte tem 310 categorias; a CID-10 oficial tem 2045 de 3 dígitos e ainda
 * se desdobra em 4 dígitos. A condição da pessoa PODE não estar na lista, e
 * isso é normal — "colesterol alto", por exemplo, não casa com nenhuma
 * descrição oficial (a de E78 é "Distúrbios do metabolismo de lipoproteínas
 * e outras lipidemias"). Por isso:
 *   · nada aqui obriga a escolher um item: o que estiver digitado é o que vale;
 *   · a nota de texto livre fica SEMPRE visível, não só quando a busca falha —
 *     foi ver a lista vazia sem explicação que fez o cliente desistir;
 *   · a busca sem resultado responde por escrito, em vez de sumir calada.
 *
 * O QUE ESTE COMPONENTE NÃO FAZ: sugerir diagnóstico, dizer o que a pessoa
 * "tem" ou completar sintoma. Ele ETIQUETA com um código o registro que a
 * pessoa já traz do laudo, do atestado ou da receita. Ver `CID10_DISCLAIMER`.
 *
 * DE ONDE VEIO CADA PARTE (conferido linha a linha, 2026-08)
 * O COMPORTAMENTO é cópia de `components/meds/medication-autocomplete.tsx`
 * (validado em produção), para o app não ter um terceiro jeito de completar
 * campo: combobox ARIA (`role` + `aria-expanded` + `aria-controls` +
 * `aria-activedescendant` + `aria-selected`), teclado inteiro (↑ ↓ Enter Esc
 * Tab, com o Enter só interceptado quando há item destacado), `onMouseDown` com
 * `preventDefault` nas opções e no "limpar", `MIN_QUERY = 2` e a regra de que o
 * texto digitado SEMPRE vale.
 *
 * O VISUAL **não** é cópia de lá, e isto é deliberado: a casca segue o `Input`
 * de `components/ui.tsx` (`rounded-chip`, `border-line-strong`, `bg-surface`,
 * `shadow-xs`, `placeholder:text-hint`, anel de foco `primary/20`), porque este
 * campo fica no meio de outros `<Input>` e de um `<select>` do MESMO formulário
 * do Perfil — parecer com os vizinhos vale mais que parecer com a tela de
 * Medicamentos, que usa `rounded-xl` / `border-line` / `bg-surface-2` /
 * `placeholder:text-muted`.
 *
 * As demais diferenças, para ninguém achar que são descuido:
 *  · TAMANHO do texto digitado: 15px (`text-body-sm`), o mesmo dos outros
 *    campos deste formulário; lá são 17px (`text-body`). Consequência conhecida
 *    e não resolvida aqui: abaixo de 16px o Safari do iPhone dá zoom ao focar o
 *    campo. Isso já vale para TODO campo deste formulário (o `Input` do projeto
 *    é 15px), então subir só este resolveria o zoom em um campo e quebraria o
 *    alinhamento com os outros — decisão de tela, não deste arquivo;
 *  · campo CONTROLADO por react-hook-form: recebe `name`, devolve `onBlur` e
 *    encaminha `inputRef` (é por ele que o RHF leva o foco ao campo inválido).
 *    O de Medicamentos não encaminha ref nem `onBlur`, e tem `required`; aqui
 *    quem decide obrigatoriedade é o `conditionSchema`;
 *  · DOIS modos (`campo`: 'condicao' | 'codigo') sobre o mesmo componente; lá é
 *    um campo só;
 *  · a nota de texto livre fica SEMPRE visível e o "nenhum código encontrado"
 *    sai com `role="status"`; ambos entram no `aria-describedby` do campo. Lá a
 *    frase equivalente só aparece na busca vazia e não é ligada ao input;
 *  · `showDisclaimer` nasce FALSE aqui (a procedência aparece uma vez na tela,
 *    no campo CID-10) e TRUE lá;
 *  · miudezas visuais que acompanham a casca: lupa de 16px (lá 20px), lista com
 *    `max-h-72` (lá `max-h-96`) e opções de UMA linha alinhadas ao centro (lá
 *    duas linhas, alinhadas ao topo).
 */

import {
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
  type RefObject,
} from 'react';
import { Search, Tag, X } from 'lucide-react';
import { CID10_DISCLAIMER, searchCid10, type Cid10Category } from '@hubpatients/core';

/**
 * Mínimo de caracteres para ABRIR a lista. É a única regra de busca que mora
 * neste arquivo: com 1 letra a lista viraria um recorte arbitrário das 310
 * categorias, então nem abre.
 *
 * O que este número NÃO faz: decidir o que é resultado bom. Relevância,
 * ordenação e casamento de termo são de `searchCid10()` (packages/core) — se
 * lá o mínimo para responder subir, este constante tem que subir junto, senão o
 * campo abre e fecha a lista sem explicar por quê. Não há debounce aqui: a
 * busca é síncrona, em memória, sobre 310 itens.
 */
const MIN_QUERY = 2;

/**
 * Qual dos dois campos está sendo preenchido. Muda o que a escolha escreve
 * NESTE campo (a descrição ou o código) — a lista mostra os dois nos dois
 * casos, para a pessoa conferir antes de escolher.
 */
export type CampoCid10 = 'condicao' | 'codigo';

const PLACEHOLDER: Record<CampoCid10, string> = {
  condicao: 'Ex.: Aterosclerose, Hipertensão, Artrose…',
  codigo: 'Ex.: I70',
};

const NOTA_LIVRE: Record<CampoCid10, string> = {
  // Nenhuma das duas frases pergunta "o que você tem" nem manda "selecionar o
  // diagnóstico": elas descrevem o que o campo aceita. Regra 1 do produto.
  condicao:
    'Escreva do seu jeito. A lista é só um atalho para achar o código — nenhuma condição fica de fora por não estar nela.',
  codigo: 'Opcional. Se você não sabe o código, deixe em branco — o nome da condição basta.',
};

export function ConditionAutocomplete({
  campo,
  value,
  onChange,
  onSelect,
  onBlur,
  inputRef: refExterna,
  id,
  name,
  placeholder,
  limit = 8,
  disabled,
  autoFocus,
  showDisclaimer = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  campo: CampoCid10;
  /** Texto do campo (controlado). */
  value: string;
  /** Chamado a cada tecla — é isto que o formulário deve salvar. */
  onChange: (value: string) => void;
  /** Chamado quando a pessoa escolhe uma sugestão (para preencher o par). */
  onSelect?: (categoria: Cid10Category) => void;
  onBlur?: () => void;
  /** Ref do controle (o `field.ref` do react-hook-form leva o foco ao erro). */
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  placeholder?: string;
  /** Quantas sugestões mostrar. */
  limit?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Procedência da base. Precisa aparecer ao menos uma vez na tela. */
  showDisclaimer?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const reactId = useId();
  const inputId = id ?? `cid-ac-${reactId}`;
  const listId = `${inputId}-list`;
  const livreId = `${inputId}-livre`;
  const vazioId = `${inputId}-vazio`;
  const noteId = `${inputId}-note`;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const query = value.trim();
  const results = useMemo(
    () => (query.length >= MIN_QUERY ? searchCid10(query, limit) : []),
    [query, limit],
  );
  const expanded = open && results.length > 0;
  const semResultado = query.length >= MIN_QUERY && results.length === 0;

  function choose(categoria: Cid10Category) {
    onChange(campo === 'codigo' ? categoria.code : categoria.description_pt);
    onSelect?.(categoria);
    setOpen(false);
    setActive(-1);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!expanded) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault();
        setOpen(true);
        setActive(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const categoria = active >= 0 ? results[active] : undefined;
      if (categoria) {
        // Só intercepta o Enter quando há sugestão destacada — senão o
        // formulário continua enviando o que a pessoa escreveu, que é o
        // caminho normal deste campo.
        e.preventDefault();
        choose(categoria);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-chip border border-line-strong bg-surface px-3 shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4 shrink-0 text-fg-soft" aria-hidden="true" />
        <input
          ref={(el) => {
            inputRef.current = el;
            if (typeof refExterna === 'function') refExterna(el);
            else if (refExterna) (refExterna as RefObject<HTMLInputElement | null>).current = el;
          }}
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          /* autoComplete + autoCorrect: sem isto o Safari do cliente sobrepõe
             contatos e cartões salvos à lista clínica (visto em produção). */
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={ariaInvalid}
          aria-describedby={
            [ariaDescribedBy, livreId, semResultado ? vazioId : null, showDisclaimer ? noteId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder ?? PLACEHOLDER[campo]}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            onBlur?.();
          }}
          onKeyDown={onKeyDown}
          className="min-h-11 w-full bg-transparent text-body-sm text-fg outline-none placeholder:text-hint disabled:cursor-not-allowed disabled:opacity-60"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label="Limpar"
            // onMouseDown evita o blur do input antes do clique registrar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('');
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="-mr-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-chip text-fg-soft transition hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Códigos da CID-10 encontrados"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-chip border border-line bg-surface p-1 shadow-lg shadow-black/5"
        >
          {results.map((categoria, i) => (
            <li key={categoria.code}>
              <button
                type="button"
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(categoria)}
                className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  i === active ? 'bg-surface-2' : 'hover:bg-surface-2'
                }`}
              >
                <Tag className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {/* Código e descrição saem juntos nos DOIS campos: quem digita
                      "I70" confere que é aterosclerose antes de escolher, e quem
                      digita "ateros" vê qual código vai junto. */}
                  <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-body-sm font-semibold text-fg-soft">
                    {categoria.code}
                  </span>
                  <span className="min-w-0 text-body-sm text-fg">{categoria.description_pt}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* SEMPRE visível, e não só quando a busca falha: a leitura errada do
          cliente ("o app não aceita a minha doença") nasceu de uma lista que
          ficava vazia sem dizer nada. */}
      <p id={livreId} className="mt-1.5 text-body-sm leading-snug text-fg-soft">
        {NOTA_LIVRE[campo]}
      </p>

      {semResultado && (
        <p
          id={vazioId}
          role="status"
          className="mt-1.5 text-body-sm font-medium leading-snug text-fg"
        >
          Nenhum código encontrado para “{query}” — você pode cadastrar assim mesmo.
        </p>
      )}

      {showDisclaimer && (
        <p id={noteId} className="mt-1.5 text-body-sm leading-snug text-fg-soft">
          {CID10_DISCLAIMER}
        </p>
      )}
    </div>
  );
}
