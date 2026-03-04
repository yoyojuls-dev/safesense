import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Detection } from '../types';
import {
  runInference,
  drawDetections,
  generateMockDetections,
  attachDebugHelper,
} from '../utils/detection';

interface ImageDetectorProps {
  model: tf.GraphModel | null;
  isDemoMode: boolean;
  confidenceThreshold: number;
  onDetections: (dets: Detection[], thumbnail?: string) => void;
}

const ImageDetector: React.FC<ImageDetectorProps> = ({
  model,
  isDemoMode,
  confidenceThreshold,
  onDetections,
}) => {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  // Track whether this analysis was triggered by a new file (true) or slider change (false)
  const isNewFileRef = useRef(false);

  const [isDragOver,   setIsDragOver]   = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasImage,     setHasImage]     = useState(false);

  const analyzeImage = useCallback(
    async (img: HTMLImageElement, newFile: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setIsProcessing(true);

      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      let dets: Detection[] = [];

      if (model) {
        try {
          attachDebugHelper(model, canvas);
          dets = await runInference(model, canvas, confidenceThreshold, canvas.width, canvas.height);
        } catch (err) {
          console.error('[SAFESENSE] Image inference error:', err);
        }
      } else if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 400));
        dets = generateMockDetections(canvas.width, canvas.height);
      }

      // Redraw clean image then overlay boxes
      ctx.drawImage(img, 0, 0);
      drawDetections(ctx, dets);
      setHasImage(true);
      setIsProcessing(false);

      // Only log a new entry when it's a fresh file upload with detections
      const thumbnail = newFile && dets.length > 0
        ? canvas.toDataURL('image/jpeg', 0.82)
        : undefined;

      onDetections(dets, thumbnail);
    },
    [model, isDemoMode, confidenceThreshold, onDetections],
  );

  // Re-run on threshold change (slider move) — not a new log entry
  useEffect(() => {
    if (loadedImgRef.current && hasImage) {
      analyzeImage(loadedImgRef.current, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confidenceThreshold]);

  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          loadedImgRef.current = img;
          analyzeImage(img, true);  // new file → log entry
        };
        img.src = e.target!.result as string;
      };
      reader.readAsDataURL(file);
    },
    [analyzeImage],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    loadedImgRef.current = null;
    isNewFileRef.current = false;
    setHasImage(false);
    onDetections([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadResult = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `safesense_result_${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div style={styles.wrapper}>
      <style>{`
        @media (max-width: 600px) {
          .ss-dropzone { min-height: 260px !important; }
          .ss-controls-btn { font-size: 0.62rem !important; padding: 10px 0 !important; }
        }
      `}</style>
      <div
        className="ss-dropzone"
        style={{
          ...styles.dropZone,
          borderColor: isDragOver ? '#ff2020' : '#252525',
          background:  isDragOver ? '#130808' : '#0d0d0d',
          cursor: hasImage ? 'default' : 'pointer',
        }}
        onClick={() => !hasImage && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          style={{ ...styles.canvas, display: hasImage ? 'block' : 'none' }}
        />

        {!hasImage && !isProcessing && (
          <div style={styles.placeholder}>
            <div style={styles.uploadIcon}>↑</div>
            <div style={styles.uploadTitle}>Drop image or click to upload</div>
            <div style={styles.uploadSub}>JPG · PNG · WEBP · BMP</div>
          </div>
        )}

        {isProcessing && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner} />
            <span style={styles.loadingText}>ANALYZING...</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}
      />

      <div style={styles.controls}>
        <button style={styles.btnPrimary} onClick={() => fileInputRef.current?.click()}>
          Upload Image
        </button>
        {hasImage && (
          <>
            <button style={styles.btn} onClick={downloadResult}>Save Result</button>
            <button style={styles.btn} onClick={clear}>Clear</button>
          </>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper:  { display: 'flex', flexDirection: 'column', gap: 12 },
  dropZone: {
    position: 'relative', minHeight: 420,
    border: '2px dashed', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', transition: 'border-color 0.2s, background 0.2s',
  },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' },
  placeholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, userSelect: 'none' },
  uploadIcon:  { fontSize: '2.5rem', color: '#666' },
  uploadTitle: { fontFamily: "'Space Mono', monospace", fontSize: '0.78rem', color: '#a0a0a0' },
  uploadSub:   { fontFamily: "'Space Mono', monospace", fontSize: '0.62rem', color: '#707070', letterSpacing: '0.12em' },
  loadingOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.88)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 14, zIndex: 5,
  },
  spinner: {
    width: 34, height: 34, border: '2px solid #222',
    borderTopColor: '#ff2020', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
  loadingText: { fontFamily: "'Space Mono', monospace", fontSize: '0.7rem', color: '#888', letterSpacing: '0.14em' },
  controls:   { display: 'flex', gap: 10 },
  btnPrimary: {
    flex: 1, padding: '11px 0', background: '#ff2020', border: 'none', borderRadius: 5,
    color: '#fff', fontFamily: "'Space Mono', monospace", fontSize: '0.7rem',
    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
  },
  btn: {
    flex: 1, padding: '11px 0', background: '#141414', border: '1px solid #252525', borderRadius: 5,
    color: '#aaa', fontFamily: "'Space Mono', monospace", fontSize: '0.7rem',
    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
  },
};

export default ImageDetector;