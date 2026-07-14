import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

export const IMAGE_SIZES = {
  original: null as number | null,
  thumbnail: 200,
  small: 480,
  medium: 800,
  large: 1200,
} as const;

export type OptimizedSizeName = keyof typeof IMAGE_SIZES;

export type OptimizedFormatBuffers = {
  webp: Buffer;
  jpeg: Buffer;
  avif: Buffer;
  width: number;
  height: number;
};

export type OptimizedImageBundle = {
  blurDataUrl: string;
  variants: Record<OptimizedSizeName, OptimizedFormatBuffers>;
};

const WEBP_QUALITY = 80;
const JPEG_QUALITY = 85;
const AVIF_QUALITY = 55;
const BLUR_WIDTH = 20;

/**
 * Optimize any input image into multiple sizes × (webp / jpeg / avif)
 * plus a tiny base64 blur placeholder.
 */
@Injectable()
export class ImageOptimizeService {
  async optimize(input: Buffer): Promise<OptimizedImageBundle> {
    const source = sharp(input, { failOn: 'none' }).rotate();
    const meta = await source.metadata();
    const sourceWidth = meta.width ?? 0;

    const variants = {} as Record<OptimizedSizeName, OptimizedFormatBuffers>;

    for (const [name, maxWidth] of Object.entries(IMAGE_SIZES) as Array<
      [OptimizedSizeName, number | null]
    >) {
      let pipeline = sharp(input, { failOn: 'none' }).rotate();
      if (maxWidth != null && sourceWidth > 0 && sourceWidth > maxWidth) {
        pipeline = pipeline.resize({
          width: maxWidth,
          withoutEnlargement: true,
          fit: 'inside',
        });
      }

      const resized = await pipeline.toBuffer({ resolveWithObject: true });
      const width = resized.info.width;
      const height = resized.info.height;
      const base = sharp(resized.data);

      const [webp, jpeg, avif] = await Promise.all([
        base
          .clone()
          .webp({ quality: WEBP_QUALITY, effort: 4 })
          .toBuffer(),
        base
          .clone()
          .jpeg({
            quality: JPEG_QUALITY,
            progressive: true,
            chromaSubsampling: '4:2:0',
            mozjpeg: true,
          })
          .toBuffer(),
        base
          .clone()
          .avif({ quality: AVIF_QUALITY, effort: 4 })
          .toBuffer(),
      ]);

      variants[name] = { webp, jpeg, avif, width, height };
    }

    const blurBuf = await sharp(input, { failOn: 'none' })
      .rotate()
      .resize({ width: BLUR_WIDTH, withoutEnlargement: true })
      .webp({ quality: 40 })
      .toBuffer();
    const blurDataUrl = `data:image/webp;base64,${blurBuf.toString('base64')}`;

    return { blurDataUrl, variants };
  }
}
