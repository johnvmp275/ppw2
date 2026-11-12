import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DeliveryNav } from "@/components/modules/delivery/DeliveryNav";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cozinha Delivery",
  description: "PDV e fluxo de pedidos para delivery e cozinha industrial",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: extensões do navegador (ex.: ColorZilla) adicionam atributos no <body> antes do React carregar */}
      <body className="min-h-full flex flex-col bg-muted/40" suppressHydrationWarning>
        <DeliveryNav />
        {children}
        {/* Avisos de sucesso/erro sem trocar de página */}
        <Toaster richColors position="bottom-right" closeButton />

      </body>
    </html>
  );
}
