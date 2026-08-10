import type { MeBundle } from './bundle.js';

const BASE_URL_PADRAO = 'https://app.hubpacients.org';

/**
 * Cache curto em memória: numa mesma pergunta o assistente costuma chamar várias
 * ferramentas, e todas leem o MESMO endpoint — sem o cache, cada turno gastaria
 * o rate limit do token à toa.
 */
const CACHE_TTL_MS = 60_000;
let cache: { em: number; bundle: MeBundle } | null = null;

export class HubPatientsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HubPatientsApiError';
  }
}

function lerConfig(): { baseUrl: string; token: string } {
  const token = (process.env.HUBPATIENTS_TOKEN ?? '').trim();
  if (!token) {
    throw new HubPatientsApiError(
      'HUBPATIENTS_TOKEN não configurado. Gere um token em ' +
        'Configurações → Acesso de IA no HubPatients e defina a variável de ambiente.',
    );
  }
  if (!/^vlk_[A-Za-z0-9_-]{43,128}$/.test(token)) {
    throw new HubPatientsApiError(
      'HUBPATIENTS_TOKEN com formato inválido — o token começa com "vlk_" e é exibido ' +
        'uma única vez ao ser gerado em Configurações → Acesso de IA.',
    );
  }
  const baseUrl = (process.env.HUBPATIENTS_API_URL ?? BASE_URL_PADRAO).replace(/\/+$/, '');
  return { baseUrl, token };
}

export async function buscarBundle(): Promise<MeBundle> {
  if (cache && Date.now() - cache.em < CACHE_TTL_MS) return cache.bundle;

  const { baseUrl, token } = lerConfig();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new HubPatientsApiError(
      `Não foi possível conectar a ${baseUrl}. Verifique a internet e a variável HUBPATIENTS_API_URL.`,
    );
  }

  if (res.status === 401) {
    throw new HubPatientsApiError(
      'Token inválido, expirado ou revogado (tokens duram 90 dias). ' +
        'Gere um novo em Configurações → Acesso de IA.',
      401,
    );
  }
  if (res.status === 429) {
    throw new HubPatientsApiError(
      'Limite de requisições do token excedido. Aguarde cerca de um minuto e tente de novo.',
      429,
    );
  }
  if (!res.ok) {
    throw new HubPatientsApiError(
      `O HubPatients respondeu HTTP ${res.status}. Tente novamente em instantes.`,
      res.status,
    );
  }

  const bundle = (await res.json()) as MeBundle;
  cache = { em: Date.now(), bundle };
  return bundle;
}
