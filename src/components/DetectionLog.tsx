import React, { useState } from 'react';
import { Detection, CLASS_STYLES } from '../types';

export interface LogEntry {
  id: number;
  timestamp: Date;
  detections: Detection[];
  thumbnail: string;   // base64 data-url of the canvas snapshot
  source: 'image' | 'webcam';
}

interface DetectionLogProps {
  entries: LogEntry[];
  onClear: () => void;
}

const DetectionLog: React.FC<DetectionLogProps> = ({ entries, onClear }) => {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (entries.length === 0) return null;

  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const topClass = (dets: Detection[]) => {
    if (!dets.length) return null;
    return dets.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  };

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.title}>DETECTION LOG</span>
          <span style={styles.count}>{entries.length} event{entries.length !== 1 ? 's' : ''}</span>
        </div>
        <button style={styles.clearBtn} onClick={onClear}>
          ✕ Clear log
        </button>
      </div>

      {/* Entries — newest first */}
      <div style={styles.list}>
        {[...entries].reverse().map((entry) => {
          const top  = topClass(entry.detections);
          const isEx = expanded === entry.id;

          // Unique class names for summary badges
          const uniqueClasses = Array.from(new Set(entry.detections.map(d => d.className)));

          return (
            <div key={entry.id} style={styles.card}>
              {/* Collapsed row */}
              <div
                style={styles.cardRow}
                onClick={() => setExpanded(isEx ? null : entry.id)}
              >
                {/* Thumbnail */}
                <img src={entry.thumbnail} style={styles.thumb} alt="detection snapshot" />

                {/* Info */}
                <div style={styles.info}>
                  <div style={styles.infoTop}>
                    <span style={styles.timeLabel}>
                      {entry.source === 'webcam' ? '🎥' : '📷'} {fmt(entry.timestamp)}
                    </span>
                    <span style={styles.detCount}>
                      {entry.detections.length} detection{entry.detections.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Class badges */}
                  <div style={styles.badges}>
                    {uniqueClasses.map(cls => (
                      <span
                        key={cls}
                        style={{
                          ...styles.badge,
                          background: CLASS_STYLES[cls].bg,
                          border: `1px solid ${CLASS_STYLES[cls].stroke}`,
                          color: CLASS_STYLES[cls].stroke,
                        }}
                      >
                        {cls}
                      </span>
                    ))}
                  </div>

                  {/* Best confidence */}
                  {top && (
                    <div style={styles.bestConf}>
                      Best: <span style={{ color: CLASS_STYLES[top.className].stroke, fontWeight: 700 }}>
                        {top.className} {(top.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Expand chevron */}
                <span style={{ ...styles.chevron, transform: isEx ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
              </div>

              {/* Expanded detail */}
              {isEx && (
                <div style={styles.detail}>
                  {/* Full-size image */}
                  <img src={entry.thumbnail} style={styles.fullImg} alt="full snapshot" />

                  {/* Detection list */}
                  <div style={styles.detList}>
                    {entry.detections.map((d, i) => (
                      <div key={i} style={styles.detRow}>
                        <div style={{
                          ...styles.detDot,
                          background: CLASS_STYLES[d.className].stroke,
                          boxShadow: `0 0 5px ${CLASS_STYLES[d.className].stroke}`,
                        }} />
                        <span style={styles.detClass}>{d.className}</span>
                        <span style={{ ...styles.detConf, color: CLASS_STYLES[d.className].stroke }}>
                          {(d.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Save button */}
                  <button
                    style={styles.saveBtn}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = entry.thumbnail;
                      a.download = `safesense_log_${entry.id}.jpg`;
                      a.click();
                    }}
                  >
                    ↓ Save image
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    border: '1px solid #252525',
    borderRadius: 8,
    overflow: 'hidden',
    background: '#141414',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 16px',
    borderBottom: '1px solid #252525',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  title: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '0.14em',
    color: '#c0c0c0',
    fontWeight: 600,
  },
  count: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.6rem',
    color: '#ff2020',
    background: 'rgba(255,32,32,0.1)',
    border: '1px solid rgba(255,32,32,0.25)',
    padding: '1px 7px',
    borderRadius: 10,
  },
  clearBtn: {
    background: 'none',
    border: '1px solid #333',
    borderRadius: 4,
    color: '#666',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.6rem',
    cursor: 'pointer',
    padding: '3px 8px',
    letterSpacing: '0.06em',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 480,
    overflowY: 'auto',
  },
  card: {
    borderBottom: '1px solid #1e1e1e',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  thumb: {
    width: 60,
    height: 44,
    objectFit: 'cover',
    borderRadius: 4,
    border: '1px solid #252525',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  infoTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.62rem',
    color: '#909090',
  },
  detCount: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.58rem',
    color: '#606060',
  },
  badges: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.55rem',
    padding: '2px 6px',
    borderRadius: 3,
    letterSpacing: '0.05em',
  },
  bestConf: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.6rem',
    color: '#707070',
  },
  chevron: {
    color: '#444',
    fontSize: '1.1rem',
    flexShrink: 0,
    transition: 'transform 0.2s',
    lineHeight: 1,
  },
  // Expanded
  detail: {
    padding: '0 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  fullImg: {
    width: '100%',
    borderRadius: 6,
    border: '1px solid #252525',
    objectFit: 'contain',
    maxHeight: 320,
  },
  detList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  detRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    background: '#0e0e0e',
    borderRadius: 4,
  },
  detDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  detClass: {
    flex: 1,
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#e0e0e0',
  },
  detConf: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  saveBtn: {
    padding: '8px 0',
    background: '#111',
    border: '1px solid #252525',
    borderRadius: 5,
    color: '#888',
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '0.08em',
    cursor: 'pointer',
    textTransform: 'uppercase',
  },
};

export default DetectionLog;
export type { DetectionLogProps };