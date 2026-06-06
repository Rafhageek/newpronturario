import { AuthHero } from '@/components/auth-hero';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-white">
      <AuthHero />
      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">{children}</div>
      </section>
    </main>
  );
}
