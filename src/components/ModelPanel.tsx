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
  status,
  backend,
  loadProgress,
  confidenceThreshold,
  onThresholdChange,
}) => {
  const statusLabel: Record<ModelStatus, string> = {
    idle:    'Waiting',
    loading: 'Loading...',
    ready:   'Ready',
    error:   'Failed',
    demo:    'Demo Mode',
  };

  return (
    <>
      {/* Model Info */}
      <div style={styles.panel}>
        <div style={styles.panelHeader}>Model Status</div>
        <div style={styles.body}>
          <Row label="Framework"    value="TensorFlow.js" />
          <Row label="Architecture" value="YOLOv8" />
          <Row label="Classes"      value="4" />
          <Row
            label="Backend"
            value={backend !== '—' ? backend.toUpperCase() : '—'}
            valueColor={backend === 'webgl' ? '#00ff88' : backend === 'demo' ? '#ff6b20' : undefined}
          />
          <Row
            label="Status"
            value={statusLabel[status]}
            valueColor={status === 'ready' ? '#00ff88' : status === 'demo' ? '#ff6b20' : '#ffe135'}
          />
          <div style={styles.progressTrack}>
            <div style={{
              ...styles.progressFill,
              width: `${loadProgress}%`,
              background: status === 'ready' ? '#00ff88' : '#ff2020',
            }} />
          </div>
        </div>
      </div>

      {/* Confidence Threshold */}
      <div style={styles.panel}>
        <div style={styles.panelHeader}>Confidence Threshold</div>
        <div style={styles.body}>
          <div style={styles.threshRow}>
            <span style={styles.threshLabel}>Min. confidence</span>
            <span style={styles.threshVal}>{Math.round(confidenceThreshold * 100)}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={90}
            value={Math.round(confidenceThreshold * 100)}
            onChange={(e) => onThresholdChange(Number(e.target.value) / 100)}
            style={styles.slider}
          />
          <div style={styles.sliderLabels}>
            <span>5%</span>
            <span>90%</span>
          </div>
        </div>
      </div>
    </>
  );
};

const Row: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <div style={rowStyles.row}>
    <span style={rowStyles.label}>{label}</span>
    <span style={{ ...rowStyles.value, color: valueColor || '#e0e0e0' }}>{value}</span>
  </div>
);

const rowStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 11,
  },
  label: {
    fontSize: '0.78rem',
    color: '#a0a0a0',           // was #555 — now clearly readable
    fontWeight: 400,
  },
  value: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.75rem',
    fontWeight: 600,
  },
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#141414',      // slightly lighter than pure #111
    border: '1px solid #252525',
    borderRadius: 8,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '11px 16px',
    borderBottom: '1px solid #252525',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: '#c0c0c0',           // was #555 — now clearly readable
    fontWeight: 600,
  },
  body: { padding: '14px 16px' },
  progressTrack: {
    height: 3,
    background: '#222',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  threshRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  threshLabel: {
    fontSize: '0.78rem',
    color: '#a0a0a0',           // was #555
  },
  threshVal: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#ff2020',
  },
  slider: {
    width: '100%',
    accentColor: '#ff2020',
    cursor: 'pointer',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.62rem',
    color: '#707070',           // was #444
    marginTop: 5,
  },
};

export default ModelPanel;