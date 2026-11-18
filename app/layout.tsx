import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/theme";
import { AUTH_PENDING_SCRIPT } from "@/lib/auth-hint";
import { firebaseConfigScript } from "@/lib/config";
import "./globals.css";

// All fonts are self-hosted, so builds never need to reach Google Fonts.
// GeistSans / GeistMono expose --font-geist-sans / --font-geist-mono.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque-Variable.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Greenboard — Tick it off. Watch it get done.",
  description:
    "Greenboard is the joyful task board for ticking off what's done — solo or with your team.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${bricolage.variable} h-full antialiased scroll-smooth`}
      // The scripts below add "dark" (and maybe data-auth-pending) before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Firebase's web settings, chosen on the server by DEBUG (see lib/config.ts), before the app's code runs. */}
        <script dangerouslySetInnerHTML={{ __html: firebaseConfigScript() }} />
        {/* Apply the saved (or device) theme before the first paint, so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* On the landing page, hide it before the first paint if you were signed in, so it doesn't flash before the redirect. */}
        <script dangerouslySetInnerHTML={{ __html: AUTH_PENDING_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
