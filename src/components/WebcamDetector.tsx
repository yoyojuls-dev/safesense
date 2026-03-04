import React, { useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Detection } from '../types';
import { useWebcam } from '../hooks/useWebcam';

interface WebcamDetectorProps {
  model: tf.GraphModel | null;
  isDemoMode: boolean;
  confidenceThreshold: number;
  onDetections: (dets: Detection[], thumbnail?: string) => void;
}

const WebcamDetector: React.FC<WebcamDetectorProps> = ({
  model,
  isDemoMode,
  confidenceThreshold,
  onDetections,
}) => {
  const [mirrored, setMirrored] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const { videoRef, canvasRef, isActive, fps, start, stop, takeScreenshot, error, cameraLabel } =
    useWebcam({ model, isDemoMode, confidenceThreshold, mirrored, facingMode, onDetections });

  return (
    <div style={styles.wrapper}>
      <style>{`
        @media (max-width: 600px) {
          .ss-viewport { min-height: 260px !important; }
          .ss-controls { flex-wrap: wrap; }
          .ss-mirror-btn { flex: 1 1 40%; }
        }
        @media (max-width: 400px) {
          .ss-capture-btn { width: 30px !important; height: 30px !important; font-size: 0.95rem !important; }
        }
      `}</style>
      <div className="ss-viewport" style={styles.viewport}>

        {/* Hidden video element — source for canvas drawing */}
        <video
          ref={videoRef}
          style={styles.hiddenVideo}
          muted
          playsInline
        />

        {/* Main canvas — video + detection boxes painted here every rAF */}
        <canvas
          ref={canvasRef}
          style={{ ...styles.canvas, display: isActive ? 'block' : 'none' }}
        />

        {/* Placeholder when camera is off */}
        {!isActive && (
          <div style={styles.placeholder}>
            <div style={styles.camIcon}>◉</div>
            <div style={styles.camText}>Camera feed will appear here</div>
            <div style={styles.camSub}>Click "Start Camera" to begin</div>
          </div>
        )}

        {/* ── Overlay HUD ── */}
        {isActive && (
          <>
            {/* LIVE badge */}
            <div style={styles.liveTag}>
              <span style={styles.liveDot} />
              LIVE
            </div>

            {/* FPS counter */}
            <div style={styles.fpsTag}>{fps} FPS</div>

            {/* Active camera name */}
            {cameraLabel && (
              <div style={styles.cameraTag} title={cameraLabel}>
                ◉ {cameraLabel.length > 28 ? cameraLabel.slice(0, 28) + '…' : cameraLabel}
              </div>
            )}

            {/* Mirror indicator */}
            {mirrored && (
              <div style={styles.mirrorBadge}>
                ⟷ MIRRORED
              </div>
            )}

            {/* Capture shortcut OR flip camera on mobile */}
            {isMobile ? (
              <button
                style={styles.captureBtn}
                title="Flip Camera"
                onClick={() => {
                  setFacingMode(f => f === 'environment' ? 'user' : 'environment');
                  if (isActive) { stop(); setTimeout(() => start(), 300); }
                }}
              >
                🔄
              </button>
            ) : (
              <button style={styles.captureBtn} onClick={takeScreenshot} title="Capture">
                ⊙
              </button>
            )}
          </>
        )}
      </div>

      {/* Error */}
      {error && <div style={styles.error}>⚠ {error}</div>}

      {/* Controls row */}
      <div className="ss-controls" style={styles.controls}>
        {!isActive ? (
          <button style={styles.btnPrimary} onClick={start}>
            ▶ Start Camera
          </button>
        ) : (
          <button style={styles.btnDanger} onClick={stop}>
            ■ Stop Camera
          </button>
        )}

        {/* Mirror toggle — visible whether camera is on or off */}
        <button
          style={{ ...styles.btnIcon, background: mirrored ? 'rgba(255,32,32,0.18)' : '#111', borderColor: mirrored ? 'rgba(255,32,32,0.5)' : '#1e1e1e', color: mirrored ? '#ff2020' : '#888' }}
          onClick={() => setMirrored(m => !m)}
          title="Toggle mirror view"
        >
          {/* Flip / mirror icon made from Unicode arrows */}
          <span style={styles.mirrorIcon}>⟷</span>
          <span style={styles.mirrorLabel}>Mirror</span>
        </button>

        {isActive && (
          <button style={styles.btn} onClick={takeScreenshot}>
            ↓ Screenshot
          </button>
        )}
      </div>

      {isDemoMode && (
        <div style={styles.demoNote}>
          ⚡ Demo mode — random detections shown. Add your model to{' '}
          <code style={styles.code}>/public/best_web_model/model.json</code>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 10 },

  viewport: {
    position: 'relative',
    minHeight: 440,
    background: '#080808',
    border: '1px solid #1a1a1a',
    borderRadius: 10,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  hiddenVideo: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0,
    pointerEvents: 'none',
  },

  canvas: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    willChange: 'contents',
  },

  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    userSelect: 'none',
  },
  camIcon: { fontSize: '3rem', color: '#666' },
  camText: { fontFamily: "'Space Mono', monospace", fontSize: '0.82rem', color: '#a0a0a0', letterSpacing: '0.04em' },
  camSub:  { fontFamily: "'Space Mono', monospace", fontSize: '0.65rem', color: '#606060' },

  // ── HUD overlays ──────────────────────────────────────────────────────────

  liveTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.68rem',
    fontWeight: 700,
    color: '#ff2020',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    padding: '5px 11px',
    borderRadius: 4,
    border: '1px solid rgba(255,32,32,0.35)',
    letterSpacing: '0.12em',
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#ff2020',
    boxShadow: '0 0 8px #ff2020',
    display: 'inline-block',
    animation: 'pulse 1.1s ease-in-out infinite',
  },

  fpsTag: {
    position: 'absolute',
    top: 14,
    right: 14,
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.68rem',
    fontWeight: 700,
    color: '#00ff88',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    padding: '5px 11px',
    borderRadius: 4,
    border: '1px solid rgba(0,255,136,0.25)',
    letterSpacing: '0.08em',
  },

  cameraTag: {
    position: 'absolute',
    top: 44,
    right: 14,
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.58rem',
    color: '#a0a0a0',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.08)',
    letterSpacing: '0.05em',
    maxWidth: 220,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mirrorBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.62rem',
    color: '#ff2020',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid rgba(255,32,32,0.3)',
    letterSpacing: '0.1em',
  },

  captureBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    width: 36,
    height: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '50%',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '1.15rem',
    cursor: 'pointer',
    lineHeight: 1,
  },

  // ── Controls ──────────────────────────────────────────────────────────────

  error: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.72rem',
    color: '#ff6b20',
    padding: '9px 14px',
    background: 'rgba(255,107,32,0.07)',
    border: '1px solid rgba(255,107,32,0.2)',
    borderRadius: 6,
  },

  controls: { display: 'flex', gap: 8, alignItems: 'stretch' },

  btnPrimary: {
    flex: 1,
    padding: '12px 0',
    background: '#ff2020',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },

  btnDanger: {
    flex: 1,
    padding: '12px 0',
    background: 'rgba(255,32,32,0.1)',
    border: '1px solid rgba(255,32,32,0.35)',
    borderRadius: 6,
    color: '#ff2020',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },

  btnIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '12px 18px',
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 6,
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.72rem',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  },

  mirrorIcon: { fontSize: '1.05rem', lineHeight: 1 },
  mirrorLabel: { letterSpacing: '0.06em' },

  btn: {
    flex: 1,
    padding: '12px 0',
    background: '#111',
    border: '1px solid #1e1e1e',
    borderRadius: 6,
    color: '#888',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.72rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },

  demoNote: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    color: '#444',
    lineHeight: 1.7,
  },
  code: {
    color: '#ff6b20',
    background: 'rgba(255,107,32,0.08)',
    padding: '1px 5px',
    borderRadius: 3,
  },
};

export default WebcamDetector;