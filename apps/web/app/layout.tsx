import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans";
import "./globals.css";
import Chatbot from "../components/Chatbot";
import Navbar from "../components/Navbar";
import UatGate from "../components/UatGate";
import ImpersonationBanner from "../components/ImpersonationBanner";
import CommandPalette from "../components/CommandPalette";
import { Toaster } from "react-hot-toast";

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
          <CommandPalette />
          {children}
          <Chatbot />
        </UatGate>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
