import { ImageOptimizeService } from './image-optimize.service';

describe('ImageOptimizeService', () => {
  const service = new ImageOptimizeService();

  it('generates sizes and multi-format buffers plus blur placeholder', async () => {
    // 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    const result = await service.optimize(png);
    expect(result.blurDataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    for (const size of ['original', 'thumbnail', 'small', 'medium', 'large'] as const) {
      expect(result.variants[size].webp.length).toBeGreaterThan(0);
      expect(result.variants[size].jpeg.length).toBeGreaterThan(0);
      expect(result.variants[size].avif.length).toBeGreaterThan(0);
      expect(result.variants[size].width).toBeGreaterThan(0);
      expect(result.variants[size].height).toBeGreaterThan(0);
    }
  });
});
