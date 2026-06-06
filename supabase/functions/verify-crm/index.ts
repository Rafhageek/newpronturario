// ============================================================================
// VidaLog — Edge Function: verify-crm (SELO MÉDICO) — SCAFFOLD
//
// Verificaria o CRM contra a base do CFM e marcaria social_profiles.verified_crm.
// Não há API pública oficial estável do CFM aqui — este é um GANCHO/placeholder.
// Para produção: integrar com o portal do CFM (consulta de CRM) e validar nome.
//
// Deploy: supabase functions deploy verify-crm
// ============================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { crm } = await req.json();
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return json({ error: 'Não autenticado.' }, 401);

    // TODO: consultar a base do CFM. Por ora, placeholder: não verifica.
    const verified = false;
    if (verified) {
      await supabase.from('social_profiles').update({ verified_crm: true, crm }).eq('user_id', userId);
    }
    return json({ verified, note: 'Verificação de CRM contra o CFM entra em produção (placeholder).' }, 200);
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
