import { AuthHero } from '@/components/auth-hero';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-panel flex min-h-dvh bg-white">
      <AuthHero />
      <section className="relative flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-[#f7f9fc] px-4 py-6 sm:px-8 sm:py-8 lg:px-9 xl:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(circle at 92% 8%, rgba(4,66,191,0.08), transparent 30%), radial-gradient(circle at 8% 92%, rgba(13,146,152,0.06), transparent 28%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(98,115,145,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(98,115,145,0.09) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'linear-gradient(to bottom, black, transparent 72%)',
          }}
        />
        <div className="relative w-full max-w-[520px] rounded-[24px] border border-[#dfe5ef] bg-white px-5 py-7 shadow-[0_24px_70px_-30px_rgba(25,46,84,0.30),0_4px_18px_rgba(25,46,84,0.06)] sm:px-9 sm:py-9 xl:px-10">
          <div className="mx-auto w-full max-w-[420px]">{children}</div>
        </div>
      </section>
    </main>
  );
}
