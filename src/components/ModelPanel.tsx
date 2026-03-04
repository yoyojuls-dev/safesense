import React from 'react';
import { ModelStatus } from '../types';

interface ModelPanelProps {
  status: ModelStatus;
  backend: string;
  loadProgress: number;
  confidenceThreshold: number;
  onThresholdChange: (val: number) => void;
}

const ModelPanel: React.FC<ModelPanelProps> = ({
  status, backend, loadProgress, confidenceThreshold, onThresholdChange,
}) => {
  const statusLabel: Record<ModelStatus, string> = {
    idle: 'Waiting', loading: 'Loading...', ready: 'Ready', error: 'Failed', demo: 'Demo Mode',
  };

  return (
    <>
      <style>{`
        .ss-panel {
          background: #141414;
          border: 1px solid #252525;
          border-radius: 8px;
          overflow: hidden;
        }
        .ss-panel-header {
          padding: 11px 16px;
          border-bottom: 1px solid #252525;
          font-family: 'Space Mono', monospace;
          font-size: 0.65rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #c0c0c0;
          font-weight: 600;
        }
        .ss-panel-body { padding: 14px 16px; }
        .ss-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 11px;
        }
        .ss-row-label { font-size: 0.78rem; color: #a0a0a0; }
        .ss-row-value { font-family: 'Space Mono', monospace; font-size: 0.75rem; font-weight: 600; color: #e0e0e0; }
        .ss-progress-track { height: 3px; background: #222; border-radius: 2px; overflow: hidden; margin-top: 4px; }
        .ss-progress-fill  { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
        .ss-thresh-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .ss-thresh-label { font-size: 0.78rem; color: #a0a0a0; }
        .ss-thresh-val { font-family: 'Space Mono', monospace; font-size: 0.78rem; font-weight: 700; color: #ff2020; }
        .ss-slider-labels {
          display: flex; justify-content: space-between;
          font-family: 'Space Mono', monospace; font-size: 0.62rem; color: #707070; margin-top: 5px;
        }
      `}</style>

      <div className="ss-panel">
        <div className="ss-panel-header">Model Status</div>
        <div className="ss-panel-body">
          <div className="ss-row"><span className="ss-row-label">Framework</span><span className="ss-row-value">TensorFlow.js</span></div>
          <div className="ss-row"><span className="ss-row-label">Architecture</span><span className="ss-row-value">YOLOv8</span></div>
          <div className="ss-row"><span className="ss-row-label">Classes</span><span className="ss-row-value">4</span></div>
          <div className="ss-row">
            <span className="ss-row-label">Backend</span>
            <span className="ss-row-value" style={{ color: backend === 'webgl' ? '#00ff88' : backend === 'demo' ? '#ff6b20' : '#e0e0e0' }}>
              {backend !== '—' ? backend.toUpperCase() : '—'}
            </span>
          </div>
          <div className="ss-row">
            <span className="ss-row-label">Status</span>
            <span className="ss-row-value" style={{ color: status === 'ready' ? '#00ff88' : status === 'demo' ? '#ff6b20' : '#ffe135' }}>
              {statusLabel[status]}
            </span>
          </div>
          <div className="ss-progress-track">
            <div className="ss-progress-fill" style={{ width: `${loadProgress}%`, background: status === 'ready' ? '#00ff88' : '#ff2020' }} />
          </div>
        </div>
      </div>

      <div className="ss-panel">
        <div className="ss-panel-header">Confidence Threshold</div>
        <div className="ss-panel-body">
          <div className="ss-thresh-row">
            <span className="ss-thresh-label">Min. confidence</span>
            <span className="ss-thresh-val">{Math.round(confidenceThreshold * 100)}%</span>
          </div>
          <input
            type="range" min={5} max={90}
            value={Math.round(confidenceThreshold * 100)}
            onChange={(e) => onThresholdChange(Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#ff2020', cursor: 'pointer' }}
          />
          <div className="ss-slider-labels"><span>5%</span><span>90%</span></div>
        </div>
      </div>
    </>
  );
};

export default ModelPanel;