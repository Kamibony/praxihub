import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans"; // Importujeme z balíčka
import "./globals.css";
import Chatbot from "../components/Chatbot";

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
        {children}
        <Chatbot />
      </body>
    </html>
  );
}
