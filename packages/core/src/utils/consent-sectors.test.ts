import { describe, expect, it } from 'vitest';
import {
  CONSENT_SCOPES,
  CONSENT_TEXT_VERSION,
  SECTOR_LABELS,
  SECTOR_ORDER,
  scopesBySector,
  type ConsentScope,
} from '../constants/consent';

/*
 * Estes testes não checam "se a lista tem N itens" — isso quebraria a cada
 * setor novo sem proteger nada. Eles travam as INVARIANTES LEGAIS do catálogo,
 * para que uma alteração futura bem-intencionada não torne o app ilícito sem
 * ninguém perceber. Ver o cabeçalho de `constants/consent.ts` e a migração
 * 0042 para a fundamentação (LGPD art. 11, §4º e §5º; art. 12).
 */

describe('catálogo de consentimento por setor', () => {
  it('não repete finalidade (cada purpose é a chave do upsert em consents)', () => {
    const purposes = CONSENT_SCOPES.map((s) => s.purpose);
    expect(new Set(purposes).size).toBe(purposes.length);
  });

  it('todo setor declarado aparece na ordem de exibição e tem rótulo', () => {
    const used = new Set(CONSENT_SCOPES.map((s) => s.sector));
    for (const sector of used) {
      expect(SECTOR_ORDER).toContain(sector);
      expect(SECTOR_LABELS[sector]).toBeTruthy();
    }
  });

  it('scopesBySector cobre todos os escopos, sem sobra nem duplicata', () => {
    const agrupados = SECTOR_ORDER.flatMap((s) => scopesBySector(s));
    expect(agrupados).toHaveLength(CONSENT_SCOPES.length);
    expect(new Set(agrupados.map((s) => s.purpose)).size).toBe(CONSENT_SCOPES.length);
  });

  it('a versão do texto é gravável na coluna consents.version (máx. 40 chars)', () => {
    // O RPC set_patient_consent rejeita versão vazia ou com mais de 40 caracteres.
    expect(CONSENT_TEXT_VERSION.trim().length).toBeGreaterThan(0);
    expect(CONSENT_TEXT_VERSION.length).toBeLessThanOrEqual(40);
  });

  describe('invariantes legais (não relaxar sem parecer jurídico)', () => {
    const pesquisaEPublico = CONSENT_SCOPES.filter(
      (s) => s.sector === 'pesquisa' || s.sector === 'publico',
    );

    it('pesquisa e poder público NUNCA recebem dado identificável', () => {
      // LGPD art. 12: dado anonimizado não é dado pessoal — é o que torna o uso
      // em pesquisa lícito. Um setor de pesquisa em modo `directed` mandaria
      // dado identificável e cairia na vedação do art. 11, §4º.
      expect(pesquisaEPublico.length).toBeGreaterThan(0);
      for (const escopo of pesquisaEPublico) {
        expect(escopo.sharing).not.toBe('directed');
        expect(['anonymized', 'notify_only']).toContain(escopo.sharing);
      }
    });

    it('quem não compartilha nada não pede categoria de dado', () => {
      for (const escopo of CONSENT_SCOPES.filter((s) => s.sharing === 'notify_only')) {
        expect(escopo.defaultData).toHaveLength(0);
      }
    });

    it('convênio declara na tela o limite do art. 11, §5º', () => {
      const convenio = CONSENT_SCOPES.find((s) => s.purpose === 'data_sharing_insurance');
      expect(convenio).toBeDefined();
      // O titular precisa LER que autorizar não muda preço nem cobertura.
      expect(convenio?.limit).toMatch(/§\s*5º/);
      expect(convenio?.limit?.toLowerCase()).toMatch(/pre[çc]o|risco/);
    });

    it('todo escopo cita a base legal (transparência, art. 9º)', () => {
      for (const escopo of CONSENT_SCOPES) {
        expect(escopo.legalBasis.trim().length).toBeGreaterThan(0);
        expect(escopo.legalBasis).toMatch(/art\./i);
      }
    });

    it('nenhum escopo oferece vantagem econômica por dado clínico', () => {
      // art. 11, §4º veda compartilhar dado de saúde para obter vantagem
      // econômica; §5º veda plano usar dado de saúde para precificar. Se alguém
      // escrever "desconto"/"cashback" como ATRATIVO num escopo, este teste cai.
      const proibido = /desconto|cashback|b[oô]nus|recompensa|pagamento|remunera|em troca de/i;
      const ehAvisoDeVedacao = (escopo: ConsentScope) =>
        /n[aã]o pode|proíbe|proibe|vedad|nunca muda|n[aã]o gera|n[aã]o altera/i.test(
          escopo.limit ?? '',
        );

      for (const escopo of CONSENT_SCOPES) {
        expect(proibido.test(escopo.label)).toBe(false);
        expect(proibido.test(escopo.description)).toBe(false);
        // No `limit` a palavra pode aparecer — mas só para NEGAR a prática.
        if (escopo.limit && proibido.test(escopo.limit)) {
          expect(ehAvisoDeVedacao(escopo)).toBe(true);
        }
      }
    });
  });
});
