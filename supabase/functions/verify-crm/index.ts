// ============================================================================
// HubPatients — Edge Function: verify-crm (CONSULTA INFORMATIVA de CRM)
//
// A partir do 0022 esta função NÃO concede mais o selo. Ela apenas CONSULTA o
// CRM (placeholder p/ a base do CFM) e devolve o resultado, que o app grava em
// professional_verifications.verify_crm_response. A badge só é concedida por um
// ADMIN (approve_professional_verification) — assim o selo nunca depende de
// escrita do próprio usuário (corrige a escalada do verified_crm).
//
// Não há API pública oficial estável do CFM — integração real entra em produção.
// Usa ANON KEY + JWT do usuário só para autenticar quem chama (sem service_role).
//
// Deploy: supabase functions deploy verify-crm
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { logSafeFailure } from '../_shared/observability.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// CRM no formato "12345-UF" ou "12345/UF" (4 a 6 dígitos + UF de 2 letras).
const CRM_RE = /^\d{4,6}[-/][A-Za-z]{2}$/;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

    const body = await req.json().catch(() => null);
    const crm = typeof body?.crm === 'string' ? body.crm.trim() : '';
    if (!CRM_RE.test(crm)) {
      return json({ error: 'CRM inválido. Use o formato 12345-UF.' }, 400);
    }

    // Autentica quem chama (sem privilégio elevado). NÃO escreve nada.
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (authErr || !userId) return json({ error: 'Não autenticado.' }, 401);

    // TODO: consultar a base do CFM. Placeholder: devolve "indeterminado".
    // O admin revisa o documento enviado e aprova manualmente no painel.
    const result = {
      crm,
      checkedAt: new Date().toISOString(),
      source: 'placeholder',
      found: null as boolean | null, // null = não foi possível verificar automaticamente
      note: 'Consulta automática ao CFM entra em produção. Sujeito a revisão manual do admin.',
    };
    return json({ ok: true, result }, 200);
  } catch (e) {
    const errorId = crypto.randomUUID();
    logSafeFailure('verify_crm_failed', errorId, { error: e });
    return json({ error: 'Erro interno.', id: errorId }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
