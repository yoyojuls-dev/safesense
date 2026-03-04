import * as tf from '@tensorflow/tfjs';
import {
  Detection,
  WeaponClass,
  CLASS_NAMES,
  NMS_IOU_THRESHOLD,
  CLASS_STYLES,
} from '../types';

// ─── Model facts from metadata.yaml ──────────────────────────────────────────
// task: detect | nms: false | imgsz: 640 | classes: 4
// Output shape after squeeze: [8, 8400]  (standard YOLOv8 tfjs export)
//   rows 0-3  = cx, cy, w, h  (in 640px letterboxed space)
//   rows 4-7  = raw logits for each class (need sigmoid → probability)
// We apply our own NMS since nms:false in the export.

const NC = CLASS_NAMES.length; // 4

// ─── Sigmoid ─────────────────────────────────────────────────────────────────

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// ─── IoU ─────────────────────────────────────────────────────────────────────

function iou(a: Detection, b: Detection): number {
  const x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2), y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter + 1e-6);
}

// ─── NMS ─────────────────────────────────────────────────────────────────────

export function applyNMS(dets: Detection[], thresh = NMS_IOU_THRESHOLD): Detection[] {
  const sorted = [...dets].sort((a, b) => b.confidence - a.confidence);
  const keep: Detection[] = [];
  const dead = new Set<number>();
  for (let i = 0; i < sorted.length; i++) {
    if (dead.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!dead.has(j) && iou(sorted[i], sorted[j]) > thresh) dead.add(j);
    }
  }
  return keep;
}

// ─── Letterbox ───────────────────────────────────────────────────────────────

interface LB { lbCanvas: HTMLCanvasElement; padLeft: number; padTop: number; scale: number; }

function letterbox(src: HTMLCanvasElement): LB {
  const S = 640;
  const scale = Math.min(S / src.width, S / src.height);
  const newW  = Math.round(src.width  * scale);
  const newH  = Math.round(src.height * scale);
  const padLeft = Math.floor((S - newW) / 2);
  const padTop  = Math.floor((S - newH) / 2);
  const lb = document.createElement('canvas');
  lb.width = S; lb.height = S;
  const ctx = lb.getContext('2d')!;
  ctx.fillStyle = '#727272';
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(src, padLeft, padTop, newW, newH);
  return { lbCanvas: lb, padLeft, padTop, scale };
}

// ─── Parse [4+NC, 8400] transposed output (standard YOLOv8 tfjs) ─────────────

function parseTransposed(
  data: Float32Array | Int32Array | Uint8Array,
  numPreds: number,    // 8400
  padLeft: number, padTop: number, scale: number,
  srcW: number, srcH: number,
  dispW: number, dispH: number,
  threshold: number,
): Detection[] {
  const sx = dispW / srcW;
  const sy = dispH / srcH;
  const dets: Detection[] = [];

  for (let i = 0; i < numPreds; i++) {
    // Box coords: row 0-3, col i
    const cx = data[0 * numPreds + i];
    const cy = data[1 * numPreds + i];
    const bw = data[2 * numPreds + i];
    const bh = data[3 * numPreds + i];

    // Class scores: rows 4..4+NC, apply sigmoid
    let maxConf = 0, maxCls = 0;
    for (let c = 0; c < NC; c++) {
      const score = sigmoid(data[(4 + c) * numPreds + i]);
      if (score > maxConf) { maxConf = score; maxCls = c; }
    }
    if (maxConf < threshold) continue;

    const x1 = Math.max(0, Math.min(srcW, ((cx - bw / 2) - padLeft) / scale));
    const y1 = Math.max(0, Math.min(srcH, ((cy - bh / 2) - padTop)  / scale));
    const x2 = Math.max(0, Math.min(srcW, ((cx + bw / 2) - padLeft) / scale));
    const y2 = Math.max(0, Math.min(srcH, ((cy + bh / 2) - padTop)  / scale));

    dets.push({ x1: x1*sx, y1: y1*sy, x2: x2*sx, y2: y2*sy, confidence: maxConf, className: CLASS_NAMES[maxCls] as WeaponClass });
  }
  return applyNMS(dets);
}

// ─── Parse [8400, 4+NC] row-major output ─────────────────────────────────────

