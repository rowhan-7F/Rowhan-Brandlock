import Link from "next/link";
import { AlertCircle } from "lucide-react";

// ============================================================
//  ErrorScreen - Phase 9.4.2
//  Ecran d'erreur plein ecran (extrait de studio/[projectId]/page.tsx)
// ============================================================
export default function ErrorScreen({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-8">
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 max-w-md text-center">
        <AlertCircle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold mb-2">{title}</h2>
        <p className="text-sm text-neutral-500 mb-4">{message}</p>
        <Link href="/studio" className="text-sm font-medium text-orange-600 hover:text-orange-700">
          ← Retour à mes projets
        </Link>
      </div>
    </div>
  );
}