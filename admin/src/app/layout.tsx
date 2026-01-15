import type { Metadata } from "next";
import { MainLayout } from "@/components/MainLayout";
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZapBot Admin",
  description: "Painel Administrativo da Secretária Virtual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-slate-950 text-slate-50`}>
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}
