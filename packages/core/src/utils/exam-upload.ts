export const EXAM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const EXAM_UPLOAD_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,image/heic';

const EXTENSIONS_BY_MIME: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/heic': ['heic'],
};

export type ExamUploadValidation =
  | { valid: true; mime: string; extension: string }
  | { valid: false; code: 'empty' | 'too_large' | 'mime' | 'extension'; message: string };

export function validateExamUpload(file: {
  name: string;
  type: string | null | undefined;
  size: number | null | undefined;
}): ExamUploadValidation {
  if (!Number.isFinite(file.size) || (file.size ?? 0) <= 0) {
    return { valid: false, code: 'empty', message: 'O arquivo está vazio ou não pôde ser lido.' };
  }
  if ((file.size ?? 0) > EXAM_UPLOAD_MAX_BYTES) {
    return { valid: false, code: 'too_large', message: 'O arquivo deve ter no máximo 10 MB.' };
  }

  const mime = (file.type ?? '').trim().toLowerCase();
  const allowedExtensions = EXTENSIONS_BY_MIME[mime];
  if (!allowedExtensions) {
    return { valid: false, code: 'mime', message: 'Use PDF, JPG, PNG, WebP ou HEIC.' };
  }

  const extension = file.name.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      code: 'extension',
      message: 'A extensão do arquivo não corresponde ao tipo informado.',
    };
  }
  return { valid: true, mime, extension };
}

export function safeExamFileName(name: string): string {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  return safe.slice(-120) || 'exame';
}
