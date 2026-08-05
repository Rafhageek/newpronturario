'use client';

/**
 * Casca do app autenticado.
 *
 * `hp-clinical-shell` é o que liga a camada "Painel" (globals.css): canvas
 * azul-neutro frio, superfícies brancas, `--hint`/`--line-strong` já corrigidos
 * para AA. Continua valendo tudo o que já existia — Modo Sênior, escala de
 * fonte, alto contraste, tokens de status.
 *
 * A largura máxima do conteúdo (1280px, `layout.contentMaxWidth` em
 * @hubpatients/ui-tokens) mora AQUI e não em cada rota: 49 telas escolhendo a
 * própria largura é como o app ficou com quatro larguras diferentes.
 */

import { useState } from 'react';
import { AppSidebar } from '@/components/app/sidebar';
import { AppTopbar } from '@/components/app/topbar';
import { CaregiverBanner } from '@/components/app/caregiver-banner';
import { ProfileProvider } from '@/components/profile-context';
import { WelcomeSplash } from '@/components/welcome-splash';
import { WhatsNewModal } from '@/components/whats-new-modal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ProfileProvider>
      <WelcomeSplash />
      {/* "O que mudou" — uma vez por versão, some sozinho depois. */}
      <WhatsNewModal />
      <a href="#conteudo" className="vl-skip-link">Pular para o conteúdo</a>
      <div className="hp-clinical-shell vl-app-shell flex h-screen overflow-hidden bg-bg text-fg">
        <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar onMenuClick={() => setMobileOpen(true)} />
          <CaregiverBanner />
          <main id="conteudo" className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ProfileProvider>
  );
}
