import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Compass — Guided Path for Vibe Coders | Vibe Space",
  description:
    "Reduce overwhelm and navigate the vibe coding journey with clarity. Compass guides you from ideation to deployment with opinionated paths and debt visibility.",
  openGraph: {
    title: "Compass — Guided Path for Vibe Coders | Vibe Space",
    description:
      "Navigate the vibe coding journey with clarity. From ideation to deployment, Compass guides your next move.",
    siteName: "Vibe Space",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-mono min-h-screen min-h-[100dvh] bg-black text-[var(--accent)] flex flex-col overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
