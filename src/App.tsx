import React, { useState, useCallback, useRef } from 'react';
import { Detection, AppMode, DEFAULT_CONFIDENCE } from './types';
import { useModel } from './hooks/useModel';
import Header from './components/Header';
import ModelPanel from './components/ModelPanel';
import DetectionList, { ClassLegend } from './components/DetectionList';
import ImageDetector from './components/ImageDetector';
import WebcamDetector from './components/WebcamDetector';
import DetectionLog, { LogEntry } from './components/DetectionLog';

const App: React.FC = () => {
  const { model, status, backend, loadProgress } = useModel();
  const [mode, setMode]             = useState<AppMode>('image');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [alertFlash, setAlertFlash] = useState(false);
  const [log, setLog]               = useState<LogEntry[]>([]);
  const logIdRef                    = useRef(0);

  const handleDetections = useCallback(
    (dets: Detection[], thumbnail?: string) => {
      setDetections(dets);
      if (dets.length > 0) {
        setAlertFlash(true);
        setTimeout(() => setAlertFlash(false), 300);

        // Add to log only when there's a thumbnail (real detection event, not slider re-run)
        if (thumbnail) {
          setLog(prev => [
            ...prev,
            {
              id:         ++logIdRef.current,
              timestamp:  new Date(),
              detections: dets,
              thumbnail,
              source:     mode,
            },
          ]);
        }
      }
    },
    [mode],
  );

  const isDemoMode = status === 'demo';

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0a0a0a;
          color: #d8d8d8;
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
        }
        body::before {
          content: '';
          position: fixed; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,32,32,0.012) 3px, rgba(255,32,32,0.012) 4px);
          pointer-events: none;
          z-index: 9999;
        }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        button:hover  { opacity: 0.88; }
        button:active { transform: scale(0.98); }
        input[type="range"] {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px;
          background: #252525; border-radius: 2px; outline: none; cursor: pointer;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width:14px; height:14px; border-radius:50%;
          background:#ff2020; box-shadow:0 0 8px rgba(255,32,32,0.5);
        }
        input[type="range"]::-moz-range-thumb {
          width:14px; height:14px; border-radius:50%;
          background:#ff2020; border:none; box-shadow:0 0 8px rgba(255,32,32,0.5);
        }
        canvas { display: block; }
        code { font-family: 'Space Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0e0e0e; }
        ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>

      {/* Alert flash bar */}
      <div style={{
        position:'fixed', top:0, left:0, right:0, height:3,
        background:'#ff2020',
        transform: alertFlash ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin:'left', transition:'transform 0.1s', zIndex:10000,
      }} />

      <div style={styles.app}>
        <Header modelStatus={status} backend={backend} />

        <main style={styles.main}>
          {/* Left — detection + log */}
          <div style={styles.detectionArea}>
            {/* Mode tabs */}
            <div style={styles.tabs}>
              {(['image', 'webcam'] as AppMode[]).map((m) => (
                <button
                  key={m}
                  style={{ ...styles.tab, ...(mode === m ? styles.tabActive : styles.tabInactive) }}
                  onClick={() => { setMode(m); setDetections([]); }}
                >
                  {m === 'image' ? '📷  Image Analysis' : '🎥  Real-Time Detection'}
                </button>
              ))}
            </div>

            {mode === 'image' ? (
              <ImageDetector
                model={model}
                isDemoMode={isDemoMode}
                confidenceThreshold={confidence}
                onDetections={handleDetections}
              />
            ) : (
              <WebcamDetector
                model={model}
                isDemoMode={isDemoMode}
                confidenceThreshold={confidence}
                onDetections={handleDetections}
              />
            )}

            {/* Detection log — shown below the detector */}
            {log.length > 0 && (
              <DetectionLog
                entries={log}
                onClear={() => setLog([])}
              />
            )}
          </div>

          {/* Right — sidebar */}
          <aside style={styles.sidebar}>
            <ModelPanel
              status={status}
              backend={backend}
              loadProgress={loadProgress}
              confidenceThreshold={confidence}
              onThresholdChange={setConfidence}
            />
            <DetectionList detections={detections} />
            <ClassLegend />
          </aside>
        </main>

        <footer style={styles.footer}>
          <span>SAFESENSE © TUP.EDU.PH</span>
          <span style={styles.footerWarn}>⚠ Educational &amp; security research use only</span>
        </footer>
      </div>
    </>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    maxWidth: 1380, margin: '0 auto', padding: '0 24px',
    display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: '100vh',
  },
  main: {
    display: 'grid', gridTemplateColumns: '1fr 310px',
    gap: 20, padding: '22px 0', alignItems: 'start',
  },
  detectionArea: { display: 'flex', flexDirection: 'column', gap: 14 },
  tabs: {
    display: 'flex', gap: 4,
    background: '#0e0e0e', padding: 4, borderRadius: 8, border: '1px solid #252525',
  },
  tab: {
    flex: 1, padding: '11px 16px', border: 'none', background: 'transparent',
    fontFamily: "'Space Mono', monospace", fontSize: '0.72rem', fontWeight: 600,
    letterSpacing: '0.06em', cursor: 'pointer', borderRadius: 6, transition: 'all 0.18s',
  },
  tabInactive: { color: '#888', background: 'transparent' },
  tabActive: { background: '#ff2020', color: '#fff', boxShadow: '0 0 14px rgba(255,32,32,0.35)' },
  sidebar: {
    display: 'flex', flexDirection: 'column', gap: 14,
    position: 'sticky', top: 20,
  },
  footer: {
    padding: '16px 0', borderTop: '1px solid #1e1e1e',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontFamily: "'Space Mono', monospace", fontSize: '0.62rem', color: '#707070',
  },
  footerWarn: { color: '#b06000' },
};

export default App;