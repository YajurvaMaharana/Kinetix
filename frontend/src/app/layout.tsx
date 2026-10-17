import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TrustJuggler v2 — Continuous Behavioral Trust & Risk Engine",
  description: "Next-generation rideshare security, device passporting, fraud ring detection, and payout safety.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-slate-100 antialiased`}>
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <main className="flex-1 px-4 py-8 sm:px-6 md:px-8 max-w-7xl mx-auto w-full">
            {children}
          </main>
          <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
            TrustJuggler v2.0 &bull; Continuous Identity &amp; Collusion Shield &bull; Internal Platform
          </footer>
        </div>
      </body>
    </html>
  );
}
