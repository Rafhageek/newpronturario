import { AuthHero } from '@/components/auth-hero';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-panel flex min-h-screen bg-white">
      <AuthHero />
      <section className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#f7f9fc] px-5 py-10 sm:px-8 lg:px-10 xl:px-14">
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
        <div className="relative w-full max-w-[560px] rounded-[28px] border border-[#dfe5ef] bg-white px-6 py-8 shadow-[0_24px_70px_-26px_rgba(25,46,84,0.28),0_4px_18px_rgba(25,46,84,0.06)] sm:px-10 sm:py-10 xl:px-12 xl:py-11">
          <div className="mx-auto w-full max-w-[440px]">{children}</div>
        </div>
      </section>
    </main>
  );
}
