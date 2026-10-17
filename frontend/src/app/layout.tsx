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
      <body className={`${inter.className} min-h-screen bg-[#080B12] text-[#e0e2ed] antialiased`}>
        <div className="flex min-h-screen flex-col bg-[#080B12]">
          <Navigation />
          <main className="flex-1 px-3 py-6 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full">
            {children}
          </main>
          <footer className="border-t border-slate-800/80 bg-[#080B12] py-4 text-center text-xs text-slate-500">
            TrustJuggler v2.0 &bull; Continuous Identity &amp; Collusion Shield &bull; Security Operations Center
          </footer>
        </div>
      </body>
    </html>
  );
}
