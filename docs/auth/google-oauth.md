# Login/Cadastro com Google (OAuth)

O **código** já está pronto:
- Rota de callback PKCE: `apps/web/src/app/auth/callback/route.ts` (troca o `code` por sessão e grava cookies).
- Botão "Continuar com Google" no `/login` e "Cadastrar com Google" no `/cadastro`.
- `redirectTo` aponta para `…/auth/callback?next=/dashboard`.
- O `middleware` já libera `/auth` (público), então o callback não é bloqueado.

Falta só **configurar o provedor** (uma vez). Passos:

## 1) Google Cloud Console — criar credenciais OAuth
1. https://console.cloud.google.com → crie/escolha um projeto.
2. **APIs e serviços → Tela de consentimento OAuth**: tipo **Externo**; nome do app "HubPatients"; e-mail de suporte; escopos `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`. Enquanto estiver em "Teste", adicione seu e-mail em **Usuários de teste**.
3. **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**:
   - **Origens JavaScript autorizadas**: `http://localhost:3000` (e depois o domínio de produção).
   - **URIs de redirecionamento autorizados**: cole a URL que o Supabase mostra na tela do provedor Google — é algo como:
     `https://kicbnkzdytfdlnizhczt.supabase.co/auth/v1/callback`
   - Salve e copie o **Client ID** e o **Client Secret**.

## 2) Supabase → Authentication → Providers → Google
- Ative **Google**, cole o **Client ID** e o **Client Secret**, salve.

## 3) Supabase → Authentication → URL Configuration
- **Site URL**: `http://localhost:3000` (em produção, o domínio real).
- **Redirect URLs** (adicione todas):
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/**`
  - (produção) `https://SEU_DOMINIO/auth/callback` e `https://SEU_DOMINIO/**`

## 4) Testar
- Acesse `/login` → "Continuar com Google" → escolha a conta → volta logado em `/dashboard`.
- A trigger `handle_new_user` (0001) cria o profile automaticamente (nome vem do `full_name` do Google; senão "Paciente").

## Notas
- Fluxo é **PKCE** (sem segredos no cliente) — o `code_verifier` fica em cookie e o callback faz a troca no servidor.
- Usuários Google já vêm com e-mail verificado → não precisam confirmar e-mail.
- O botão **gov.br** segue como placeholder (Fase 5).
