import type { LayerTransform } from '@takazudo/pattern-gen-core';

export type AlignmentType =
  | 'align-left'
  | 'align-center-h'
  | 'align-right'
  | 'align-top'
  | 'align-middle-v'
  | 'align-bottom';

/**
 * Compute aligned transforms for a set of layers.
 * Returns a Map from layer id to the new transform.
 * Returns null if fewer than 2 targets are found (alignment requires at least 2).
 */
export function computeAlignment(
  layers: { id: string; transform: LayerTransform }[],
  selectedIds: string[],
  alignment: AlignmentType,
): Map<string, LayerTransform> | null {
  const targets = layers.filter((l) => selectedIds.includes(l.id));
  if (targets.length < 2) return null;

  const transforms = targets.map((l) => l.transform);

  let getNewX: ((t: LayerTransform) => number) | null = null;
  let getNewY: ((t: LayerTransform) => number) | null = null;

  switch (alignment) {
    case 'align-left': {
      const minX = Math.min(...transforms.map((t) => t.x));
      getNewX = () => minX;
      break;
    }
    case 'align-center-h': {
      const minX = Math.min(...transforms.map((t) => t.x));
      const maxRight = Math.max(...transforms.map((t) => t.x + t.width));
      const centerX = (minX + maxRight) / 2;
      getNewX = (t) => centerX - t.width / 2;
      break;
    }
    case 'align-right': {
      const maxRight = Math.max(...transforms.map((t) => t.x + t.width));
      getNewX = (t) => maxRight - t.width;
      break;
    }
    case 'align-top': {
      const minY = Math.min(...transforms.map((t) => t.y));
      getNewY = () => minY;
      break;
    }
    case 'align-middle-v': {
      const minY = Math.min(...transforms.map((t) => t.y));
      const maxBottom = Math.max(
        ...transforms.map((t) => t.y + t.height),
      );
      const centerY = (minY + maxBottom) / 2;
      getNewY = (t) => centerY - t.height / 2;
      break;
    }
    case 'align-bottom': {
      const maxBottom = Math.max(
        ...transforms.map((t) => t.y + t.height),
      );
      getNewY = (t) => maxBottom - t.height;
      break;
    }
  }

  const result = new Map<string, LayerTransform>();
  for (const layer of targets) {
    const newTransform = { ...layer.transform };
    if (getNewX) newTransform.x = getNewX(layer.transform);
    if (getNewY) newTransform.y = getNewY(layer.transform);
    result.set(layer.id, newTransform);
  }
  return result;
}
