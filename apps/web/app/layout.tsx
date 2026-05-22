import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans";
import "./globals.css";
import Chatbot from "../components/Chatbot";
import Navbar from "../components/Navbar";
import UatGate from "../components/UatGate";
import ImpersonationBanner from "../components/ImpersonationBanner";
import CommandPalette from "../components/CommandPalette";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "../contexts/AuthContext";

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
    <html lang="cs" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <ImpersonationBanner />
            <UatGate>
              <Navbar />
              <CommandPalette />
              {children}
              <Chatbot />
            </UatGate>
            <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
