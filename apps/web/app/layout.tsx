import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans"; // Importujeme z balíčka
import "./globals.css";
import Chatbot from "../components/Chatbot";
import Navbar from "../components/Navbar";
import UatGate from "../components/UatGate";
import ImpersonationBanner from "../components/ImpersonationBanner";

export const metadata: Metadata = {
  title: "PraxiHub",
  description: "Systém pro správu praxe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      {/* className={GeistSans.className} automaticky nastaví font */}
      <body className={GeistSans.className}>
        <ImpersonationBanner />
        <UatGate>
          <Navbar />
          {children}
          <Chatbot />
        </UatGate>
      </body>
    </html>
  );
}
