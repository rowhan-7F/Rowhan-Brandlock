"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  Upload, Folder, Star, Trash2, X, Search,
  AlertCircle, FileImage, Loader2, Download
} from "lucide-react";
import JSZip from "jszip";

type BrandImage = {
  id: string;
  client_email: string;
  brand_name: string;
  storage_path: string;
  public_url: string;
  thumbnail_url: string;
  filename: string;
  width: number;
  height: number;
  size_bytes: number;
  batch_name: string;
  description: string | null;
  tags: string[];
  mood: string | null;
  quality_score: number | null;
  has_faces: boolean;
  face_release_validated: boolean;
  focal_point_x: number;
  focal_point_y: number;
  dominant_colors: string[];
  is_style_reference: boolean;
  source: string;
  uploaded_at: string;
};

type Props = {
  clientEmail: string;
  brandName: string;
  editingId: string | null;
  isDarkMode?: boolean;
};

export default function BrandLibrarySection({ clientEmail, brandName, editingId, isDarkMode = false }: Props) {
  const [photos, setPhotos] = useState<BrandImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [detailPhoto, setDetailPhoto] = useState<BrandImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeBatch, setActiveBatch] = useState<string>('all');
  const [showRefsOnly, setShowRefsOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState({ done: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // === THEME : palette qui s'adapte selon isDarkMode ===
  const t = isDarkMode ? {
    cardBg: 'bg-neutral-900',
    cardBorder: 'border-neutral-800',
    statBarBg: 'bg-neutral-900',
    statBarBorder: 'border-neutral-800',
    inputBg: 'bg-neutral-950',
    inputBorder: 'border-neutral-800',
    inputText: 'text-neutral-100',
    textPrimary: 'text-neutral-100',
    textSecondary: 'text-neutral-400',
    textMuted: 'text-neutral-500',
    modalBg: 'bg-neutral-900',
    modalImageBg: 'bg-neutral-950',
    hoverBg: 'hover:bg-neutral-800',
    dashedBorder: 'border-neutral-800',
    dashedHover: 'hover:border-orange-500 hover:bg-orange-950/20',
    iconMuted: 'text-neutral-600',
    badgeBg: 'bg-neutral-800',
    thumbBg: 'bg-neutral-900',
    btnSecondary: 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-orange-500 hover:text-orange-400',
    refsBtnInactive: 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-yellow-500',
    warningBg: 'bg-orange-950/30',
    warningBorder: 'border-orange-900/50',
    warningText: 'text-orange-300',
    warningTextStrong: 'text-orange-200',
    errorBg: 'bg-red-950/30',
    errorBorder: 'border-red-900/50',
    errorText: 'text-red-300',
    deleteBtnBg: 'bg-red-950/30 text-red-400 hover:bg-red-950/50',
    progressBg: 'bg-neutral-800',
    selectedFilesBg: 'bg-orange-950/30 border-orange-900/50',
    selectedFilesText: 'text-orange-400',
    fileItemText: 'text-neutral-300',
    referenceBtnInactive: 'bg-neutral-800 text-neutral-300 hover:bg-yellow-500/20',
  } : {
    cardBg: 'bg-white',
    cardBorder: 'border-neutral-100',
    statBarBg: 'bg-neutral-50',
    statBarBorder: 'border-neutral-100',
    inputBg: 'bg-white',
    inputBorder: 'border-neutral-100',
    inputText: 'text-neutral-900',
    textPrimary: 'text-neutral-900',
    textSecondary: 'text-neutral-500',
    textMuted: 'text-neutral-400',
    modalBg: 'bg-white',
    modalImageBg: 'bg-neutral-100',
    hoverBg: 'hover:bg-neutral-100',
    dashedBorder: 'border-neutral-200',
    dashedHover: 'hover:border-orange-300 hover:bg-orange-50',
    iconMuted: 'text-neutral-400',
    badgeBg: 'bg-neutral-100',
    thumbBg: 'bg-neutral-100',
    btnSecondary: 'bg-white border-neutral-200 text-neutral-700 hover:border-orange-300 hover:text-orange-600',
    refsBtnInactive: 'bg-white text-neutral-500 border-neutral-100 hover:border-yellow-300',
    warningBg: 'bg-orange-50',
    warningBorder: 'border-orange-100',
    warningText: 'text-orange-700',
    warningTextStrong: 'text-orange-600',
    errorBg: 'bg-red-50',
    errorBorder: 'border-red-100',
    errorText: 'text-red-700',
    deleteBtnBg: 'bg-red-50 text-red-600 hover:bg-red-100',
    progressBg: 'bg-neutral-100',
    selectedFilesBg: 'bg-orange-50 border-orange-100',
    selectedFilesText: 'text-orange-600',
    fileItemText: 'text-neutral-600',
    referenceBtnInactive: 'bg-neutral-100 text-neutral-700 hover:bg-yellow-50',
  };

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
  }, []);

  useEffect(() => {
    if (editingId && clientEmail) {
      fetchPhotos();
    }
  }, [editingId, clientEmail]);

  const fetchPhotos = async () => {
    if (!clientEmail) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('brand_images')
      .select('*')
      .ilike('client_email', clientEmail)
      .order('uploaded_at', { ascending: false });
    if (error) console.error('Erreur fetch photos:', error);
    else if (data) setPhotos(data as BrandImage[]);
    setLoading(false);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      alert('Aucune image trouvée dans la sélection.');
      return;
    }
    setSelectedFiles(files);
    if (!batchName.trim()) {
      const folder = (e.target as any).webkitdirectory && files[0]
        ? files[0].webkitRelativePath?.split('/')[0]
        : '';
      if (folder) setBatchName(folder);
    }
  };

  const startUpload = async () => {
    if (!selectedFiles.length) return;
    if (!batchName.trim()) {
      alert('Donne un nom au batch avant de lancer.');
      return;
    }

    setUploading(true);
    setUploadProgress({ done: 0, total: selectedFiles.length, failed: 0 });

    const CHUNK = 3;
    let done = 0, failed = 0;

    for (let i = 0; i < selectedFiles.length; i += CHUNK) {
      const chunk = selectedFiles.slice(i, i + CHUNK);
      const formData = new FormData();
      formData.append('client_email', clientEmail);
      formData.append('brand_name', brandName);
      formData.append('batch_name', batchName.trim());
      for (const f of chunk) formData.append('files', f);

      try {
        const res = await fetch('/api/library/upload', { method: 'POST', body: formData });
        const data = await res.json();
        done += data.uploaded || 0;
        failed += data.failed || 0;
      } catch {
        failed += chunk.length;
      }
      setUploadProgress({ done, total: selectedFiles.length, failed });
    }

    setUploading(false);
    await fetchPhotos();
    setSelectedFiles([]);
    setBatchName('');
    setUploadModalOpen(false);
    alert(`Upload terminé : ${done} OK / ${failed} échec(s)`);
  };

  const toggleReference = async (photo: BrandImage) => {
    const newValue = !photo.is_style_reference;
    await supabase.from('brand_images').update({ is_style_reference: newValue }).eq('id', photo.id);
    setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_style_reference: newValue } : p));
    if (detailPhoto?.id === photo.id) setDetailPhoto({ ...photo, is_style_reference: newValue });
  };

  const deletePhoto = async (photo: BrandImage) => {
    if (!window.confirm(`Supprimer "${photo.filename}" définitivement ?`)) return;
    const thumbPath = photo.storage_path.replace(/\/([^/]+)$/, '/thumbs/$1');
    await supabase.storage.from('brand-libraries').remove([photo.storage_path, thumbPath]);
    await supabase.from('brand_images').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    if (detailPhoto?.id === photo.id) setDetailPhoto(null);
  };

  const exportLibrary = async () => {
    if (photos.length === 0) {
      alert('Médias vides, rien à exporter.');
      return;
    }
    if (photos.length > 200) {
      if (!window.confirm(`Tu as ${photos.length} photos. L'export peut prendre plusieurs minutes. Continuer ?`)) {
        return;
      }
    }

    setExporting(true);
    setExportProgress({ done: 0, total: photos.length });

    try {
      const zip = new JSZip();
      const csvRows = [
        ['Filename', 'Batch', 'Description', 'Tags', 'Mood', 'Qualité', 'Visages', 'Dimensions', 'Taille (Ko)', 'Source', 'Date upload', 'Référence stylistique']
          .map(h => `"${h}"`).join(',')
      ];

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          const res = await fetch(photo.public_url);
          const blob = await res.blob();
          const batchSlug = (photo.batch_name || 'sans-batch')
            .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sans-batch';
          const safeFilename = (photo.filename || `photo-${photo.id}.jpg`).replace(/[^\w.-]/g, '_');
          zip.file(`photos/${batchSlug}/${safeFilename}`, blob);

          const row = [
            photo.filename || '',
            photo.batch_name || '',
            photo.description || '',
            (photo.tags || []).join('; '),
            photo.mood || '',
            photo.quality_score ?? '',
            photo.has_faces ? 'Oui' : 'Non',
            `${photo.width}x${photo.height}`,
            Math.round((photo.size_bytes || 0) / 1024),
            photo.source || '',
            photo.uploaded_at ? new Date(photo.uploaded_at).toLocaleDateString('fr-FR') : '',
            photo.is_style_reference ? 'Oui' : 'Non'
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
          csvRows.push(row);
        } catch (err) {
          console.warn(`Skip photo ${photo.filename}:`, err);
        }
        setExportProgress({ done: i + 1, total: photos.length });
      }

      const csv = '\ufeff' + csvRows.join('\n');
      zip.file('metadata.csv', csv);

      const readme = `BIBLIOTHÈQUE VISUELLE — ${brandName || 'Brand'}
Export du ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}

Contenu :
- ${photos.length} photos au format web (max 2400px, JPEG 85%)
- metadata.csv avec descriptions IA, tags, qualité, etc.
- Photos organisées dans des sous-dossiers par batch

Note : les images sont compressées pour l'usage web. Les originaux haute résolution restent dans tes archives.
`;
      zip.file('LISEZ-MOI.txt', readme);

      const finalBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bibliotheque-${(brandName || 'brand').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      alert(`Export terminé : ${photos.length} photos + metadata.csv dans le ZIP.`);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Erreur export : ' + err.message);
    } finally {
      setExporting(false);
      setExportProgress({ done: 0, total: 0 });
    }
  };

  const totalSize = photos.reduce((s, p) => s + (p.size_bytes || 0), 0);
  const refCount = photos.filter(p => p.is_style_reference).length;
  const allBatches = Array.from(new Set(photos.map(p => p.batch_name).filter(Boolean)));

  const filteredPhotos = photos.filter(p => {
    if (showRefsOnly && !p.is_style_reference) return false;
    if (activeBatch !== 'all' && p.batch_name !== activeBatch) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inDesc = (p.description || '').toLowerCase().includes(q);
      const inTags = (p.tags || []).some(tag => tag.toLowerCase().includes(q));
      const inBatch = (p.batch_name || '').toLowerCase().includes(q);
      const inFilename = (p.filename || '').toLowerCase().includes(q);
      if (!inDesc && !inTags && !inBatch && !inFilename) return false;
    }
    return true;
  });

  if (!editingId) {
    return (
      <div className={`text-center py-8 px-4 ${t.warningBg} border ${t.warningBorder} rounded-2xl space-y-2`}>
        <FileImage size={32} className={`mx-auto ${t.warningTextStrong}`} />
        <p className={`text-sm font-bold ${t.warningText}`}>Médias indisponibles pendant la création</p>
        <p className={`text-[10px] ${t.warningTextStrong}`}>Enregistre d&apos;abord le client (bouton en bas), tu pourras ensuite uploader ses médias.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Stats bar */}
      <div className={`flex items-center justify-between flex-wrap gap-3 p-4 ${t.statBarBg} rounded-2xl border ${t.statBarBorder}`}>
        <div className={`flex items-center gap-6 text-xs ${t.textPrimary}`}>
          <div>
            <p className="font-black text-lg">{photos.length}</p>
            <p className={`text-[9px] ${t.textMuted} uppercase tracking-widest`}>Photos</p>
          </div>
          <div>
            <p className="font-black text-lg">{allBatches.length}</p>
            <p className={`text-[9px] ${t.textMuted} uppercase tracking-widest`}>Batches</p>
          </div>
          <div>
            <p className="font-black text-lg">{refCount}</p>
            <p className={`text-[9px] ${t.textMuted} uppercase tracking-widest`}>⭐ Références</p>
          </div>
          <div>
            <p className="font-black text-lg">{(totalSize / 1024 / 1024).toFixed(1)} <span className="text-xs">Mo</span></p>
            <p className={`text-[9px] ${t.textMuted} uppercase tracking-widest`}>Stockage</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportLibrary}
            disabled={exporting || photos.length === 0}
            className={`px-4 py-3 ${t.btnSecondary} border rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2`}
            title="Télécharger toutes les photos + metadata.csv en ZIP"
          >
            {exporting ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {exportProgress.done}/{exportProgress.total}
              </>
            ) : (
              <>
                <Download size={12} /> Exporter
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="px-5 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-orange-600 flex items-center gap-2"
          >
            <Upload size={12} /> Nouveau batch
          </button>
        </div>
      </div>

      {/* Search + filters */}
      {photos.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.textMuted}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher (tags, description...)"
              className={`w-full pl-9 pr-4 py-2.5 ${t.inputBg} ${t.inputText} border ${t.inputBorder} rounded-xl text-xs outline-none focus:border-orange-500`}
            />
          </div>
          <select
            value={activeBatch}
            onChange={(e) => setActiveBatch(e.target.value)}
            className={`px-3 py-2.5 ${t.inputBg} ${t.inputText} border ${t.inputBorder} rounded-xl text-xs outline-none focus:border-orange-500 cursor-pointer`}
          >
            <option value="all">Tous les batches</option>
            {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button
            type="button"
            onClick={() => setShowRefsOnly(!showRefsOnly)}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1 ${showRefsOnly ? 'bg-yellow-400 text-white border-yellow-400' : t.refsBtnInactive}`}
          >
            <Star size={12} fill={showRefsOnly ? 'white' : 'none'} /> Références
          </button>
        </div>
      )}

      {/* Grid or empty state */}
      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="animate-spin mx-auto text-orange-500" size={32} />
          <p className={`text-xs ${t.textMuted} mt-2 uppercase tracking-widest font-bold`}>Chargement...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        photos.length === 0 ? (
          <div className={`py-12 text-center space-y-4 border-2 border-dashed ${t.dashedBorder} rounded-2xl`}>
            <FileImage size={48} className={`mx-auto ${t.iconMuted}`} />
            <div>
              <p className={`text-sm font-bold ${t.textSecondary}`}>Aucune photo dans les médias</p>
              <p className={`text-[10px] ${t.textMuted} mt-1`}>Uploade un premier batch pour démarrer</p>
            </div>
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="px-5 py-3 bg-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-orange-600 inline-flex items-center gap-2"
            >
              <Upload size={12} /> Uploader des photos
            </button>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className={`text-xs ${t.textMuted}`}>Aucune photo ne correspond aux filtres.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredPhotos.map(photo => (
            <div
              key={photo.id}
              className={`relative aspect-square rounded-xl overflow-hidden ${t.thumbBg} group cursor-pointer border ${t.cardBorder}`}
              onClick={() => setDetailPhoto(photo)}
            >
              <img
                src={photo.thumbnail_url}
                alt={photo.description || ''}
                className="w-full h-full object-cover"
                loading="lazy"
              />

              <div className="absolute top-2 left-2 flex flex-col gap-1">
                {photo.is_style_reference && (
                  <span className="bg-yellow-400 text-white p-1.5 rounded-full shadow-md">
                    <Star size={10} fill="white" />
                  </span>
                )}
                {photo.has_faces && !photo.face_release_validated && (
                  <span className="bg-red-500 text-white p-1.5 rounded-full shadow-md" title="Visages détectés — vérifier release">
                    <AlertCircle size={10} />
                  </span>
                )}
              </div>

              {photo.quality_score && (
                <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                  {photo.quality_score}/10
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                <p className="text-white text-[9px] font-bold line-clamp-2 leading-tight">{photo.description}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {(photo.tags || []).slice(0, 3).map(tag => (
                    <span key={tag} className="text-[8px] text-white/80 bg-white/20 px-1.5 py-0.5 rounded-md">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleReference(photo); }}
                  className={`p-2 rounded-lg shadow-md transition-all ${photo.is_style_reference ? 'bg-yellow-400 text-white' : 'bg-white text-neutral-700 hover:bg-yellow-50'}`}
                  title={photo.is_style_reference ? 'Retirer des références' : 'Marquer comme référence'}
                >
                  <Star size={12} fill={photo.is_style_reference ? 'white' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deletePhoto(photo); }}
                  className="p-2 rounded-lg bg-white text-red-500 hover:bg-red-50 shadow-md"
                  title="Supprimer"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === MODAL UPLOAD === */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => !uploading && setUploadModalOpen(false)}
        >
          <div
            className={`${t.modalBg} ${t.textPrimary} rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl space-y-6`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black italic uppercase tracking-tighter">Nouveau batch</h3>
                <p className={`text-xs ${t.textMuted} mt-1`}>Compression + tagging IA automatique pour chaque photo</p>
              </div>
              {!uploading && (
                <button onClick={() => setUploadModalOpen(false)} className={`p-2 ${t.hoverBg} rounded-xl`}>
                  <X size={20} />
                </button>
              )}
            </div>

            {!uploading ? (
              <>
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase opacity-50 px-2 ${t.textPrimary}`}>Nom du batch</label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder="ex : Event 2026 Watches & Wonders"
                    className={`w-full p-4 ${t.inputBg} ${t.inputText} border ${t.inputBorder} rounded-2xl text-sm outline-none focus:border-orange-500`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-6 border-2 border-dashed ${t.dashedBorder} ${t.dashedHover} rounded-2xl transition-all text-center space-y-2`}
                  >
                    <FileImage size={24} className={`mx-auto ${t.iconMuted}`} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Choisir des fichiers</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className={`p-6 border-2 border-dashed ${t.dashedBorder} ${t.dashedHover} rounded-2xl transition-all text-center space-y-2`}
                  >
                    <Folder size={24} className={`mx-auto ${t.iconMuted}`} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Choisir un dossier</p>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFilesSelected}
                  className="hidden"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                {selectedFiles.length > 0 && (
                  <div className={`${t.selectedFilesBg} border rounded-2xl p-4 space-y-1 max-h-48 overflow-y-auto`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.selectedFilesText} mb-2`}>
                      {selectedFiles.length} fichier(s) sélectionné(s)
                    </p>
                    {selectedFiles.slice(0, 5).map((f, i) => (
                      <p key={i} className={`text-xs ${t.fileItemText} truncate`}>{f.name}</p>
                    ))}
                    {selectedFiles.length > 5 && (
                      <p className={`text-[10px] ${t.textMuted} italic`}>... et {selectedFiles.length - 5} autres</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={startUpload}
                  disabled={!selectedFiles.length || !batchName.trim()}
                  className="w-full py-4 bg-orange-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-md hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lancer l&apos;upload ({selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''})
                </button>
                <p className={`text-[10px] ${t.textMuted} text-center`}>
                  Compression auto à 2400px / JPEG 85. Tagging IA ~5s par photo.
                </p>
              </>
            ) : (
              <div className="space-y-4 py-6">
                <Loader2 className="animate-spin mx-auto text-orange-500" size={40} />
                <p className="text-center font-black uppercase tracking-widest text-sm">
                  Upload en cours...
                </p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>{uploadProgress.done} / {uploadProgress.total} traitées</span>
                    {uploadProgress.failed > 0 && <span className="text-red-500">{uploadProgress.failed} échec(s)</span>}
                  </div>
                  <div className={`h-2 ${t.progressBg} rounded-full overflow-hidden`}>
                    <div
                      className="h-full bg-orange-500 transition-all"
                      style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <p className={`text-[10px] ${t.textMuted} text-center`}>Ne ferme pas cette fenêtre.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MODAL DÉTAIL === */}
      {detailPhoto && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setDetailPhoto(null)}
        >
          <div
            className={`${t.modalBg} ${t.textPrimary} rounded-[2.5rem] max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`${t.modalImageBg} flex items-center justify-center min-h-[400px]`}>
              <img src={detailPhoto.public_url} alt="" className="max-w-full max-h-[80vh] object-contain" />
            </div>

            <div className="p-8 space-y-5 overflow-y-auto">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-black italic uppercase tracking-tighter">Détail</h3>
                <button onClick={() => setDetailPhoto(null)} className={`p-2 ${t.hoverBg} rounded-xl`}>
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Description IA</p>
                  <p className="text-sm font-medium mt-1">{detailPhoto.description || '—'}</p>
                </div>

                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Tags</p>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {(detailPhoto.tags || []).map(tag => (
                      <span key={tag} className={`text-[10px] font-bold ${t.badgeBg} px-2 py-1 rounded-md`}>{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Mood</p>
                    <p className="font-bold mt-1 capitalize">{detailPhoto.mood || '—'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Qualité</p>
                    <p className="font-bold mt-1">{detailPhoto.quality_score || '—'}/10</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Batch</p>
                    <p className="font-bold mt-1">{detailPhoto.batch_name || '—'}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Dimensions</p>
                    <p className="font-bold mt-1">{detailPhoto.width}×{detailPhoto.height}</p>
                  </div>
                </div>

                {detailPhoto.has_faces && (
                  <div className={`${t.errorBg} border ${t.errorBorder} rounded-xl p-3 flex items-start gap-2`}>
                    <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className={`text-[10px] ${t.errorText} font-medium`}>
                      Visages détectés. Assure-toi d&apos;avoir les autorisations (model release) avant utilisation publique.
                    </p>
                  </div>
                )}

                {detailPhoto.dominant_colors?.length > 0 && (
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>Couleurs dominantes</p>
                    <div className="flex gap-1 mt-2">
                      {detailPhoto.dominant_colors.map((c, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <div className={`w-6 h-6 rounded-md border ${t.cardBorder}`} style={{ backgroundColor: c }}></div>
                          <span className="text-[9px] font-mono">{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className={`pt-4 border-t ${t.cardBorder} space-y-2`}>
                <button
                  type="button"
                  onClick={() => toggleReference(detailPhoto)}
                  className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${detailPhoto.is_style_reference ? 'bg-yellow-400 text-white' : t.referenceBtnInactive}`}
                >
                  <Star size={12} fill={detailPhoto.is_style_reference ? 'white' : 'none'} />
                  {detailPhoto.is_style_reference ? 'Retirer des références stylistiques' : 'Marquer comme référence stylistique'}
                </button>
                <button
                  type="button"
                  onClick={() => deletePhoto(detailPhoto)}
                  className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${t.deleteBtnBg} flex items-center justify-center gap-2`}
                >
                  <Trash2 size={12} /> Supprimer cette photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}