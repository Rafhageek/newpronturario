// ============================================================================
// VidaLog — Edge Function: process-exam (Plus)
//
// SCAFFOLD — não deployado. Para usar:
//   1. supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   2. supabase functions deploy process-exam
//
// Recebe { examId, storagePath } → baixa o arquivo do bucket privado 'exams'
// → pede ao Claude (vision) para EXTRAIR os valores numéricos do laudo
// (apenas transcrição estruturada, NUNCA diagnóstico/interpretação)
// → valida o JSON → grava em exam_metrics.
//
// A narrativa didática (resumo, explicações, perguntas) é montada no app a
// partir do dicionário exam_metric_explanations — não vem do modelo.
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// IMPORTANTE: usar a ANON key (não a service_role) + o JWT do usuário, para
// que a RLS seja aplicada — assim o usuário só baixa os PRÓPRIOS arquivos.
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const EXTRACTION_PROMPT = `Você extrai valores de um laudo de exame laboratorial.
Responda APENAS com JSON no formato:
{"metrics":[{"name":string,"value":number|null,"unit":string|null,"reference_min":number|null,"reference_max":number|null}]}
Regras: transcreva fielmente os valores; NÃO interprete, NÃO diagnostique, NÃO opine.
Se não for um laudo laboratorial legível, retorne {"metrics":[]}.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { examId, storagePath } = await req.json();
    if (!examId || !storagePath) {
      return json({ error: 'examId e storagePath são obrigatórios.' }, 400);
    }

    // Client com a identidade do usuário (RLS aplicada — anon key + JWT).
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return json({ error: 'Não autenticado.' }, 401);

    // Baixa o arquivo e converte para base64.
    const { data: file, error: dlError } = await supabase.storage.from('exams').download(storagePath);
    if (dlError || !file) return json({ error: 'Falha ao baixar o arquivo.' }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = btoa(String.fromCharCode(...bytes));
    const mediaType = file.type || 'image/jpeg';

    // Extração via Claude (vision).
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    });
    const aiData = await aiResp.json();
    const text: string = aiData?.content?.[0]?.text ?? '{"metrics":[]}';

    let parsed: { metrics: Array<Record<string, unknown>> };
    try {
      parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    } catch {
      return json({ error: 'Não foi possível estruturar o exame.' }, 422);
    }

    // Retorna os valores extraídos para REVISÃO do usuário antes de salvar.
    // (A gravação em exam_metrics acontece após confirmação na UI.)
    return json({ examId, metrics: parsed.metrics ?? [] }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
