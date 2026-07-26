import { describe, expect, it } from 'vitest';
import {
  DataExportError,
  buildDataExportManifest,
  collectPaginatedRows,
} from './data-export';

describe('collectPaginatedRows', () => {
  it('carrega todos os registros em mais de uma página', async () => {
    const source = Array.from({ length: 1_201 }, (_, id) => ({ id }));
    const rows = await collectPaginatedRows(
      (from, to) => Promise.resolve({ data: source.slice(from, to + 1), error: null }),
      500,
    );
    expect(rows).toHaveLength(1_201);
    expect(rows.at(-1)).toEqual({ id: 1_200 });
  });

  it('falha fechado e não retorna exportação parcial', async () => {
    await expect(
      collectPaginatedRows((from) =>
        Promise.resolve(
          from === 0
            ? { data: Array.from({ length: 2 }, (_, id) => ({ id })), error: null }
            : { data: null, error: new Error('falha') },
        ), 2),
    ).rejects.toBeInstanceOf(DataExportError);
  });
});

describe('buildDataExportManifest', () => {
  it('declara versão, cobertura e contagens verificáveis', () => {
    const manifest = buildDataExportManifest(
      'patient-1',
      [{ key: 'exams', source_table: 'exams', record_count: 3, fields: ['id'], scope: 'patient_id' }],
      '2026-07-25T12:00:00.000Z',
    );
    expect(manifest.schema_version).toBe('1.0.0');
    expect(manifest.completeness).toBe('complete');
    expect(manifest.total_records).toBe(3);
    expect(manifest.subject.profile_id).toBe('patient-1');
  });
});
