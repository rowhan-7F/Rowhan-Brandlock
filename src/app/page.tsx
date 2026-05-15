export default function Home() {
  return (
    <div className="max-w-2xl">
      <header className="mb-12">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 mb-2">Bienvenue.</h1>
        <p className="text-slate-500 text-lg">Votre système BrandLock est prêt pour la production.</p>
      </header>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mb-4">Statut</p>
          <p className="text-3xl font-semibold">Opérationnel</p>
        </div>
        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
          <p className="text-[10px] font-bold text-violet-500 uppercase tracking-[0.2em] mb-4">Moteur</p>
          <p className="text-3xl font-semibold">IA Active</p>
        </div>
      </div>
    </div>
  );
}