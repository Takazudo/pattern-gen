import type { OgpConfig } from './ogp-config.js';
import { parseOgpConfig } from './ogp-config.js';

export interface LayerTransform {
  x: number; // px in 1200x630 space
  y: number;
  width: number;
  height: number;
}

export interface ImageLayerData {
  type: 'image';
  name: string;
  src: string; // URL or data URI
  transform: LayerTransform;
  opacity: number; // 0-1
}

export interface TextLayerData {
  type: 'text';
  name: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  opacity: number;
  textAlign: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  shadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
  stroke: { enabled: boolean; color: string; width: number };
  transform: LayerTransform;
}

export type EditorLayer = ImageLayerData | TextLayerData;

export interface OgpEditorConfig {
  version: 1;
  background: OgpConfig;
  layers: EditorLayer[];
}

export function serializeOgpEditorConfig(config: OgpEditorConfig): string {
  return JSON.stringify(config, null, 2);
}

function validateTransform(t: unknown, label: string): LayerTransform {
  if (!t || typeof t !== 'object') {
    throw new Error(`${label}: transform must be an object`);
  }
  const raw = t as Record<string, unknown>;
  if (typeof raw.x !== 'number' || !Number.isFinite(raw.x)) {
    throw new Error(`${label}: transform.x must be a finite number`);
  }
  if (typeof raw.y !== 'number' || !Number.isFinite(raw.y)) {
    throw new Error(`${label}: transform.y must be a finite number`);
  }
  if (
    typeof raw.width !== 'number' ||
    !Number.isFinite(raw.width) ||
    raw.width <= 0
  ) {
    throw new Error(`${label}: transform.width must be a positive finite number`);
  }
  if (
    typeof raw.height !== 'number' ||
    !Number.isFinite(raw.height) ||
    raw.height <= 0
  ) {
    throw new Error(
      `${label}: transform.height must be a positive finite number`,
    );
  }
  return { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
}

function validateImageLayer(raw: Record<string, unknown>): ImageLayerData {
  const label = `Image layer "${raw.name ?? ''}"`;
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new Error(`Image layer: name must be a non-empty string`);
  }
  if (typeof raw.src !== 'string' || raw.src.length === 0) {
    throw new Error(`${label}: src must be a non-empty string`);
  }
  if (
    typeof raw.opacity !== 'number' ||
    !Number.isFinite(raw.opacity) ||
    raw.opacity < 0 ||
    raw.opacity > 1
  ) {
    throw new Error(`${label}: opacity must be a number in [0, 1]`);
  }
  const transform = validateTransform(raw.transform, label);
  return {
    type: 'image',
    name: raw.name,
    src: raw.src,
    transform,
    opacity: raw.opacity,
  };
}

