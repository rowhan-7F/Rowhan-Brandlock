import { Agent, setGlobalDispatcher } from "undici";

// Désactive la vérification TLS pour contourner l'interception SSL de l'antivirus
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const WIKIMEDIA_UA = 'BrandLockIA/1.0 (https://brandlock.io)';
const MAX_RETRIES = 2;

export type ImageSource = 'pexels' | 'unsplash' | 'pixabay' | 'wikimedia' | 'loremflickr';

export type StockImageResult = {
  url: string;
  thumb_url?: string;
  source: ImageSource;
  license: string;
  attribution: string;
  attribution_required: boolean;
  source_url: string;
  width?: number;
  height?: number;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Helper : fetch avec retry automatique pour gérer les coupures TLS de l'antivirus
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (attempt === MAX_RETRIES) return null;
    } catch {
      if (attempt === MAX_RETRIES) return null;
    }
    await sleep(400 * (attempt + 1));
  }
  return null;
}

// === PEXELS ===
async function fetchPexels(keyword: string): Promise<StockImageResult | null> {
    if (!PEXELS_API_KEY) return null;
    const cleanKeyword = encodeURIComponent(keyword.split(',')[0].trim());
  const url = `https://api.pexels.com/v1/search?query=${cleanKeyword}&per_page=15&orientation=square&size=large`;

  const res = await fetchWithRetry(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res) {
    console.warn(`⚠ Pexels: échec définitif pour "${keyword}"`);
    return null;
  }

  try {
    const data = await res.json();
    if (!data.photos?.length) return null;
    const photo = data.photos[Math.floor(Math.random() * data.photos.length)];
    return {
      url: photo.src?.large2x || photo.src?.large || photo.src?.original,
      thumb_url: photo.src?.medium,
      source: 'pexels',
      license: 'Pexels Free',
      attribution: photo.photographer || '',
      attribution_required: false,
      source_url: photo.url || '',
      width: photo.width,
      height: photo.height
    };
  } catch {
    return null;
  }
}

// === UNSPLASH ===
async function fetchUnsplash(keyword: string): Promise<StockImageResult | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;
  const cleanKeyword = encodeURIComponent(keyword.split(',')[0].trim());
  const url = `https://api.unsplash.com/search/photos?query=${cleanKeyword}&per_page=15&orientation=squarish`;

  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
  });
  if (!res) {
    console.warn(`⚠ Unsplash: échec définitif pour "${keyword}"`);
    return null;
  }

  try {
    const data = await res.json();
    if (!data.results?.length) return null;
    const photo = data.results[Math.floor(Math.random() * data.results.length)];

    // Unsplash ToS : trigger download tracking (fire & forget)
    if (photo.links?.download_location) {
      fetch(photo.links.download_location, {
        headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
      }).catch(() => {});
    }

    return {
      url: photo.urls?.regular || photo.urls?.full,
      thumb_url: photo.urls?.small,
      source: 'unsplash',
      license: 'Unsplash Free',
      attribution: photo.user?.name || '',
      attribution_required: false,
      source_url: photo.links?.html || '',
      width: photo.width,
      height: photo.height
    };
  } catch {
    return null;
  }
}

