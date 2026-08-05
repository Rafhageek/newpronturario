/**
 * Trava a lista de escopos do Modo Consulta contra o que o banco realmente
 * aceita.
 *
 * O defeito que originou este arquivo: `DEFAULT_SHARE_SCOPES` trazia
 * `read:profile`, mas `issue_consultation_access_token` (migração 0039) só
 * aceita os quatro escopos clínicos e levanta exceção para qualquer outro. O
 * botão "Gerar acesso para o médico" — que o dono do produto chama de função
 * principal do app — falhava com a seleção que a própria tela sugeria.
 *
 * Por que ler os arquivos como texto em vez de importar: a migração é SQL, não
 * é importável, e é ela que manda. Comparar a constante TypeScript com a lista
 * escrita no SQL é o único jeito de a divergência reaparecer e ser reprovada
 * aqui — um teste que só olhasse o TypeScript passaria feliz enquanto o banco
 * recusa em produção.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..', '..', '..');

function ler(caminho: string): string {
  return readFileSync(join(RAIZ, caminho), 'utf8');
}

/** Escopos que a migração 0039 permite, lidos do próprio SQL. */
function escoposDoBanco(): string[] {
  const sql = ler('supabase/migrations/0039_consultation_access_token.sql');
  const bloco = sql.match(/not \(v_scopes <@ array\[([\s\S]*?)\]::text\[\]\)/);
  expect(
    bloco,
    'não achei a validação de escopo na migração 0039 — se ela mudou de forma, ' +
      'este teste precisa ser reescrito, não removido',
  ).toBeTruthy();
  return [...(bloco![1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/** Escopos declarados numa constante TypeScript de sharing.ts. */
function escoposDaConstante(nome: string): string[] {
  const src = ler('packages/supabase/src/queries/sharing.ts');
  const bloco = src.match(new RegExp(`${nome}[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
  expect(bloco, `não achei ${nome} em sharing.ts`).toBeTruthy();
  return [...(bloco![1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe('escopos do Modo Consulta', () => {
  it('a migração 0039 continua listando escopos explícitos', () => {
    const doBanco = escoposDoBanco();
    expect(doBanco.length).toBeGreaterThan(0);
    expect(doBanco).toContain('read:allergies');
  });

  it('CONSULTATION_SCOPES é exatamente o que o banco aceita', () => {
    expect([...escoposDaConstante('CONSULTATION_SCOPES')].sort()).toEqual(
      [...escoposDoBanco()].sort(),
    );
  });

  it('a seleção padrão não pede escopo que o banco recusa', () => {
    const permitidos = new Set(escoposDoBanco());
    const recusados = escoposDaConstante('DEFAULT_SHARE_SCOPES').filter((s) => !permitidos.has(s));
    expect(
      recusados,
      'a tela sugeriria um escopo que o banco derruba: a emissão falharia ' +
        'com "Escopo de consulta inválido." antes de gerar qualquer link',
    ).toEqual([]);
  });

  it('a seleção padrão não é vazia — o banco exige ao menos um escopo', () => {
    // `cardinality(v_scopes) < 1` também levanta exceção na 0039.
    expect(escoposDaConstante('DEFAULT_SHARE_SCOPES').length).toBeGreaterThan(0);
  });

  it('read:profile segue fora do Modo Consulta', () => {
    // Não é detalhe de implementação: a 0039 documenta que dado cadastral não
    // entra no link do médico. Se um dia entrar, é decisão de produto e passa
    // por mudar a migração primeiro — não por afrouxar este teste.
    expect(escoposDoBanco()).not.toContain('read:profile');
    expect(escoposDaConstante('DEFAULT_SHARE_SCOPES')).not.toContain('read:profile');
  });
});
