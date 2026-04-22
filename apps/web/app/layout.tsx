import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans";
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
      <body>
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
