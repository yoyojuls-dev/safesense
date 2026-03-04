// ─── Detection Types ───────────────────────────────────────────────────────────

export type WeaponClass =
  | 'Bladed Weapon'
  | 'Explosive'
  | 'Firearm'
  | 'Projectile Weapon';

export interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  className: WeaponClass;
}

export interface ClassStyle {
  stroke: string;
  glow: string;
  bg: string;
  label: string;
}

export type AppMode = 'image' | 'webcam';
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error' | 'demo';

export interface AppState {
  mode: AppMode;
  modelStatus: ModelStatus;
  modelBackend: string;
  isProcessing: boolean;
  detections: Detection[];
  confidenceThreshold: number;
  webcamActive: boolean;
  fps: number;
}

// ─── Class order from metadata.yaml ──────────────────────────────────────────
// 0: Bladed Weapon
// 1: Explosive
// 2: Firearm
// 3: Projectile Weapon

export const CLASS_NAMES: WeaponClass[] = [
  'Bladed Weapon',     // 0
  'Explosive',         // 1
  'Firearm',           // 2
  'Projectile Weapon', // 3
];

export const CLASS_STYLES: Record<WeaponClass, ClassStyle> = {
  'Bladed Weapon': {
    stroke: '#ff2020',
    glow: 'rgba(255,32,32,0.4)',
    bg: 'rgba(255,32,32,0.1)',
    label: 'Knife / Sword / Blade',
  },
  Explosive: {
    stroke: '#ff6b20',
    glow: 'rgba(255,107,32,0.4)',
    bg: 'rgba(255,107,32,0.1)',
    label: 'Bomb / Grenade',
  },
  Firearm: {
    stroke: '#00ff88',
    glow: 'rgba(0,255,136,0.4)',
    bg: 'rgba(0,255,136,0.1)',
    label: 'Gun / Pistol / Rifle',
  },
  'Projectile Weapon': {
    stroke: '#ffe135',
    glow: 'rgba(255,225,53,0.4)',
    bg: 'rgba(255,225,53,0.1)',
    label: 'Crossbow / Bow',
  },
};

export const MODEL_URL = '/best_web_model/model.json';
export const INPUT_SIZE = 640;
export const NMS_IOU_THRESHOLD = 0.45;
export const DEFAULT_CONFIDENCE = 0.70;