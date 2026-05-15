import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link"; // Import essentiel pour la navigation

export const metadata: Metadata = {
  title: "BrandLock IA | Dashboard",
  description: "Système de contrôle de marque par IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-[#F7F8FA] text-slate-900 antialiased font-sans">
        <div className="flex h-screen p-4 gap-4 overflow-hidden">
          
          {/* Sidebar Flottante - Design "Claude/Gemini" */}
          <aside className="w-72 bg-white rounded-[2rem] border border-slate-100 flex flex-col justify-between py-10 px-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <div>
              <div className="mb-12 px-2">
                <Link href="/" className="text-xl font-bold tracking-tighter flex items-center gap-2 group">
                  <div className="w-6 h-6 bg-gradient-to-tr from-orange-500 to-violet-600 rounded-lg shadow-sm group-hover:scale-110 transition-transform"></div>
                  <span>BrandLock<span className="text-slate-300">.</span></span>
                </Link>
              </div>
              
              <nav className="space-y-1">
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-4 px-2">Navigation</p>
                <ul className="space-y-2">
                  <li>
                    <Link 
                      href="/" 
                      className="flex items-center px-4 py-3 text-sm font-medium text-slate-600 hover:bg-orange-50 hover:text-orange-600 rounded-2xl transition-all"
                    >
                      Vue globale
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/brand-kit" 
                      className="flex items-center px-4 py-3 text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-600 rounded-2xl transition-all"
                    >
                      Brand Kits
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href="/generate" 
                      className="flex items-center px-4 py-3 text-sm font-medium text-white bg-slate-900 rounded-2xl shadow-lg shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all mt-6"
                    >
                      Générateur IA
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
            
            {/* Profil Utilisateur en bas */}
            <div className="px-2 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-100 to-violet-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                  FS
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Fabien Sauter</p>
                  <p className="text-[10px] text-slate-400 font-medium italic">Admin</p>
                </div>
              </div>
            </div>
          </aside>

          {/* Zone de contenu principale (Canvas) */}
          <main className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-y-auto">
            <div className="max-w-5xl mx-auto py-16 px-12">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}