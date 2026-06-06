import { redirect } from 'next/navigation';

// O middleware decide: sem sessão -> /login; com sessão -> /dashboard.
export default function HomePage() {
  redirect('/dashboard');
}
