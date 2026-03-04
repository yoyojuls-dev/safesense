import React from 'react';
import { ModelStatus } from '../types';

interface HeaderProps {
  modelStatus: ModelStatus;
  backend: string;
}

const STATUS_CONFIG: Record<ModelStatus, { color: string; text: string; pulse: boolean }> = {
  idle:    { color: '#888',    text: 'Idle',             pulse: false },
  loading: { color: '#ffe135', text: 'Loading model...', pulse: true  },
  ready:   { color: '#00ff88', text: 'Model ready',      pulse: true  },
  error:   { color: '#ff2020', text: 'Model error',      pulse: false },
  demo:    { color: '#ff6b20', text: 'Demo mode',        pulse: true  },
};

const Header: React.FC<HeaderProps> = ({ modelStatus, backend }) => {
  const cfg = STATUS_CONFIG[modelStatus];

  return (
    <header style={styles.header}>
      <div style={styles.logoGroup}>
        <h1 style={styles.logo}>SafeSense</h1>
        {/* <span style={styles.badge}>v1.0 · YOLOv8</span> */}
      </div>

      <div style={styles.statusBar}>
        <span style={{
          ...styles.dot,
          background: cfg.color,
          boxShadow: `0 0 8px ${cfg.color}`,
          animation: cfg.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ ...styles.statusText, color: cfg.color }}>{cfg.text}</span>
        {backend !== '—' && backend !== 'demo' && (
          <span style={styles.backendChip}>{backend.toUpperCase()}</span>
        )}
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '22px 0 18px',
    borderBottom: '1px solid #252525',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  logo: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '2.3rem',
    letterSpacing: '0.1em',
    color: '#ff2020',
    textShadow: '0 0 32px rgba(255,32,32,0.45)',
    lineHeight: 1,
    margin: 0,
  },
  badge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    color: '#b0b0b0',           // was #444
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    border: '1px solid #383838',  // was #222
    borderRadius: 3,
    background: 'rgba(255,255,255,0.03)',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  statusText: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
  },
  backendChip: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#00ff88',
    padding: '2px 8px',
    border: '1px solid rgba(0,255,136,0.3)',
    borderRadius: 3,
    background: 'rgba(0,255,136,0.08)',
  },
};

export default Header;