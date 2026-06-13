import type { Metadata } from "next";
import { Archivo_Black, VT323, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LocationProvider } from "@/lib/geo/LocationProvider";

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const vt323 = VT323({
  variable: "--font-vt323",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resonate",
  description: "Music-anchored 1-on-1 social app for LA's live music scene.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivoBlack.variable} ${vt323.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen">
        <LocationProvider>{children}</LocationProvider>
      </body>
    </html>
  );
}
