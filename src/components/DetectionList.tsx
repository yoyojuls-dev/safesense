import React from 'react';
import { Detection, CLASS_STYLES, CLASS_NAMES, WeaponClass } from '../types';

interface DetectionListProps {
  detections: Detection[];
}

const DetectionList: React.FC<DetectionListProps> = ({ detections }) => (
  <div style={styles.panel}>
    <div style={styles.panelHeader}>
      <span style={styles.panelTitle}>Detections</span>
      <span style={{ ...styles.countBadge, color: detections.length > 0 ? '#ff2020' : '#606060' }}>
        {detections.length}
      </span>
    </div>

    <div style={styles.list}>
      {detections.length === 0 ? (
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>◌</span>
          <span>No detections</span>
        </div>
      ) : (
        detections.map((det, i) => {
          const style = CLASS_STYLES[det.className];
          return (
            <div
              key={i}
              style={{
                ...styles.item,
                borderLeftColor: style.stroke,
                background: style.bg,
                animationDelay: `${i * 40}ms`,
              }}
            >
              <div style={styles.itemLeft}>
                <div style={{ ...styles.dot, background: style.stroke, boxShadow: `0 0 6px ${style.stroke}` }} />
                <span style={styles.className}>{det.className}</span>
              </div>
              <span style={{ ...styles.conf, color: style.stroke }}>
                {(det.confidence * 100).toFixed(1)}%
              </span>
            </div>
          );
        })
      )}
    </div>
  </div>
);

// ─── Legend ───────────────────────────────────────────────────────────────────

export const ClassLegend: React.FC = () => (
  <div style={styles.panel}>
    <div style={styles.panelHeader}>
      <span style={styles.panelTitle}>Weapon Classes</span>
    </div>
    <div style={styles.legendList}>
      {CLASS_NAMES.map((cls) => {
        const s = CLASS_STYLES[cls as WeaponClass];
        return (
          <div key={cls} style={styles.legendItem}>
            <div style={{ ...styles.legendDot, background: s.stroke, boxShadow: `0 0 6px ${s.stroke}` }} />
            <div style={styles.legendText}>
              <span style={styles.legendClass}>{cls}</span>
              <span style={styles.legendSub}>{s.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const styles: Record<string, React.CSSProperties> = {
  panel: {
    background: '#141414',
    border: '1px solid #252525',
    borderRadius: 8,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '11px 16px',
    borderBottom: '1px solid #252525',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.65rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: '#c0c0c0',           // was #555
    fontWeight: 600,
  },
  countBadge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  list: {
    padding: 8,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    minHeight: 72,
  },
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 0',
    gap: 6,
    color: '#606060',           // was #333
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.75rem',
  },
  emptyIcon: { fontSize: '1.3rem' },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '9px 12px',
    borderRadius: 5,
    borderLeft: '3px solid',
    animation: 'slideIn 0.2s ease both',
  },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  className: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#e8e8e8',           // explicit bright color so it's always readable
  },
  conf: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.74rem',
    fontWeight: 700,
  },
  legendList: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 13,
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 12 },
  legendDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  legendText: { display: 'flex', flexDirection: 'column' as const, gap: 2 },
  legendClass: {
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#e8e8e8',           // was implicit default — now bright
  },
  legendSub: {
    fontSize: '0.7rem',
    color: '#909090',           // was #555 — now readable
  },
};

export default DetectionList;