function validateTextLayer(raw: Record<string, unknown>): TextLayerData {
  const label = `Text layer "${raw.name ?? ''}"`;
  if (typeof raw.name !== 'string' || raw.name.length === 0) {
    throw new Error(`Text layer: name must be a non-empty string`);
  }
  if (typeof raw.content !== 'string') {
    throw new Error(`${label}: content must be a string`);
  }
  if (typeof raw.fontFamily !== 'string' || raw.fontFamily.length === 0) {
    throw new Error(`${label}: fontFamily must be a non-empty string`);
  }
  if (
    typeof raw.fontSize !== 'number' ||
    !Number.isFinite(raw.fontSize) ||
    raw.fontSize <= 0
  ) {
    throw new Error(`${label}: fontSize must be a positive finite number`);
  }
  if (raw.fontWeight !== 'normal' && raw.fontWeight !== 'bold') {
    throw new Error(`${label}: fontWeight must be "normal" or "bold"`);
  }
  if (raw.fontStyle !== 'normal' && raw.fontStyle !== 'italic') {
    throw new Error(`${label}: fontStyle must be "normal" or "italic"`);
  }
  if (typeof raw.color !== 'string' || raw.color.length === 0) {
    throw new Error(`${label}: color must be a non-empty string`);
  }
  if (
    typeof raw.opacity !== 'number' ||
    !Number.isFinite(raw.opacity) ||
    raw.opacity < 0 ||
    raw.opacity > 1
  ) {
    throw new Error(`${label}: opacity must be a number in [0, 1]`);
  }
  if (
    raw.textAlign !== 'left' &&
    raw.textAlign !== 'center' &&
    raw.textAlign !== 'right'
  ) {
    throw new Error(`${label}: textAlign must be "left", "center", or "right"`);
  }
  if (
    typeof raw.letterSpacing !== 'number' ||
    !Number.isFinite(raw.letterSpacing)
  ) {
    throw new Error(`${label}: letterSpacing must be a finite number`);
  }
  if (
    typeof raw.lineHeight !== 'number' ||
    !Number.isFinite(raw.lineHeight) ||
    raw.lineHeight <= 0
  ) {
    throw new Error(`${label}: lineHeight must be a positive finite number`);
  }

  // Validate shadow
  const shadow = raw.shadow as Record<string, unknown> | undefined;
  if (!shadow || typeof shadow !== 'object') {
    throw new Error(`${label}: shadow must be an object`);
  }
  if (typeof shadow.enabled !== 'boolean') {
    throw new Error(`${label}: shadow.enabled must be a boolean`);
  }
  if (typeof shadow.offsetX !== 'number' || !Number.isFinite(shadow.offsetX)) {
    throw new Error(`${label}: shadow.offsetX must be a finite number`);
  }
  if (typeof shadow.offsetY !== 'number' || !Number.isFinite(shadow.offsetY)) {
    throw new Error(`${label}: shadow.offsetY must be a finite number`);
  }
  if (
    typeof shadow.blur !== 'number' ||
    !Number.isFinite(shadow.blur) ||
    shadow.blur < 0
  ) {
    throw new Error(`${label}: shadow.blur must be a non-negative finite number`);
  }
  if (typeof shadow.color !== 'string' || shadow.color.length === 0) {
    throw new Error(`${label}: shadow.color must be a non-empty string`);
  }

  // Validate stroke
  const stroke = raw.stroke as Record<string, unknown> | undefined;
  if (!stroke || typeof stroke !== 'object') {
    throw new Error(`${label}: stroke must be an object`);
  }
  if (typeof stroke.enabled !== 'boolean') {
    throw new Error(`${label}: stroke.enabled must be a boolean`);
  }
  if (typeof stroke.color !== 'string' || stroke.color.length === 0) {
    throw new Error(`${label}: stroke.color must be a non-empty string`);
  }
  if (
    typeof stroke.width !== 'number' ||
    !Number.isFinite(stroke.width) ||
    stroke.width < 0
  ) {
    throw new Error(`${label}: stroke.width must be a non-negative finite number`);
  }

  const transform = validateTransform(raw.transform, label);

  return {
    type: 'text',
    name: raw.name as string,
    content: raw.content as string,
    fontFamily: raw.fontFamily as string,
    fontSize: raw.fontSize as number,
    fontWeight: raw.fontWeight as 'normal' | 'bold',
    fontStyle: raw.fontStyle as 'normal' | 'italic',
    color: raw.color as string,
    opacity: raw.opacity as number,
    textAlign: raw.textAlign as 'left' | 'center' | 'right',
    letterSpacing: raw.letterSpacing as number,
    lineHeight: raw.lineHeight as number,
    shadow: {
      enabled: shadow.enabled as boolean,
      offsetX: shadow.offsetX as number,
      offsetY: shadow.offsetY as number,
      blur: shadow.blur as number,
      color: shadow.color as string,
    },
    stroke: {
      enabled: stroke.enabled as boolean,
      color: stroke.color as string,
      width: stroke.width as number,
    },
    transform,
  };
}

export function parseOgpEditorConfig(json: string): OgpEditorConfig {
  const raw = JSON.parse(json);

  if (raw.version !== 1) {
    throw new Error(`Unsupported OGP editor config version: ${raw.version}`);
  }

  // Validate background via parseOgpConfig
  const background = parseOgpConfig(JSON.stringify(raw.background));

  if (!Array.isArray(raw.layers)) {
    throw new Error('OGP editor config: layers must be an array');
  }

  const layers: EditorLayer[] = raw.layers.map(
    (layer: Record<string, unknown>) => {
      if (layer.type === 'image') {
        return validateImageLayer(layer);
      }
      if (layer.type === 'text') {
        return validateTextLayer(layer);
      }
      throw new Error(
        `OGP editor config: unknown layer type "${layer.type}"`,
      );
    },
  );

  return {
    version: 1 as const,
    background,
    layers,
  };
}
