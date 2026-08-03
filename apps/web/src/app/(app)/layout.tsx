'use client';

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
          <main id="conteudo" className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7 xl:px-8">{children}</main>
        </div>
      </div>
    </ProfileProvider>
  );
}
