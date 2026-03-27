import { OGP_WIDTH, OGP_HEIGHT } from './ogp-config.js';

const OGP_ASPECT = OGP_WIDTH / OGP_HEIGHT;
const BASE_DIMENSION = 1200;

export type AspectMode = 'ogp' | 'square' | 'free' | 'fixed';

export interface AspectConfig {
  mode: AspectMode;
  freeW: number;
  freeH: number;
  fixedW: number;
  fixedH: number;
}

export function getAspect(config: AspectConfig): number {
  switch (config.mode) {
    case 'ogp':
      return OGP_ASPECT;
    case 'square':
      return 1;
    case 'free':
      return config.freeW / config.freeH;
    case 'fixed':
      return config.fixedW / config.fixedH;
  }
}

export function getOutputDimensions(config: AspectConfig): { width: number; height: number } {
  if (config.mode === 'ogp') return { width: OGP_WIDTH, height: OGP_HEIGHT };
  if (config.mode === 'fixed') return { width: config.fixedW, height: config.fixedH };
  const aspect = getAspect(config);
  if (aspect >= 1) {
    return { width: BASE_DIMENSION, height: Math.round(BASE_DIMENSION / aspect) };
  }
  return { width: Math.round(BASE_DIMENSION * aspect), height: BASE_DIMENSION };
}
