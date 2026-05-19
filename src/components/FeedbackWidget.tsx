"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { MessageCircle, X, Send, Bug, Check } from "lucide-react";

type Props = {
  pageOrigin?: string;
};

export default function FeedbackWidget({ pageOrigin = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Tu dois être connecté pour envoyer un feedback.");
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ message: trimmed, page_origin: pageOrigin })
      });
      if (res.ok) {
        setSuccess(true);
        setMessage("");
        setTimeout(() => {
          setOpen(false);
          setTimeout(() => setSuccess(false), 250);
        }, 2200);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erreur d'envoi. Réessaye dans un instant.");
      }
    } catch (err: any) {
      alert("Erreur : " + (err.message || "inconnue"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Signaler un bug ou donner ton avis"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-orange-500 text-white shadow-2xl shadow-orange-500/30 hover:scale-110 active:scale-95 transition-all flex items-center justify-center group"
      >
        <Bug size={22} />
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Bug / Feedback
        </span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {success ? (
              <div className="text-center py-8 space-y-4">
                <div className="w-20 h-20 mx-auto rounded-3xl bg-green-100 flex items-center justify-center">
                  <Check size={36} className="text-green-600" />
                </div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Merci !</h3>
                <p className="text-sm text-neutral-500 font-medium">
                  Ton message a été envoyé à l&apos;équipe BrandLock.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                      <MessageCircle size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black italic uppercase tracking-tighter leading-tight">Bug ou Feedback ?</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mt-0.5">
                        Direct vers l&apos;équipe BrandLock
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="p-2 rounded-xl hover:bg-neutral-100 transition-all shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>

                <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                  Décris ce qui ne va pas, suggère une amélioration, ou partage ton ressenti. On lit tout et on revient vers toi par email si besoin.
                </p>

                <div className="space-y-2">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder="Ex : impossible d'uploader une image, la slide stat ne s'affiche pas en aperçu, j'aimerais bien avoir [X]..."
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:border-orange-500 text-sm resize-none h-36"
                  />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-right">
                    {message.length}/2000
                  </p>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !message.trim()}
                  className="w-full bg-orange-500 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Send size={14} />
                  {submitting ? "Envoi..." : "Envoyer à l'admin"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
