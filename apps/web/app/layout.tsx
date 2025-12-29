import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Chatbot from "../components/Chatbot"; // Import

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "PraxiHub",
  description: "Systém pre správu praxe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Chatbot /> {/* Pridané sem */}
      </body>
    </html>
  );
}
