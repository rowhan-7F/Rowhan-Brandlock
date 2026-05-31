import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Rowhan · Brand Governance",
  description: "Le verrou de conformité pour vos contenus numériques. Édition institutionnelle suisse.",
  icons: { icon: "/media/logo-favicon.gif" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Bande gradient aurora animee en haut */}
        <div className="aurora-top-band" aria-hidden="true" />
        {children}

        {/* ⭐ TOASTER LUXURY — Position top-right, animations fluides */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand={false}
          visibleToasts={4}
          toastOptions={{
            style: {
              fontFamily: "var(--font-geist-sans)",
              fontSize: "13px",
            },
            className: "luxury-toast",
            duration: 4000,
          }}
        />
      </body>
    </html>
  );
}
