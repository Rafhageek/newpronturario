/**
 * A regressão que este arquivo trava está descrita em `estado-secao.ts`: com o
 * `patientId` vazio, as consultas do painel ficam `enabled: false` e o React
 * Query v5 devolve `isLoading === false` E `isError === false`. As duas travas
 * da tela eram contornadas ao mesmo tempo, e o painel exibia
 * "Alergias — Nenhuma registrada" antes de saber de quem era o prontuário.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { estadoSecao, estadoAgregado, podeAfirmarAusencia } from './estado-secao';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** packages/core/src/utils → raiz do monorepo. */
const RAIZ = resolve(AQUI, '..', '..', '..', '..');

/** Consulta desligada no React Query v5: nem sucesso, nem erro, nem carregando. */
const CONSULTA_DESLIGADA = { isSuccess: false, isError: false } as const;

describe('estadoSecao', () => {
  it('não deixa afirmar ausência enquanto não se sabe de quem é o prontuário', () => {
    const estado = estadoSecao({ sujeitoConhecido: false, ...CONSULTA_DESLIGADA });

    expect(estado).toBe('sujeito-indefinido');
    expect(podeAfirmarAusencia(estado)).toBe(false);
  });

  it('ignora as flags da consulta desligada, inclusive um sucesso do paciente anterior', () => {
    // Trocar de perfil mantém, por um instante, o `isSuccess` da consulta antiga.
    // O dado é de outra pessoa: não serve para afirmar nada sobre esta.
    expect(estadoSecao({ sujeitoConhecido: false, isSuccess: true, isError: false })).toBe(
      'sujeito-indefinido',
    );
    expect(estadoSecao({ sujeitoConhecido: false, isSuccess: false, isError: true })).toBe(
      'sujeito-indefinido',
    );
  });

  it('falha é falha — nunca "nenhum registro"', () => {
    const estado = estadoSecao({ sujeitoConhecido: true, isSuccess: false, isError: true });

    expect(estado).toBe('falhou');
    expect(podeAfirmarAusencia(estado)).toBe(false);
  });

  it('consulta em curso ainda não autoriza afirmação', () => {
    const estado = estadoSecao({ sujeitoConhecido: true, ...CONSULTA_DESLIGADA });

    expect(estado).toBe('carregando');
    expect(podeAfirmarAusencia(estado)).toBe(false);
  });

  it('só o servidor tendo respondido libera "nenhum registro"', () => {
    const estado = estadoSecao({ sujeitoConhecido: true, isSuccess: true, isError: false });

    expect(estado).toBe('confirmada');
    expect(podeAfirmarAusencia(estado)).toBe(true);
  });
});

describe('estadoAgregado', () => {
  it('uma seção sem sujeito contamina a tela inteira', () => {
    expect(estadoAgregado(['confirmada', 'sujeito-indefinido', 'falhou'])).toBe(
      'sujeito-indefinido',
    );
  });

  it('enquanto algo carrega a tela não acusa erro (ela ainda pode se recuperar)', () => {
    expect(estadoAgregado(['confirmada', 'carregando', 'falhou'])).toBe('carregando');
  });

  it('terminado o carregamento, uma falha qualquer impede o resumo de se dar por completo', () => {
    expect(estadoAgregado(['confirmada', 'falhou'])).toBe('falhou');
  });

  it('tudo confirmado (ou nada a confirmar) libera a tela', () => {
    expect(estadoAgregado(['confirmada', 'confirmada'])).toBe('confirmada');
    expect(estadoAgregado([])).toBe('confirmada');
  });
});

/**
 * Trava de uso: a regra acima não vale nada se a tela voltar a decidir sozinha.
 * O painel é onde o defeito apareceu, e é a tela que roda em TODO login.
 */
describe('o painel da web usa a regra em vez de reinventá-la', () => {
  const painel = readFileSync(
    join(RAIZ, 'apps/web/src/app/(app)/dashboard/page.tsx'),
    'utf8',
  );
  const contexto = readFileSync(
    join(RAIZ, 'apps/web/src/components/profile-context.tsx'),
    'utf8',
  );

  it('o contexto de perfil informa se o paciente já é conhecido', () => {
    expect(
      contexto,
      '`ProfileProvider` precisa expor `isPatientKnown`: é ele que distingue ' +
        '"ainda não sei quem é" de "paciente sem registros".',
    ).toContain('isPatientKnown');
    expect(
      contexto,
      'o flag tem de considerar o `loading` do useAuth, senão volta a nascer `true` cedo demais.',
    ).toMatch(/loading/);
  });

  it('o painel pergunta ao contexto antes de renderizar', () => {
    expect(
      painel,
      'o painel voltou a decidir sozinho o que é "vazio". Use `isPatientKnown` + `estadoSecao`.',
    ).toContain('isPatientKnown');
    expect(painel).toContain('estadoSecao');
  });
});