// === PIXABAY ===
async function fetchPixabay(keyword: string): Promise<StockImageResult | null> {
  if (!PIXABAY_API_KEY) return null;
  const cleanKeyword = encodeURIComponent(keyword.split(',')[0].trim());
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${cleanKeyword}&image_type=photo&per_page=15&safesearch=true`;

  const res = await fetchWithRetry(url);
  if (!res) {
    console.warn(`⚠ Pixabay: échec définitif pour "${keyword}"`);
    return null;
  }

  try {
    const data = await res.json();
    if (!data.hits?.length) return null;
    const photo = data.hits[Math.floor(Math.random() * data.hits.length)];
    return {
      url: photo.largeImageURL || photo.webformatURL,
      thumb_url: photo.previewURL,
      source: 'pixabay',
      license: 'Pixabay Content License',
      attribution: photo.user || '',
      attribution_required: false,
      source_url: photo.pageURL || '',
      width: photo.imageWidth,
      height: photo.imageHeight
    };
  } catch {
    return null;
  }
}

// === WIKIMEDIA ===
const ACCEPTABLE_LICENSES = ['cc0', 'public domain', 'pd', 'cc by', 'cc-by'];
const FORBIDDEN_FLAGS = ['-sa', ' sa', '-nc', ' nc', '-nd', ' nd'];

function isLicenseOk(license: string): boolean {
  const lower = license.toLowerCase();
  if (FORBIDDEN_FLAGS.some(f => lower.includes(f))) return false;
  return ACCEPTABLE_LICENSES.some(l => lower.includes(l));
}

async function fetchWikimedia(keyword: string): Promise<StockImageResult | null> {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(keyword)}+filetype:bitmap&srnamespace=6&srlimit=15&format=json&origin=*`;
    const searchRes = await fetchWithRetry(searchUrl, { headers: { 'User-Agent': WIKIMEDIA_UA } });
    if (!searchRes) {
      console.warn(`⚠ Wikimedia search: échec pour "${keyword}"`);
      return null;
    }

    const searchData = await searchRes.json();
    const results = searchData?.query?.search || [];
    if (!results.length) return null;

    const titles = results.slice(0, 15).map((r: any) => r.title).join('|');
    const metaUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|extmetadata|size&format=json&origin=*`;
    const metaRes = await fetchWithRetry(metaUrl, { headers: { 'User-Agent': WIKIMEDIA_UA } });
    if (!metaRes) {
      console.warn(`⚠ Wikimedia metadata: échec pour "${keyword}"`);
      return null;
    }

    const metaData = await metaRes.json();
    const pages: any[] = Object.values(metaData?.query?.pages || {});

    const acceptable = pages.filter((page: any) => {
      const info = page?.imageinfo?.[0];
      if (!info?.url) return false;
      const license = info.extmetadata?.LicenseShortName?.value || '';
      return isLicenseOk(license);
    });

    if (!acceptable.length) return null;

    const page: any = acceptable[Math.floor(Math.random() * acceptable.length)];
    const info = page.imageinfo[0];
    const ext = info.extmetadata || {};
    const license = ext.LicenseShortName?.value || 'CC';
    const artist = (ext.Artist?.value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() || 'Wikimedia';

    const isCc0 = license.toLowerCase().includes('cc0') ||
                  license.toLowerCase().includes('public domain') ||
                  license.toLowerCase().includes('pd');

    return {
      url: info.url,
      source: 'wikimedia',
      license,
      attribution: artist,
      attribution_required: !isCc0,
      source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      width: info.width,
      height: info.height
    };
  } catch (err: any) {
    console.warn(`⚠ Wikimedia: ${err.message}`);
    return null;
  }
}

// === LOREMFLICKR (fallback ultime) ===
function fetchLoremFlickr(keyword: string): StockImageResult {
  const safe = encodeURIComponent(keyword.split(',')[0].trim().split(' ')[0]);
  const lock = Math.floor(Math.random() * 10000);
  return {
    url: `https://loremflickr.com/1080/1080/${safe},aesthetic?lock=${lock}`,
    source: 'loremflickr',
    license: 'Flickr CC',
    attribution: '',
    attribution_required: false,
    source_url: 'https://loremflickr.com'
  };
}

// === MAIN : récupère une image avec métadonnées ===
export async function getStockImageWithMetadata(keyword: string): Promise<StockImageResult> {
  const startTime = Date.now();

  const results = await Promise.all([
    fetchPexels(keyword),
    fetchUnsplash(keyword),
    fetchPixabay(keyword),
    fetchWikimedia(keyword)
  ]);

  const valid = results.filter((r): r is StockImageResult => r !== null);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (valid.length === 0) {
    console.log(`⚠ Aucune source n'a répondu pour "${keyword}", fallback LoremFlickr (${elapsed}s)`);
    return fetchLoremFlickr(keyword);
  }

  const picked = valid[Math.floor(Math.random() * valid.length)];
  console.log(`✓ Image trouvée pour "${keyword}" via ${picked.source} (${valid.length} sources OK en ${elapsed}s)`);
  return picked;
}