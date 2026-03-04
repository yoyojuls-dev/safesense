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
        if (thumbnail) {
          setLog(prev => [...prev, {
            id: ++logIdRef.current,
            timestamp: new Date(),
            detections: dets,
            thumbnail,
            source: mode,
          }]);
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

        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:0.35; } }
        @keyframes spin    { to { transform: rotate(360deg); } }
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

        /* ── Layout ── */
        .ss-app {
          max-width: 1380px;
          margin: 0 auto;
          padding: 0 24px;
          display: grid;
          grid-template-rows: auto 1fr auto;
          min-height: 100vh;
        }

        .ss-main {
          display: grid;
          grid-template-columns: 1fr 310px;
          gap: 20px;
          padding: 22px 0;
          align-items: start;
        }

        .ss-detection-area {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-width: 0;
        }

        .ss-tabs {
          display: flex;
          gap: 4px;
          background: #0e0e0e;
          padding: 4px;
          border-radius: 8px;
          border: 1px solid #252525;
        }

        .ss-tab {
          flex: 1;
          padding: 11px 16px;
          border: none;
          background: transparent;
          font-family: 'Space Mono', monospace;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.18s;
          color: #888;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ss-tab.active {
          background: #ff2020;
          color: #fff;
          box-shadow: 0 0 14px rgba(255,32,32,0.35);
        }

        .ss-sidebar {
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: sticky;
          top: 20px;
        }

        .ss-footer {
          padding: 16px 0;
          border-top: 1px solid #1e1e1e;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem;
          color: #707070;
          gap: 12px;
        }

        .ss-footer-warn { color: #b06000; }

        /* ── Tablet (≤900px) ── */
        @media (max-width: 900px) {
          .ss-main {
            grid-template-columns: 1fr;
          }
          .ss-sidebar {
            position: static;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .ss-sidebar > *:last-child {
            grid-column: 1 / -1;
          }
        }

        /* ── Mobile (≤600px) ── */
        @media (max-width: 600px) {
          .ss-app {
            padding: 0 14px;
          }
          .ss-main {
            gap: 14px;
            padding: 14px 0;
          }
          .ss-tab {
            font-size: 0.62rem;
            padding: 10px 8px;
            letter-spacing: 0.02em;
          }
          .ss-sidebar {
            grid-template-columns: 1fr;
          }
          .ss-footer {
            flex-direction: column;
            text-align: center;
            gap: 6px;
            font-size: 0.58rem;
          }
        }

        /* ── Small mobile (≤400px) ── */
        @media (max-width: 400px) {
          .ss-tab {
            font-size: 0.55rem;
            padding: 9px 6px;
          }
        }
      `}</style>

      {/* Alert flash bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 3,
        background: '#ff2020',
        transform: alertFlash ? 'scaleX(1)' : 'scaleX(0)',
        transformOrigin: 'left', transition: 'transform 0.1s', zIndex: 10000,
      }} />

      <div className="ss-app">
        <Header modelStatus={status} backend={backend} />

        <main className="ss-main">
          {/* Left — detector + log */}
          <div className="ss-detection-area">
            <div className="ss-tabs">
              {(['image', 'webcam'] as AppMode[]).map((m) => (
                <button
                  key={m}
                  className={`ss-tab${mode === m ? ' active' : ''}`}
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

            {log.length > 0 && (
              <DetectionLog entries={log} onClear={() => setLog([])} />
            )}
          </div>

          {/* Right — sidebar */}
          <aside className="ss-sidebar">
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

        <footer className="ss-footer">
          <span>SAFESENSE © tup.edu.ph</span>
          <span className="ss-footer-warn">⚠ Educational &amp; security research use only</span>
        </footer>
      </div>
    </>
  );
};

export default App;