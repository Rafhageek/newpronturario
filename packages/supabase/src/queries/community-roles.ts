import type {
  CommunityMember,
  ProfessionalVerification,
  InsertRow,
  Json,
} from '@hubpatients/core';
import type { HubPatientsClient } from '../types';

/** Identidade pública de fórum (badges, tier, reputação) de um usuário. */
export async function getCommunityMember(
  client: HubPatientsClient,
  userId: string,
): Promise<CommunityMember | null> {
  const { data, error } = await client
    .from('community_members')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Último pedido de verificação profissional do usuário (qualquer status). */
export async function getMyVerification(
  client: HubPatientsClient,
  userId: string,
): Promise<ProfessionalVerification | null> {
  const { data, error } = await client
    .from('professional_verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface ProfessionalVerificationInput {
  registryNumber: string;
  registryState: string;
  type?: 'doctor' | 'nurse' | 'nutritionist' | 'psychologist';
  documentPath?: string | null;
  /** Resposta da Edge Function verify-crm (auditoria). */
  verifyResponse?: Json | null;
}

/**
 * Cria o pedido de verificação (status 'pending'). A RLS força user_id próprio
 * e status 'pending'; a aprovação é admin-only (approve_professional_verification).
 */
export async function submitProfessionalVerification(
  client: HubPatientsClient,
  userId: string,
  input: ProfessionalVerificationInput,
): Promise<ProfessionalVerification> {
  const row: InsertRow<'professional_verifications'> = {
    user_id: userId,
    type: input.type ?? 'doctor',
    registry_number: input.registryNumber,
    registry_state: input.registryState.toUpperCase(),
    status: 'pending',
    document_path: input.documentPath ?? null,
    verify_crm_response: input.verifyResponse ?? null,
  };
  const { data, error } = await client
    .from('professional_verifications')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Registra o aceite das regras da comunidade (onboarding). */
export async function acceptCommunityRules(client: HubPatientsClient): Promise<void> {
  const { error } = await client.rpc('accept_community_rules', {});
  if (error) throw error;
}

// ── Perfil público de fórum (SEM dados clínicos, jamais) ──────────────────────

export interface PublicForumProfile {
  userId: string;
  displayName: string;
  bio: string | null;
  memberSince: string;
  staffRole: string | null;
  professionalBadge: string | null;
  professionalRegistry: string | null;
  memberTier: string | null;
  reputationPoints: number;
  topicCount: number;
  usefulCount: number;
}

/**
 * Monta o perfil público a partir de social_profiles (RLS só devolve perfis
 * públicos ou o próprio) + community_members (badges) + contagens. Retorna null
 * quando o perfil é privado/inexistente. NUNCA expõe dado clínico.
 */
export async function getPublicForumProfile(
  client: HubPatientsClient,
  userId: string,
): Promise<PublicForumProfile | null> {
  const { data: social, error } = await client
    .from('social_profiles')
    .select('user_id, display_name, bio, is_public, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!social) return null; // privado (RLS) ou sem perfil

  const { data: member } = await client
    .from('community_members')
    .select('staff_role, professional_badge, professional_registry, member_tier, reputation_points, created_at')
    .eq('user_id', userId)
    .maybeSingle();

  const [{ count: topicCount }, { count: usefulCount }] = await Promise.all([
    client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('is_anonymous', false),
    client
      .from('useful_marks')
      .select('id, post_comments!inner(author_id)', { count: 'exact', head: true })
      .eq('post_comments.author_id', userId),
  ]);

  return {
    userId,
    displayName: social.display_name ?? 'Usuário',
    bio: social.bio,
    memberSince: member?.created_at ?? social.created_at,
    staffRole: member?.staff_role ?? null,
    professionalBadge: member?.professional_badge ?? null,
    professionalRegistry: member?.professional_registry ?? null,
    memberTier: member?.member_tier ?? 'member',
    reputationPoints: member?.reputation_points ?? 0,
    topicCount: topicCount ?? 0,
    usefulCount: usefulCount ?? 0,
  };
}

export interface CommunityDoctor {
  userId: string;
  displayName: string;
  bio: string | null;
  registry: string | null;
  reputationPoints: number;
}

/**
 * "Médicos da comunidade": profissionais com selo 'doctor' que optaram por
 * aparecer publicamente (social_profiles.is_public = true). Sem dado clínico.
 */
export async function listCommunityDoctors(client: HubPatientsClient): Promise<CommunityDoctor[]> {
  const { data: docs, error } = await client
    .from('community_members')
    .select('user_id, professional_registry, reputation_points')
    .eq('professional_badge', 'doctor');
  if (error) throw error;
  const ids = (docs ?? []).map((d) => d.user_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await client
    .from('social_profiles')
    .select('user_id, display_name, bio')
    .in('user_id', ids)
    .eq('is_public', true);

  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return (docs ?? [])
    .filter((d) => byId.has(d.user_id))
    .map((d) => {
      const p = byId.get(d.user_id);
      return {
        userId: d.user_id,
        displayName: p?.display_name ?? 'Médico(a)',
        bio: p?.bio ?? null,
        registry: d.professional_registry,
        reputationPoints: d.reputation_points,
      };
    })
    .sort((a, b) => b.reputationPoints - a.reputationPoints);
}
