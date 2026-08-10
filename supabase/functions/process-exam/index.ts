// ============================================================================
// HubPatients — Edge Function: process-exam
//
// Para ligar:
//   1. supabase secrets set ANTHROPIC_API_KEY=sk-ant-... AI_EXAM_ENABLED=true
//   2. supabase functions deploy process-exam
//
// Recebe { examId, consent } → resolve o arquivo do exame do PRÓPRIO usuário
// no bucket privado 'exams' → pede ao Claude (visão) para EXTRAIR os valores
// do laudo (foto ou PDF; apenas transcrição estruturada, NUNCA
// diagnóstico/interpretação) → valida → devolve para REVISÃO do usuário.
//
// A narrativa didática (resumo, explicações, perguntas) é montada no app a
// partir do dicionário exam_metric_explanations — não vem do modelo.
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const AI_EXAM_ENABLED = Deno.env.get('AI_EXAM_ENABLED') === 'true';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// IMPORTANTE: usar a ANON key (não a service_role) + o JWT do usuário, para
// que a RLS seja aplicada — assim o usuário só baixa os PRÓPRIOS arquivos.
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const EXTRACTION_PROMPT = `Você extrai valores de um laudo de exame laboratorial.
Responda APENAS com JSON no formato:
{"metrics":[{"name":string,"value":number|null,"unit":string|null,"reference_min":number|null,"reference_max":number|null}]}
Regras: transcreva fielmente os valores; NÃO interprete, NÃO diagnostique, NÃO opine.
Se não for um laudo laboratorial legível, retorne {"metrics":[]}.`;

// Limites de consumo (OWASP LLM10 — Unbounded Consumption).
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const AI_TIMEOUT_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Saída estruturada da API (json_schema): o modelo é OBRIGADO a devolver este
// formato — o Zod abaixo continua validando limites que o schema não expressa.
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    metrics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          value: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          unit: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          reference_min: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          reference_max: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        },
        required: ['name', 'value', 'unit', 'reference_min', 'reference_max'],
        additionalProperties: false,
      },
    },
  },
  required: ['metrics'],
  additionalProperties: false,
} as const;

// Schema ESTRITO da resposta da IA (rejeita campos extras, limita tamanhos,
// exige números finitos). Não confiar no modelo: validar tudo.
const MetricSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    value: z.number().finite().nullable(),
    unit: z.string().trim().max(24).nullable(),
    reference_min: z.number().finite().nullable(),
    reference_max: z.number().finite().nullable(),
  })
  .strict();
const AiResponseSchema = z.object({ metrics: z.array(MetricSchema).max(60) }).strict();

// Rate limit best-effort por usuário (instância de edge é efêmera).
const RL = new Map<string, { count: number; reset: number }>();
function rateLimited(userId: string, max = 10, windowMs = 60 * 60_000): boolean {
  const now = Date.now();
  const e = RL.get(userId);
  if (!e || now > e.reset) {
    RL.set(userId, { count: 1, reset: now + windowMs });
    return false;
  }
  e.count += 1;
  return e.count > max;
}