function parseRowMajor(
  data: Float32Array | Int32Array | Uint8Array,
  numPreds: number,    // 8400
  padLeft: number, padTop: number, scale: number,
  srcW: number, srcH: number,
  dispW: number, dispH: number,
  threshold: number,
): Detection[] {
  const stride = 4 + NC;
  const sx = dispW / srcW;
  const sy = dispH / srcH;
  const dets: Detection[] = [];

  for (let i = 0; i < numPreds; i++) {
    const base = i * stride;
    const cx = data[base + 0];
    const cy = data[base + 1];
    const bw = data[base + 2];
    const bh = data[base + 3];

    let maxConf = 0, maxCls = 0;
    for (let c = 0; c < NC; c++) {
      const score = sigmoid(data[base + 4 + c]);
      if (score > maxConf) { maxConf = score; maxCls = c; }
    }
    if (maxConf < threshold) continue;

    const x1 = Math.max(0, Math.min(srcW, ((cx - bw / 2) - padLeft) / scale));
    const y1 = Math.max(0, Math.min(srcH, ((cy - bh / 2) - padTop)  / scale));
    const x2 = Math.max(0, Math.min(srcW, ((cx + bw / 2) - padLeft) / scale));
    const y2 = Math.max(0, Math.min(srcH, ((cy + bh / 2) - padTop)  / scale));

    dets.push({ x1: x1*sx, y1: y1*sy, x2: x2*sx, y2: y2*sy, confidence: maxConf, className: CLASS_NAMES[maxCls] as WeaponClass });
  }
  return applyNMS(dets);
}

// ─── Main Inference ───────────────────────────────────────────────────────────

export async function runInference(
  model: tf.GraphModel,
  srcCanvas: HTMLCanvasElement,
  confidenceThreshold: number,
  displayWidth: number,
  displayHeight: number,
): Promise<Detection[]> {
  const { lbCanvas, padLeft, padTop, scale } = letterbox(srcCanvas);

  const tensor = tf.tidy(() =>
    tf.browser.fromPixels(lbCanvas).toFloat().div(255.0).expandDims(0) as tf.Tensor4D
  );

  let detections: Detection[] = [];

  try {
    const raw = model.predict(tensor);
    const candidates: tf.Tensor[] =
      raw instanceof tf.Tensor ? [raw] :
      Array.isArray(raw) ? raw as tf.Tensor[] :
      Object.values(raw as Record<string, tf.Tensor>);

    for (const t of candidates) {
      const sq    = t.squeeze();
      const shape = sq.shape;
      const data  = await sq.data<'float32'>();
      tf.dispose(sq);

      if (shape.length !== 2) continue;
      const [d0, d1] = shape;

      // Determine layout by finding which dim equals 4+NC (=8).
      // Your model outputs [12, 8400]:
      //   d0=12 is NOT 4+NC(8), d1=8400 is NOT 4+NC(8)
      //   → fallback: smaller dim is features, larger dim is numPreds
      //   → [12, 8400]: d0 < d1, so features=d0=12, numPreds=d1=8400
      //   → parse as transposed [features, numPreds] with NC=4 at cols 4..7

      if (d0 === 4 + NC) {
        // Standard [8, 8400]
        detections = parseTransposed(data, d1, padLeft, padTop, scale,
          srcCanvas.width, srcCanvas.height, displayWidth, displayHeight, confidenceThreshold);

      } else if (d1 === 4 + NC) {
        // Row-major [8400, 8]
        detections = parseRowMajor(data, d0, padLeft, padTop, scale,
          srcCanvas.width, srcCanvas.height, displayWidth, displayHeight, confidenceThreshold);

      } else if (d0 < d1) {
        // [features, numPreds] e.g. [12, 8400] — your model's actual output
        // Classes still at rows 4..4+NC-1, extra rows are ignored
        detections = parseTransposed(data, d1, padLeft, padTop, scale,
          srcCanvas.width, srcCanvas.height, displayWidth, displayHeight, confidenceThreshold);

      } else {
        // [numPreds, features] e.g. [8400, 12]
        detections = parseRowMajor(data, d0, padLeft, padTop, scale,
          srcCanvas.width, srcCanvas.height, displayWidth, displayHeight, confidenceThreshold);
      }

      if (detections.length > 0) break;
    }

    tf.dispose([tensor, ...candidates]);
  } catch (err) {
    tf.dispose(tensor);
    console.error('[SAFESENSE] inference error:', err);
    throw err;
  }

  return detections;
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

export function drawDetections(ctx: CanvasRenderingContext2D, detections: Detection[]): void {
  ctx.save();
  detections.forEach(({ x1, y1, x2, y2, confidence, className }) => {
    const style = CLASS_STYLES[className];
    const bw = x2 - x1, bh = y2 - y1;

    // ── Bounding box with glow ───────────────────────────────────────────────
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth   = 2.5;
    ctx.strokeRect(x1, y1, bw, bh);

    // Subtle filled overlay
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = style.bg;
    ctx.fillRect(x1, y1, bw, bh);

    // ── Corner tick marks ────────────────────────────────────────────────────
    const cs = Math.min(20, bw * 0.15, bh * 0.15);
    ctx.lineWidth   = 3.5;
    ctx.strokeStyle = style.stroke;
    ctx.shadowColor = style.stroke;
    ctx.shadowBlur  = 8;
    ctx.beginPath(); ctx.moveTo(x1, y1+cs); ctx.lineTo(x1, y1); ctx.lineTo(x1+cs, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2-cs, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1+cs); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y2-cs); ctx.lineTo(x1, y2); ctx.lineTo(x1+cs, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2-cs, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2-cs); ctx.stroke();
    ctx.shadowBlur  = 0;

    // ── Label pill ───────────────────────────────────────────────────────────
    const label    = `${className}  ${(confidence * 100).toFixed(1)}%`;
    const fontSize = Math.max(13, Math.min(16, bw * 0.055)); // scales with box width
    ctx.font       = `bold ${fontSize}px "DM Sans", "Space Mono", monospace`;
    const tw       = ctx.measureText(label).width;
    const pillH    = fontSize + 12;
    const pillW    = tw + 22;
    const px       = Math.max(0, Math.min(x1, ctx.canvas.width - pillW));
    const py       = y1 - pillH - 2 < 0 ? y1 + 2 : y1 - pillH - 2;

    // Pill background — solid color for maximum readability
    ctx.fillStyle = style.stroke;
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 4);
    ctx.fill();

    // Dark shadow border for contrast on bright backgrounds
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.roundRect(px, py, pillW, pillH, 4);
    ctx.stroke();

    // Label text — black with subtle shadow for pop
    ctx.fillStyle    = '#000';
    ctx.shadowColor  = 'rgba(255,255,255,0.2)';
    ctx.shadowBlur   = 2;
    ctx.shadowOffsetY = 1;
    ctx.fillText(label, px + 11, py + pillH - 7);
    ctx.shadowBlur   = 0;
    ctx.shadowOffsetY = 0;
  });
  ctx.restore();
}

