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
    <>
      <style>{`
        .ss-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 0 16px;
          border-bottom: 1px solid #252525;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ss-logo-group {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .ss-logo-img {
          height: 38px;
          width: auto;
          display: block;
          filter: drop-shadow(0 0 8px rgba(255,32,32,0.5));
        }
        @media (max-width: 480px) {
          .ss-logo-img { height: 28px; }
        }
        .ss-logo {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.3rem;
          letter-spacing: 0.1em;
          color: #ff2020;
          text-shadow: 0 0 32px rgba(255,32,32,0.45);
          line-height: 1;
          margin: 0;
        }
        .ss-badge {
          font-family: 'Space Mono', monospace;
          font-size: 0.65rem;
          color: #b0b0b0;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 3px 8px;
          border: 1px solid #383838;
          border-radius: 3px;
          background: rgba(255,255,255,0.03);
        }
        .ss-status-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .ss-status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .ss-status-text {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.06em;
        }
        .ss-backend-chip {
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem;
          font-weight: 700;
          color: #00ff88;
          padding: 2px 8px;
          border: 1px solid rgba(0,255,136,0.3);
          border-radius: 3px;
          background: rgba(0,255,136,0.08);
        }
        @media (max-width: 480px) {
          .ss-logo { font-size: 1.8rem; }
          .ss-badge { display: none; }
          .ss-status-text { font-size: 0.62rem; }
        }
      `}</style>
      <header className="ss-header">
        <div className="ss-logo-group">
          <img src="/logos.png" alt="SafeSense Logo" className="ss-logo-img" />
          <h1 className="ss-logo">SafeSense</h1>
          {/* <span className="ss-badge">v1.0 · YOLOv8</span> */}
        </div>
        <div className="ss-status-bar">
          <span
            className="ss-status-dot"
            style={{
              background: cfg.color,
              boxShadow: `0 0 8px ${cfg.color}`,
              animation: cfg.pulse ? 'pulse 2s ease-in-out infinite' : 'none',
            }}
          />
          <span className="ss-status-text" style={{ color: cfg.color }}>{cfg.text}</span>
          {backend !== '—' && backend !== 'demo' && (
            <span className="ss-backend-chip">{backend.toUpperCase()}</span>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;