/** base64 em blocos — evita estourar a pilha do btoa com arquivos grandes. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Fail-closed: o recurso permanece congelado até que governança clínica,
    // RIPD, contrato do fornecedor e consentimento persistido estejam aprovados.
    if (!AI_EXAM_ENABLED) {
      return json({ error: 'Leitura por IA temporariamente indisponível.' }, 503);
    }

    // O cliente envia SOMENTE examId + consentimento explícito de IA.
    // O storagePath NUNCA vem do cliente (evita ler arquivo de terceiro).
    const body = await req.json().catch(() => null);
    const examId: unknown = body?.examId;
    const consent: unknown = body?.consent;
    if (typeof examId !== 'string' || !UUID_RE.test(examId)) {
      return json({ error: 'examId inválido.' }, 400);
    }
    if (consent !== true) {
      return json({ error: 'É necessário consentir o envio do exame para leitura por IA.' }, 400);
    }

    // Client com a identidade do usuário (RLS aplicada — anon key + JWT).
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: 'Não autenticado.' }, 401);

    // Rate limit por usuário.
    if (rateLimited(userData.user.id)) {
      return json({ error: 'Muitos exames processados recentemente. Tente mais tarde.' }, 429);
    }

    // Resolve o caminho do arquivo NO SERVIDOR pelo exame do PRÓPRIO usuário
    // (a RLS de `exams` garante que só retorna se o usuário pode acessá-lo).
    const { data: exam, error: examErr } = await supabase
      .from('exams')
      .select('storage_path')
      .eq('id', examId)
      .maybeSingle();
    if (examErr || !exam?.storage_path) {
      return json({ error: 'Exame não encontrado.' }, 404);
    }

    // O RPC valida consentimento persistido e propriedade do exame. Auditoria
    // é fail-closed: PHI não sai do ambiente se a trilha não puder ser gravada.
    const { error: auditError } = await supabase.rpc('log_ai_exam_processing', {
      p_exam_id: examId,
    });
    if (auditError) {
      return json({ error: 'Não foi possível validar o consentimento para IA.' }, 403);
    }

    // Baixa o arquivo e converte para base64.
    const { data: file, error: dlError } = await supabase.storage.from('exams').download(exam.storage_path);
    if (dlError || !file) return json({ error: 'Falha ao baixar o arquivo.' }, 400);

    const mediaType = file.type || 'image/jpeg';
    if (!ALLOWED_MIME.has(mediaType)) {
      return json(
        { error: 'Formato não suportado para leitura por IA (use PDF, JPG, PNG ou WEBP).' },
        415,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      return json({ error: 'Arquivo muito grande (máx. 8 MB).' }, 413);
    }
    const base64 = toBase64(bytes);

    // PDF entra como bloco `document`; imagem como bloco `image`.
    const fileBlock =
      mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } };

    // Extração via Claude (visão) — com timeout. Saída estruturada garante o
    // formato; `fallbacks: "default"` re-serve num modelo alternativo se o
    // classificador de segurança recusar (laudo é benigno, mas há falso positivo).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), AI_TIMEOUT_MS);
    let aiResp: Response;
    try {
      aiResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'server-side-fallback-2026-07-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-opus-5',
          // Teto de saída inclui o thinking adaptativo do modelo, não só o JSON.
          max_tokens: 8192,
          fallbacks: 'default',
          output_config: { format: { type: 'json_schema', schema: EXTRACTION_SCHEMA } },
          messages: [
            {
              role: 'user',
              content: [fileBlock, { type: 'text', text: EXTRACTION_PROMPT }],
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!aiResp.ok) {
      return json({ error: 'Falha na leitura do exame. Tente novamente.' }, 502);
    }
    const aiData = await aiResp.json();
    if (aiData?.stop_reason === 'refusal') {
      return json(
        { error: 'Não foi possível ler este exame automaticamente. Adicione os valores manualmente.' },
        422,
      );
    }
    // O modelo pode emitir blocos de thinking antes do texto — localizar por tipo.
    const textBlock = Array.isArray(aiData?.content)
      ? aiData.content.find((b: { type?: string }) => b?.type === 'text')
      : undefined;
    const text: string = textBlock?.text ?? '{"metrics":[]}';

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {
      return json({ error: 'Não foi possível estruturar o exame.' }, 422);
    }

    // Validação ESTRITA: rejeita campos extras, nomes/unidades longos demais,
    // números não-finitos, ou mais de 60 métricas. Não confiar no modelo.
    const result = AiResponseSchema.safeParse(rawJson);
    if (!result.success) {
      return json({ error: 'Resposta da IA fora do formato esperado.' }, 422);
    }

    // Retorna os valores extraídos para REVISÃO do usuário antes de salvar.
    // (A gravação em exam_metrics acontece após confirmação na UI.)
    return json({ examId, metrics: result.data.metrics }, 200);
  } catch (e) {
    const errorId = crypto.randomUUID();
    // Não enviar stack, payload, nome de arquivo ou PHI ao log geral.
    console.error(
      JSON.stringify({
        event: 'process_exam_failed',
        errorId,
        errorType: e instanceof Error ? e.name : 'UnknownError',
      }),
    );
    return json({ error: 'Erro interno.', id: errorId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
