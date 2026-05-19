import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandLock IA",
  description: "L'industrialisation de la Direction Artistique",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-neutral-950">
        {children}
      </body>
    </html>
  );
}