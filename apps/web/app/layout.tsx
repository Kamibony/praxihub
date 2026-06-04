import type { Metadata } from "next";
import "@fontsource/poppins";
import "./globals.css";
import Chatbot from "../components/Chatbot";
import Navbar from "../components/Navbar";
import ImpersonationBanner from "../components/ImpersonationBanner";
import CommandPalette from "../components/CommandPalette";
import { Toaster } from "react-hot-toast";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "../contexts/AuthContext";
import AppShell from "../components/AppShell";

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
                                                      <AppShell><Navbar /><CommandPalette />{children}</AppShell>
              <Chatbot />
                        <Toaster position="bottom-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
