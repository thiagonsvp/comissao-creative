import type { Metadata } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const fonteInterface = Bricolage_Grotesque({
  variable: '--fonte-interface',
  subsets: ['latin'],
  display: 'swap',
});

const fonteNumeros = JetBrains_Mono({
  variable: '--fonte-numeros',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Controle de Comissão',
  description: 'Controle de comissões, lotes e conferência do financeiro',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${fonteInterface.variable} ${fonteNumeros.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Roda antes da primeira pintura: sem isto a tela pisca clara antes de ficar escura. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var p=localStorage.getItem('tema')||'sistema';" +
              "var s=window.matchMedia('(prefers-color-scheme: dark)').matches;" +
              "document.documentElement.dataset.tema=(p==='escuro'||(p==='sistema'&&s))?'escuro':'claro';" +
              "}catch(e){document.documentElement.dataset.tema='claro';}})();",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
