import type { LayerTransform, TextLayerData } from '@takazudo/pattern-gen-core';

/* ── Constants ── */

export const HANDLE_SIZE = 8;
export const LOADING_FONT_DIM_FACTOR = 0.3;

/* ── Canvas rendering helpers ── */

export function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerData,
) {
  const t = layer.transform;
  const fontStyle = layer.fontStyle === 'italic' ? 'italic ' : '';
  const fontWeight = layer.fontWeight === 'bold' ? 'bold ' : '';
  ctx.font = `${fontStyle}${fontWeight}${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = layer.textAlign;
  ctx.textBaseline = 'top';

  if (layer.letterSpacing !== 0) {
    (ctx as unknown as Record<string, unknown>).letterSpacing =
      `${layer.letterSpacing}px`;
  }

  if (layer.shadow.enabled) {
    ctx.shadowOffsetX = layer.shadow.offsetX;
    ctx.shadowOffsetY = layer.shadow.offsetY;
    ctx.shadowBlur = layer.shadow.blur;
    ctx.shadowColor = layer.shadow.color;
  }

  const lines = layer.content.split('\n');
  const lineHeightPx = layer.fontSize * layer.lineHeight;
  const totalTextHeight =
    (lines.length - 1) * lineHeightPx + layer.fontSize;

  let textX = t.x;
  if (layer.textAlign === 'center') textX = t.x + t.width / 2;
  else if (layer.textAlign === 'right') textX = t.x + t.width;

  let baseY = t.y;
  if (layer.textVAlign === 'middle') {
    baseY = t.y + (t.height - totalTextHeight) / 2;
  } else if (layer.textVAlign === 'bottom') {
    baseY = t.y + t.height - totalTextHeight;
  }

  for (let i = 0; i < lines.length; i++) {
    const y = baseY + i * lineHeightPx;

    if (layer.stroke.enabled) {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = layer.stroke.color;
      ctx.lineWidth = layer.stroke.width;
      ctx.lineJoin = 'round';
      ctx.strokeText(lines[i], textX, y);
      ctx.restore();
    }

    ctx.fillText(lines[i], textX, y);
  }

  // Note: letterSpacing is reset by the caller's ctx.save()/ctx.restore()
}

export function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  t: LayerTransform,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 220, 220, 1)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(t.x, t.y, t.width, t.height);
  ctx.setLineDash([]);

  // Corner handles
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'rgba(80, 80, 80, 1)';
  ctx.lineWidth = 1;
  const corners = [
    [t.x, t.y],
    [t.x + t.width, t.y],
    [t.x, t.y + t.height],
    [t.x + t.width, t.y + t.height],
  ];
  for (const [cx, cy] of corners) {
    ctx.fillRect(
      cx - HANDLE_SIZE / 2,
      cy - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
    );
    ctx.strokeRect(
      cx - HANDLE_SIZE / 2,
      cy - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
    );
  }
  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  xPositions: number[],
  yPositions: number[],
  lineColor: string,
  canvasWidth: number,
  canvasHeight: number,
) {
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;

  // Skip edges (0 and totalSize) — only draw interior lines
  for (const x of xPositions) {
    if (x === 0 || x === canvasWidth) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }

  for (const y of yPositions) {
    if (y === 0 || y === canvasHeight) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  ctx.restore();
}
