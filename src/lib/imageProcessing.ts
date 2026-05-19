import sharp from 'sharp';

export type ProcessedImage = {
  fullSize: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  size_bytes: number;
};

const MAX_WIDTH = 2400;
const THUMB_WIDTH = 400;
const JPEG_QUALITY = 85;
const THUMB_QUALITY = 75;

/**
 * Compresse l'image source et génère une miniature.
 * - Plein format : max 2400px de large, JPEG qualité 85, progressif
 * - Miniature : 400×400 carré (cover), JPEG qualité 75
 * - Auto-rotation selon EXIF pour éviter les images retournées
 */
export async function processImage(inputBuffer: Buffer): Promise<ProcessedImage> {
  const fullSize = await sharp(inputBuffer)
    .rotate()
    .resize(MAX_WIDTH, null, { withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, progressive: true })
    .toBuffer();

  const fullMeta = await sharp(fullSize).metadata();

  const thumbnail = await sharp(inputBuffer)
    .rotate()
    .resize(THUMB_WIDTH, THUMB_WIDTH, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();

  return {
    fullSize,
    thumbnail,
    width: fullMeta.width || 0,
    height: fullMeta.height || 0,
    size_bytes: fullSize.length
  };
}