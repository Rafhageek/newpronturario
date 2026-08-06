'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, Copy, Check, KeyRound, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  useHubPatientsClient,
  useMyTokens,
  useCreateToken,
  useRevokeToken,
  useHasAiAssistant,
  PatMfaRequiredError,
} from '@hubpatients/supabase';
import { AI_TOKEN_SCOPES, AI_ACCESS_DISCLAIMER } from '@hubpatients/core';
import { useAuth } from '@/components/auth-provider';
import { AiDisclosure } from '@/components/ai/ai-disclosure';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/ui/skeleton';

export default function AcessoIaPage() {
  const { user } = useAuth();
  const supabase = useHubPatientsClient();
  const userId = user?.id ?? '';
  const { data: tokens, isLoading } = useMyTokens(user?.id);
  const { data: eligible } = useHasAiAssistant(user?.id);
  const create = useCreateToken(userId);
  const revoke = useRevokeToken(userId);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [scopes, setScopes] = useState<string[]>(['read:profile', 'read:medications']);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(key: string) {
    setScopes((s) => (s.includes(key) ? s.filter((x) => x !== key) : [...s, key]));
  }

  async function onGenerate() {
    if (!name.trim() || scopes.length === 0) {
      toast.error('Dê um nome e marque ao menos um escopo.');
      return;
    }
    if (!password) {
      toast.error('Confirme sua senha (segunda etapa).');
      return;
    }
    setBusy(true);
    try {
      const email = user?.email;
      if (!email) {
        toast.error('Sessão inválida. Entre novamente.');
        return;
      }
      const reauth = await supabase.auth.signInWithPassword({ email, password });
      if (reauth.error) {
        toast.error('Não foi possível confirmar sua identidade.');
        return;
      }
      const token = await create.mutateAsync({
        name: name.trim(),
        scopes,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      });
      setGenerated(token);
      setName('');
      setPassword('');
      toast.success('Token gerado! Copie agora — ele não aparece de novo.');
    } catch (error) {
      toast.error(
        error instanceof PatMfaRequiredError
          ? 'Ative ou conclua a verificação em duas etapas (2FA) e tente novamente.'
          : 'Não foi possível gerar o token.',
      );
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!generated) return;
    void navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const active = (tokens ?? []).filter(
    (t) => !t.revoked_at && Boolean(t.expires_at) && new Date(t.expires_at as string) > new Date(),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5 hp-page hp-page--privacy">
      <Link href="/configuracoes" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Configurações
      </Link>

      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-primary">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-display)' }}>
            Acesso de IA ao prontuário
          </h1>
          <p className="text-sm text-muted">
            Gere um token para seu assistente de IA ler seus dados — sem compartilhar login/senha.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-fg-soft">{AI_ACCESS_DISCLAIMER}</p>
      </div>

      {/* Disclosure de IA (CFM 2.454/2026): tudo que o assistente responder a
          partir daqui é apoio de IA — com direito de recusa a qualquer momento. */}
      <AiDisclosure
        taskType="record_access"
        sources={['Seus dados de prontuário, restritos aos escopos marcados abaixo']}
        note="Um token dá ao seu assistente de IA acesso de LEITURA ao seu prontuário. Tudo que ele responder a partir desses dados é apoio de IA — estimativa educativa, nunca diagnóstico. O modelo e a versão de prompt dependem do assistente que você conectar e, por isso, não são registrados pelo HubPatients."
      />

      {eligible != null && (
        <p className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${eligible ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-surface-2 text-muted'}`}>
          <Sparkles className="h-3.5 w-3.5" />
          {eligible
            ? 'Assistente de IA habilitado (Plus ou compartilhamento de dados ativo).'
            : 'O assistente de IA no app é do Plus ou de quem compartilha dados — mas você já pode gerar tokens de leitura.'}
        </p>
      )}

      {/* Token recém-gerado (mostrado UMA vez) */}
      {generated && (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] p-4">
          <p className="text-sm font-semibold text-fg">Seu novo token (copie agora!)</p>
          <p className="mt-1 text-xs text-muted">Por segurança, ele não será exibido novamente.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-surface px-3 py-2 text-xs text-fg">{generated}</code>
            <button onClick={copy} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-fg-soft hover:bg-surface-2">
              {copied ? <Check className="h-3.5 w-3.5 text-status-ok-ink" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {/* Gerar token */}
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-fg">Gerar novo token</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome (ex.: Meu Claude)"
          className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-sky-400/50 focus:outline-none"
        />
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Escopos (somente leitura)</p>
          <div className="space-y-1.5">
            {AI_TOKEN_SCOPES.map((s) => (
              <label key={s.key} className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={scopes.includes(s.key)}
                  onChange={() => toggleScope(s.key)}
                  className="mt-0.5 h-5 w-5 rounded"
                />
                <span className="text-sm text-fg">
                  {s.label}
                  <span className="block text-[11px] text-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Confirme sua senha (segunda etapa)</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Sua senha"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <button
          onClick={onGenerate}
          disabled={busy}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" /> {busy ? 'Gerando…' : 'Gerar token'}
        </button>
        <p className="text-[11px] text-faint">
          Endpoint: <code>GET /api/v1/me</code> com <code>Authorization: Bearer &lt;token&gt;</code>. Expira em 90 dias.
        </p>
      </section>

      {/* Tokens ativos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Tokens ativos</h2>
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">
            Nenhum token ativo.
          </p>
        ) : (
          <ul className="divide-y divide-line/60 rounded-2xl border border-line bg-surface">
            {active.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{t.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted">{t.token_prefix}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.scopes.map((sc) => (
                      <Badge key={sc} tone="info">{sc.replace('read:', '')}</Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    {t.last_used_at ? `Usado ${new Date(t.last_used_at).toLocaleDateString('pt-BR')}` : 'Nunca usado'}
                    {' · '}
                    {t.expires_at
                      ? `Expira ${new Date(t.expires_at).toLocaleDateString('pt-BR')}`
                      : 'Requer rotação'}
                  </p>
                </div>
                <button
                  onClick={() => revoke.mutate(t.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Revogar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
