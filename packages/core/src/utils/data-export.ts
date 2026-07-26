export const DATA_EXPORT_FORMAT = 'hubpatients-personal-data-export' as const;
export const DATA_EXPORT_SCHEMA_VERSION = '1.0.0' as const;
export const DATA_EXPORT_PAGE_SIZE = 500;

export interface ExportPage<T> {
  data: T[] | null;
  error: unknown | null;
}

export class DataExportError extends Error {
  constructor(message = 'Não foi possível concluir a exportação de dados.') {
    super(message);
    this.name = 'DataExportError';
  }
}

/**
 * Carrega todas as páginas de um recurso. Qualquer falha rejeita a operação
 * inteira para impedir que um arquivo parcial seja apresentado como completo.
 */
export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<ExportPage<T>>,
  pageSize = DATA_EXPORT_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new DataExportError();

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    if (page.error || !Array.isArray(page.data)) throw new DataExportError();
    rows.push(...page.data);
    if (page.data.length < pageSize) return rows;
  }
}

export interface DataExportResourceManifest {
  key: string;
  source_table: string;
  record_count: number;
  fields: string[];
  scope: string;
}

export interface DataExportManifest {
  format: typeof DATA_EXPORT_FORMAT;
  schema_version: typeof DATA_EXPORT_SCHEMA_VERSION;
  generated_at: string;
  subject: { profile_id: string };
  legal_context: string;
  completeness: 'complete';
  pagination: { strategy: 'range'; page_size: number };
  resource_count: number;
  total_records: number;
  resources: DataExportResourceManifest[];
  security_exclusions: string[];
  attachment_policy: string;
}

export function buildDataExportManifest(
  profileId: string,
  resources: DataExportResourceManifest[],
  generatedAt = new Date().toISOString(),
): DataExportManifest {
  return {
    format: DATA_EXPORT_FORMAT,
    schema_version: DATA_EXPORT_SCHEMA_VERSION,
    generated_at: generatedAt,
    subject: { profile_id: profileId },
    legal_context: 'Exportação de dados pessoais — LGPD, art. 18.',
    completeness: 'complete',
    pagination: { strategy: 'range', page_size: DATA_EXPORT_PAGE_SIZE },
    resource_count: resources.length,
    total_records: resources.reduce((total, resource) => total + resource.record_count, 0),
    resources,
    security_exclusions: [
      'Credenciais, hashes, tokens de sessão, tokens de API e tokens de convites não integram o arquivo por segurança.',
    ],
    attachment_policy:
      'O JSON inclui metadados e caminhos de anexos autorizados; os arquivos binários não são incorporados neste formato.',
  };
}
