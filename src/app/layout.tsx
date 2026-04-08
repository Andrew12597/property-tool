import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Property Tool",
  description: "Development feasibility & property research",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full bg-gray-50`}>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 py-4 sm:py-8 pb-24 sm:pb-8">{children}</main>
      </body>
    </html>
  );
}
