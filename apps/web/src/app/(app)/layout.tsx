'use client';

import { useState } from 'react';
import { AppSidebar } from '@/components/app/sidebar';
import { AppTopbar } from '@/components/app/topbar';
import { CaregiverBanner } from '@/components/app/caregiver-banner';
import { ProfileProvider } from '@/components/profile-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ProfileProvider>
      <div className="vl-app-shell flex h-screen overflow-hidden bg-bg text-fg">
        <AppSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar onMenuClick={() => setMobileOpen(true)} />
          <CaregiverBanner />
          <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </ProfileProvider>
  );
}