// ─── Debug ────────────────────────────────────────────────────────────────────

export function attachDebugHelper(model: tf.GraphModel, canvas: HTMLCanvasElement): void {
  if (((window as unknown) as Record<string, unknown>)['__ssDebug']) return;
  ((window as unknown) as Record<string, unknown>)['__ssDebug'] = async () => {
    const { lbCanvas } = letterbox(canvas);
    const t = tf.tidy(() => tf.browser.fromPixels(lbCanvas).toFloat().div(255.0).expandDims(0));
    const out = model.predict(t);
    const tensors = out instanceof tf.Tensor ? [out] : Array.isArray(out) ? out as tf.Tensor[] : Object.values(out as Record<string, tf.Tensor>);
    for (const [i, o] of tensors.entries()) {
      const d = await o.data<'float32'>();
      const arr = Array.from(d).slice(0, 2000);
      console.log(`[DEBUG] output[${i}] shape:`, o.shape, 'min:', Math.min(...arr).toFixed(4), 'max:', Math.max(...arr).toFixed(4));
    }
    tf.dispose(t);
  };
  console.log('[SAFESENSE] window.__ssDebug() ready');
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

export function generateMockDetections(width: number, height: number, count = Math.floor(Math.random() * 2) + 1): Detection[] {
  return Array.from({ length: count }, () => {
    const cls = CLASS_NAMES[Math.floor(Math.random() * CLASS_NAMES.length)];
    const x = Math.random() * width * 0.6 + width * 0.1;
    const y = Math.random() * height * 0.6 + height * 0.1;
    const bw = (0.1 + Math.random() * 0.18) * width;
    const bh = (0.1 + Math.random() * 0.18) * height;
    return { x1: x, y1: y, x2: x+bw, y2: y+bh, confidence: 0.55 + Math.random() * 0.4, className: cls as WeaponClass };
  });
}