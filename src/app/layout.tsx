import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "App Automatiza",
  description: "Dashboard de análisis de rendimiento de bots de llamadas IA",
};

import { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { SkipLink } from "@/components/layout/SkipLink";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('ui-theme');
                const supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (theme !== 'light' && supportDarkMode)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} bg-background text-foreground font-sans antialiased`}>
        {/* Sprint 3 SP-4-WCAG-10: skip-link al inicio del body (WCAG 2.4.1 Bypass Blocks). */}
        <SkipLink />
        <ThemeProvider defaultTheme="system" storageKey="ui-theme">
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
