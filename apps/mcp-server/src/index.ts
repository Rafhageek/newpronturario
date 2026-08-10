#!/usr/bin/env node
/**
 * Servidor MCP do HubPatients (Caminho A — MVP local, stdio).
 *
 * Expõe o prontuário do PRÓPRIO titular, somente leitura, autenticado por um
 * token pessoal (vlk_...) gerado em Configurações → Acesso de IA. O token é o
 * segredo (o app guarda só o hash); os dados vêm de GET /api/v1/me, já
 * restritos aos escopos do token e auditados no banco a cada acesso.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { buscarBundle, HubPatientsApiError } from './api.js';
import {
  examesRecentes,
  filtraVitais,
  mensagemEscopoFaltando,
  NOTA_INFORMATIVA,
  VITAL_TYPES,
} from './bundle.js';

const server = new McpServer(
  { name: 'hubpatients', version: '0.1.0' },
  {
    instructions:
      'Prontuário pessoal de saúde do titular do token (HubPatients), somente leitura. ' +
      'Regra inegociável do produto: os dados são informativos — nunca diagnostique, ' +
      'nunca prescreva nem sugira mudança de dose; oriente sempre a conversar com o médico. ' +
      'Seções ausentes indicam escopo não autorizado no token, não prontuário vazio.',
  },
);

type Resultado = { content: { type: 'text'; text: string }[]; isError?: boolean };

function ok(payload: unknown): Resultado {
  return {
    content: [{ type: 'text', text: JSON.stringify({ nota: NOTA_INFORMATIVA, ...(payload as object) }, null, 2) }],
  };
}

function falha(error: unknown): Resultado {
  const texto =
    error instanceof HubPatientsApiError
      ? error.message
      : 'Erro inesperado ao consultar o HubPatients.';
  return { content: [{ type: 'text', text: texto }], isError: true };
}

function escopoFaltando(escopo: string): Resultado {
  return { content: [{ type: 'text', text: mensagemEscopoFaltando(escopo) }], isError: true };
}

server.registerTool(
  'consultar_perfil',
  {
    title: 'Perfil do paciente',
    description:
      'Dados básicos do titular: nome, data de nascimento, sexo biológico e tipo sanguíneo. ' +
      'Use quando a pergunta envolver identificação ou contexto geral do paciente.',
    inputSchema: {},
  },
  async () => {
    try {
      const bundle = await buscarBundle();
      if (!bundle.patient) return escopoFaltando('read:profile');
      return ok({ paciente: bundle.patient });
    } catch (error) {
      return falha(error);
    }
  },
);

server.registerTool(
  'consultar_medicamentos',
  {
    title: 'Medicamentos em uso',
    description:
      'Lista os medicamentos ATIVOS do titular (nome, dose, forma, frequência). ' +
      'Use para perguntas como "que remédios eu tomo?" ou antes de falar de interações — ' +
      'sem nunca prescrever nem sugerir mudança de dose.',
    inputSchema: {},
  },
  async () => {
    try {
      const bundle = await buscarBundle();
      if (!bundle.medications) return escopoFaltando('read:medications');
      return ok({ total: bundle.medications.length, medicamentos: bundle.medications });
    } catch (error) {
      return falha(error);
    }
  },
);

server.registerTool(
  'consultar_sinais_vitais',
  {
    title: 'Sinais vitais',
    description:
      'Medições registradas pelo titular (pressão, glicemia, peso, frequência cardíaca, ' +
      'temperatura, saturação), mais recentes primeiro. O endpoint devolve as últimas 100; ' +
      'filtre por tipo e período para respostas focadas. Valores fora de faixa devem ser ' +
      'descritos factualmente ("acima do intervalo de referência"), nunca como diagnóstico.',
    inputSchema: {
      tipo: z
        .enum(VITAL_TYPES)
        .optional()
        .describe('Filtra por um tipo de medição (ex.: blood_pressure, glucose).'),
      dias: z
        .number()
        .int()
        .positive()
        .max(365)
        .optional()
        .describe('Só medições dos últimos N dias.'),
      limite: z
        .number()
        .int()
        .positive()
        .max(100)
        .optional()
        .describe('Máximo de medições devolvidas (padrão 30).'),
    },
  },
  async ({ tipo, dias, limite }) => {
    try {
      const bundle = await buscarBundle();
      if (!bundle.vitals) return escopoFaltando('read:vitals');
      const vitais = filtraVitais(bundle.vitals, { tipo, dias, limite });
      return ok({ total: vitais.length, sinaisVitais: vitais });
    } catch (error) {
      return falha(error);
    }
  },
);

server.registerTool(
  'consultar_alergias',
  {
    title: 'Alergias',
    description:
      'Alergias registradas (substância, gravidade, reação). Consulte SEMPRE antes de ' +
      'qualquer conversa sobre medicamentos ou alimentos de risco.',
    inputSchema: {},
  },
  async () => {
    try {
      const bundle = await buscarBundle();
      if (!bundle.allergies) return escopoFaltando('read:allergies');
      return ok({ total: bundle.allergies.length, alergias: bundle.allergies });
    } catch (error) {
      return falha(error);
    }
  },
);

server.registerTool(
  'consultar_exames_recentes',
  {
    title: 'Exames recentes',
    description:
      'Metadados dos exames do titular (título, categoria, data, status), mais recentes ' +
      'primeiro. Não inclui laudos nem valores de métricas — para detalhes, oriente a abrir ' +
      'o exame no app.',
    inputSchema: {
      limite: z
        .number()
        .int()
        .positive()
        .max(50)
        .optional()
        .describe('Máximo de exames devolvidos (padrão 10).'),
    },
  },
  async ({ limite }) => {
    try {
      const bundle = await buscarBundle();
      if (!bundle.exams) return escopoFaltando('read:exams');
      const exames = examesRecentes(bundle.exams, limite ?? 10);
      return ok({ total: exames.length, exames });
    } catch (error) {
      return falha(error);
    }
  },
);

server.registerTool(
  'resumo_prontuario',
  {
    title: 'Resumo do prontuário',
    description:
      'Visão geral em uma chamada: perfil, medicamentos ativos, alergias, últimas medições ' +
      'e exames recentes — apenas as seções que o token autoriza. Bom primeiro passo para ' +
      'perguntas abertas ("como está minha saúde?", "me atualize").',
    inputSchema: {},
  },
  async () => {
    try {
      const bundle = await buscarBundle();
      const escoposAusentes: string[] = [];
      if (!bundle.patient) escoposAusentes.push('read:profile');
      if (!bundle.medications) escoposAusentes.push('read:medications');
      if (!bundle.vitals) escoposAusentes.push('read:vitals');
      if (!bundle.allergies) escoposAusentes.push('read:allergies');
      if (!bundle.exams) escoposAusentes.push('read:exams');

      return ok({
        geradoEm: bundle.generatedAt,
        paciente: bundle.patient ?? null,
        medicamentosAtivos: bundle.medications ?? null,
        alergias: bundle.allergies ?? null,
        ultimasMedicoes: bundle.vitals ? filtraVitais(bundle.vitals, { limite: 10 }) : null,
        examesRecentes: bundle.exams ? examesRecentes(bundle.exams, 5) : null,
        escoposNaoAutorizados: escoposAusentes,
      });
    } catch (error) {
      return falha(error);
    }
  },
);

async function main() {
  await server.connect(new StdioServerTransport());
  // stdout é o canal do protocolo MCP — logs vão para stderr.
  console.error('Servidor MCP do HubPatients pronto (stdio).');
}

main().catch((error) => {
  console.error('Falha ao iniciar o servidor MCP:', error);
  process.exit(1);
});
