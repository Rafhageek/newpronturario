import type { Metadata, Viewport } from 'next';
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
} from 'next/font/google';
import { Providers } from '@/components/providers';
import { AppToaster } from '@/components/ui/app-toaster';
import './globals.css';

/**
 * Atkinson Hyperlegible Next — texto de interface.
 *
 * Isto NÃO é escolha estética: é segurança de dose. A família foi desenhada pelo
 * Braille Institute para leitores de baixa visão e um dos seus princípios
 * declarados é distinguir EXPLICITAMENTE os pares que mais se confundem num
 * prontuário — 1 / I / l e 0 / O. Ler "l mg" no lugar de "1 mg", ou "1O" no
 * lugar de "10", é erro de medicação, não erro de tipografia.
 *
 * Nossa display (Bricolage Grotesque) tem "1" sem base e "I" sem serifa, quase
 * idênticos — por isso ela fica restrita a título grande, nunca a número.
 * https://www.brailleinstitute.org/freefont/
 */
const sans = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-atkinson',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

/**
 * Atkinson Hyperlegible Mono — TODO número clínico (dose, exame, pressão, peso).
 * A largura fixa é propriedade do desenho: o dígito não "dança" quando o valor
 * atualiza, e a comparação vertical de uma coluna de valores fica alinhada.
 */
const mono = Atkinson_Hyperlegible_Mono({
  subsets: ['latin'],
  variable: '--font-atkinson-mono',
  display: 'swap',
  weight: ['500', '700'],
});

/** Display — só em título ≥20px. Nunca em corpo de texto e nunca em número. */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'HubPatients — Seu prontuário pessoal de saúde',
  description:
    'Você é dono dos seus dados de saúde. Organize medicamentos, exames e sinais vitais com segurança.',
};

/**
 * A cor da barra do navegador acompanha o canvas ("papel clínico quente"), não a
 * cor da marca — assim a moldura do sistema não briga com a página.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0d' },
  ],
};

/**
 * Aplica preferências de acessibilidade (escala de fonte / alto contraste) antes
 * da pintura, evitando flash. Lê o localStorage que o AccessibilityProvider grava.
 */
const A11Y_INIT = `(function(){try{var d=document.documentElement;var f=localStorage.getItem('vl-font-scale');if(f&&f!=='normal')d.setAttribute('data-font-scale',f);var c=localStorage.getItem('vl-contrast');if(c==='high')d.setAttribute('data-contrast','high');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <AppToaster />
      </body>
    </html>
  );
}
