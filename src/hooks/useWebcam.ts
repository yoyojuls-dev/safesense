import { useRef, useState, useCallback, useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { Detection } from '../types';
import {
  runInference,
  drawDetections,
  generateMockDetections,
  attachDebugHelper,
} from '../utils/detection';

interface UseWebcamOptions {
  model: tf.GraphModel | null;
  isDemoMode: boolean;
  confidenceThreshold: number;
  mirrored: boolean;
  onDetections: (dets: Detection[], thumbnail?: string) => void;
}

interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isActive: boolean;
  fps: number;
  start: () => Promise<void>;
  stop: () => void;
  takeScreenshot: () => void;
  error: string | null;
  cameraLabel: string;
}

// Smooth lerp — slides detection boxes from previous position toward new one
function lerpDetections(prev: Detection[], next: Detection[], t: number): Detection[] {
  const used = new Set<number>();
  return next.map((n) => {
    let bestIdx = -1, bestDist = Infinity;
    prev.forEach((p, i) => {
      if (used.has(i) || p.className !== n.className) return;
      const d = Math.hypot(
        (p.x1 + p.x2) / 2 - (n.x1 + n.x2) / 2,
        (p.y1 + p.y2) / 2 - (n.y1 + n.y2) / 2,
      );
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx === -1) return n;
    const p = prev[bestIdx];
    used.add(bestIdx);
    return {
      ...n,
      x1: p.x1 + (n.x1 - p.x1) * t,
      y1: p.y1 + (n.y1 - p.y1) * t,
      x2: p.x2 + (n.x2 - p.x2) * t,
      y2: p.y2 + (n.y2 - p.y2) * t,
    };
  });
}

export function useWebcam({
  model,
  isDemoMode,
  confidenceThreshold,
  mirrored,
  onDetections,
}: UseWebcamOptions): UseWebcamReturn {
  const videoRef         = useRef<HTMLVideoElement>(null);
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const inferCanvasRef   = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const streamRef        = useRef<MediaStream | null>(null);
  const rafRef           = useRef<number>(0);
  const inferBusyRef     = useRef(false);
  const lastLogTimeRef   = useRef<number>(0);
  const inferIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevDetsRef      = useRef<Detection[]>([]);
  const targetDetsRef    = useRef<Detection[]>([]);
  const interpTRef       = useRef<number>(1);
  const fpsCounterRef    = useRef({ frames: 0, last: performance.now() });
  const mirroredRef      = useRef(mirrored);

  // Keep mirroredRef in sync without restarting loops
  useEffect(() => { mirroredRef.current = mirrored; }, [mirrored]);

  const [isActive,     setIsActive]     = useState(false);
  const [fps,          setFps]          = useState(0);
  const [error,        setError]        = useState<string | null>(null);
  const [cameraLabel,  setCameraLabel]  = useState<string>('');

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (inferIntervalRef.current) clearInterval(inferIntervalRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsActive(false);
    setFps(0);
    setCameraLabel('');
    prevDetsRef.current   = [];
    targetDetsRef.current = [];
    onDetections([]);
  }, [onDetections]);

  // ── Pick best camera: prefer external (USB), fall back to default ─────────
  const getBestDeviceId = async (): Promise<string | undefined> => {
    try {
      // Must request permission first so labels are populated
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');

      if (videoDevices.length === 0) return undefined;

      // Heuristics to detect external/USB cameras:
      // - More than one camera → last one is usually the external one
      // - Label contains keywords like "USB", "external", "webcam", "capture"
      // - Built-in cameras typically have "facetime", "integrated", "built-in", "isight" in label
      const builtInKeywords = /facetime|integrated|built.?in|isight|front|back|rear|internal/i;
      const externalKeywords = /usb|external|webcam|capture|logitech|razer|elgato|cam link|hdmi|brio|c\d{3}|c\d{4}/i;

      // First try: explicit external keyword match
      const explicit = videoDevices.find(d => externalKeywords.test(d.label));
      if (explicit) {
        console.log('[SAFESENSE] External camera detected:', explicit.label);
        return explicit.deviceId;
      }

      // Second try: if multiple cameras, prefer any that is NOT built-in
      if (videoDevices.length > 1) {
        const notBuiltIn = videoDevices.find(d => !builtInKeywords.test(d.label));
        if (notBuiltIn) {
          console.log('[SAFESENSE] Non-built-in camera selected:', notBuiltIn.label || notBuiltIn.deviceId);
          return notBuiltIn.deviceId;
        }
        // Fall back to last device (external cameras are usually listed after built-in)
        const last = videoDevices[videoDevices.length - 1];
        console.log('[SAFESENSE] Falling back to last camera:', last.label || last.deviceId);
        return last.deviceId;
      }

      // Only one camera — use it
      console.log('[SAFESENSE] Single camera found:', videoDevices[0].label || 'default');
      return videoDevices[0].deviceId;
    } catch {
      return undefined; // permission denied or no devices — let getUserMedia handle it
    }
  };

  // ── Start ──────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null);
    try {
      const deviceId = await getBestDeviceId();
      const videoConstraints: MediaTrackConstraints = {
        width:     { ideal: 1280 },
        height:    { ideal: 720  },
        frameRate: { ideal: 60, min: 24 },
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setIsActive(true);

      // Log which camera ended up being used
      const track = stream.getVideoTracks()[0];
      setCameraLabel(track.label || 'Camera');
      console.log('[SAFESENSE] Camera started:', track.label, track.getSettings());
    } catch (err) {
      console.error('[SAFESENSE] Camera error:', err);
      setError('Camera access denied or unavailable.');
    }
  }, []);

  // ── Watch for device changes (plug/unplug) while camera is running ─────────
  useEffect(() => {
    const handleDeviceChange = async () => {
      if (!streamRef.current) return; // camera not running, ignore

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const currentTrack = streamRef.current.getVideoTracks()[0];
      const currentLabel = currentTrack?.label ?? '';

      // Check if a new external camera was plugged in
      const externalKeywords = /usb|external|webcam|capture|logitech|razer|elgato|cam link|hdmi|brio|c\d{3}|c\d{4}/i;
      const builtInKeywords  = /facetime|integrated|built.?in|isight|front|back|rear|internal/i;

      const newExternal = videoDevices.find(
        d => externalKeywords.test(d.label) && !d.label.includes(currentLabel)
      );
      const currentIsBuiltIn = builtInKeywords.test(currentLabel);

      if (newExternal && currentIsBuiltIn) {
        // An external camera was plugged in while using built-in — switch automatically
        console.log('[SAFESENSE] External camera plugged in, switching...');
        stop();
        setTimeout(() => start(), 300); // brief delay for OS to initialize device
      } else if (videoDevices.length === 0) {
        stop();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [stop, start]);

  // ── Render loop — native rAF, 60fps video + interpolated boxes ────────────
  useEffect(() => {
    if (!isActive) return;
    const video  = videoRef.current!;
    const canvas = canvasRef.current!;

    const setSize = () => {
      canvas.width  = video.videoWidth  || 1280;
      canvas.height = video.videoHeight || 720;
    };
    if (video.readyState >= 1) setSize();
    else video.addEventListener('loadedmetadata', setSize, { once: true });

    const render = () => {
      if (!streamRef.current) return;
      const ctx = canvas.getContext('2d', { alpha: false })!;
      const W = canvas.width, H = canvas.height;

      // Draw video — apply mirror by flipping canvas transform
      if (mirroredRef.current) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, W, H);
      }

      // Advance lerp — 0.25 per frame = ~4 frames to fully arrive (smooth but fast)
      interpTRef.current = Math.min(1, interpTRef.current + 0.25);
      const smoothed = lerpDetections(prevDetsRef.current, targetDetsRef.current, interpTRef.current);

      // Mirror detection coords when flipped so boxes stay on the right objects
      if (smoothed.length > 0) {
        if (mirroredRef.current) {
          const flipped = smoothed.map(d => ({
            ...d,
            x1: W - d.x2,
            x2: W - d.x1,
          }));
          drawDetections(ctx, flipped);
        } else {
          drawDetections(ctx, smoothed);
        }
      }

      // FPS counter
      const ctr = fpsCounterRef.current;
      ctr.frames++;
      const now = performance.now();
      if (now - ctr.last >= 1000) {
        setFps(ctr.frames);
        ctr.frames = 0;
        ctr.last   = now;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    if (video.readyState >= 3) {
      rafRef.current = requestAnimationFrame(render);
    } else {
      video.addEventListener('canplay', () => { rafRef.current = requestAnimationFrame(render); }, { once: true });
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive]);

  // ── Inference loop — every 120ms, decoupled from render ───────────────────
  useEffect(() => {
    if (!isActive) return;
    const video     = videoRef.current!;
    const offscreen = inferCanvasRef.current;
    let demoTick    = 0;

    const runDetection = async () => {
      if (inferBusyRef.current || !streamRef.current || video.readyState < 3) return;
      inferBusyRef.current = true;

      offscreen.width  = video.videoWidth  || 1280;
      offscreen.height = video.videoHeight || 720;
      const octx = offscreen.getContext('2d', { alpha: false })!;

      // Always feed un-mirrored frame to the model (mirrors are cosmetic only)
      octx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

      if (model && !((window as unknown) as Record<string, unknown>)['__ssDebug']) {
        attachDebugHelper(model, offscreen);
      }

      let dets: Detection[] = [];
      const dc = canvasRef.current!;

      if (model) {
        try {
          dets = await runInference(model, offscreen, confidenceThreshold, dc.width, dc.height);
        } catch {
          dets = targetDetsRef.current;
        }
      } else if (isDemoMode) {
        demoTick++;
        dets = demoTick % 10 === 0
          ? generateMockDetections(dc.width, dc.height, 1)
          : targetDetsRef.current;
      }

      prevDetsRef.current   = lerpDetections(prevDetsRef.current, targetDetsRef.current, interpTRef.current);
      targetDetsRef.current = dets;
      interpTRef.current    = 0;

      // Capture thumbnail for log — only when new detections appear, throttled to 3s
      let thumbnail: string | undefined;
      const now = Date.now();
      if (dets.length > 0 && targetDetsRef.current.length === 0 || 
          (dets.length > 0 && now - lastLogTimeRef.current > 3000)) {
        lastLogTimeRef.current = now;
        thumbnail = dc.toDataURL('image/jpeg', 0.75);
      }

      onDetections(dets, thumbnail);
      inferBusyRef.current  = false;
    };

    inferIntervalRef.current = setInterval(runDetection, 120);
    return () => { if (inferIntervalRef.current) clearInterval(inferIntervalRef.current); };
  }, [isActive, model, isDemoMode, confidenceThreshold, onDetections]);

  useEffect(() => () => stop(), [stop]);

  const takeScreenshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/jpeg', 0.92);
    a.download = `safesense_${Date.now()}.jpg`;
    a.click();
  }, []);

  return { videoRef, canvasRef, isActive, fps, start, stop, takeScreenshot, error, cameraLabel };
}