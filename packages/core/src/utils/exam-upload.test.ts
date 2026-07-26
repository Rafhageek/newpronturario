import { describe, expect, it } from 'vitest';
import { EXAM_UPLOAD_MAX_BYTES, safeExamFileName, validateExamUpload } from './exam-upload';

describe('validateExamUpload', () => {
  it('aceita combinações MIME/extensão autorizadas', () => {
    expect(validateExamUpload({ name: 'LAUDO.PDF', type: 'application/pdf', size: 10 })).toMatchObject({
      valid: true,
      extension: 'pdf',
    });
    expect(validateExamUpload({ name: 'imagem.jpeg', type: 'image/jpeg', size: 10 }).valid).toBe(true);
  });

  it('rejeita arquivo grande, tipo desconhecido e MIME divergente', () => {
    expect(validateExamUpload({ name: 'x.pdf', type: 'application/pdf', size: EXAM_UPLOAD_MAX_BYTES + 1 })).toMatchObject({ code: 'too_large' });
    expect(validateExamUpload({ name: 'x.exe', type: 'application/octet-stream', size: 10 })).toMatchObject({ code: 'mime' });
    expect(validateExamUpload({ name: 'x.pdf', type: 'image/jpeg', size: 10 })).toMatchObject({ code: 'extension' });
  });

  it('normaliza nomes sem permitir separadores de caminho', () => {
    expect(safeExamFileName('../Laúdo clínico.pdf')).toBe('.._Laudo_clinico.pdf');
  });
});
