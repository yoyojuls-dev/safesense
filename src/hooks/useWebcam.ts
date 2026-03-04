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

// ── Lerp detection boxes smoothly ────────────────────────────────────────────
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

// ── Pick best camera without opening a temp stream ────────────────────────────
// Uses the stream we already opened so we don't double-initialize the camera.
function pickBestDevice(devices: MediaDeviceInfo[]): string | undefined {
  const video = devices.filter(d => d.kind === 'videoinput');
  if (video.length === 0) return undefined;
  if (video.length === 1) return video[0].deviceId;

  const builtIn   = /facetime|integrated|built.?in|isight|front|back|rear|internal/i;
  const external  = /usb|external|webcam|capture|logitech|razer|elgato|cam.?link|hdmi|brio|c\d{3,4}/i;

  const explicit  = video.find(d => external.test(d.label));
  if (explicit) return explicit.deviceId;

  const notBuiltIn = video.find(d => !builtIn.test(d.label));
  if (notBuiltIn) return notBuiltIn.deviceId;

  // Last device is usually external when labels are not descriptive
  return video[video.length - 1].deviceId;
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
  // Lazy offscreen canvas — created once when needed
  const inferCanvasRef   = useRef<HTMLCanvasElement | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const rafRef           = useRef<number>(0);
  const inferBusyRef     = useRef(false);
  const inferReadyRef    = useRef(false);   // delays inference until video is warm
  const lastLogTimeRef   = useRef<number>(0);
  const inferIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warmupTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDetsRef      = useRef<Detection[]>([]);
  const targetDetsRef    = useRef<Detection[]>([]);
  const interpTRef       = useRef<number>(1);
  const fpsCounterRef    = useRef({ frames: 0, last: performance.now() });
  const mirroredRef      = useRef(mirrored);
  // Cache offscreen canvas size to avoid resizing every tick
  const offscreenSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => { mirroredRef.current = mirrored; }, [mirrored]);

  const [isActive,    setIsActive]    = useState(false);
  const [fps,         setFps]         = useState(0);
  const [error,       setError]       = useState<string | null>(null);
  const [cameraLabel, setCameraLabel] = useState<string>('');

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (warmupTimerRef.current)   clearTimeout(warmupTimerRef.current);
    if (inferIntervalRef.current) clearInterval(inferIntervalRef.current);
    if (rafRef.current)           cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current      = null;
    inferReadyRef.current  = false;
    inferBusyRef.current   = false;
    offscreenSizeRef.current = { w: 0, h: 0 };
    setIsActive(false);
    setFps(0);
    setCameraLabel('');
    prevDetsRef.current   = [];
    targetDetsRef.current = [];
    onDetections([]);
  }, [onDetections]);

  // ── Start ──────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null);
    try {
      // Step 1: open with default constraints first — fast, no label lookup needed
      const initialStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { ideal: 1280 },
          height:    { ideal: 720  },
          frameRate: { ideal: 30, min: 15 },  // start at 30fps — less GPU pressure on warmup
        },
      });

      // Step 2: now that we have permission, enumerate devices (labels are populated)
      const devices  = await navigator.mediaDevices.enumerateDevices();
      const bestId   = pickBestDevice(devices);
      const currentId = initialStream.getVideoTracks()[0]
        .getSettings().deviceId;

      let finalStream = initialStream;

      // Step 3: if a better camera exists and it's not already selected, switch
      if (bestId && bestId !== currentId) {
        initialStream.getTracks().forEach(t => t.stop());
        finalStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId:  { exact: bestId },
            width:     { ideal: 1280 },
            height:    { ideal: 720  },
            frameRate: { ideal: 30, min: 15 },
          },
        });
      }

      streamRef.current = finalStream;
      const video = videoRef.current!;
      video.srcObject = finalStream;
      await video.play();

      const track = finalStream.getVideoTracks()[0];
      setCameraLabel(track.label || 'Camera');
      console.log('[SAFESENSE] Camera started:', track.label, track.getSettings());

      setIsActive(true);

      // Step 4: delay inference start by 1.5s so the render loop gets smooth first
      warmupTimerRef.current = setTimeout(() => {
        inferReadyRef.current = true;
      }, 1500);

    } catch (err) {
      console.error('[SAFESENSE] Camera error:', err);
      setError('Camera access denied or unavailable.');
    }
  }, []);

  // ── Watch for device plug/unplug ───────────────────────────────────────────
  useEffect(() => {
    const handleDeviceChange = async () => {
      if (!streamRef.current) return;
      const devices      = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const currentTrack = streamRef.current.getVideoTracks()[0];
      const currentLabel = currentTrack?.label ?? '';

      const external  = /usb|external|webcam|capture|logitech|razer|elgato|cam.?link|hdmi|brio|c\d{3,4}/i;
      const builtIn   = /facetime|integrated|built.?in|isight|front|back|rear|internal/i;
      const newExt    = videoDevices.find(d => external.test(d.label) && d.label !== currentLabel);

      if (newExt && builtIn.test(currentLabel)) {
        console.log('[SAFESENSE] External camera plugged in, switching...');
        stop();
        setTimeout(() => start(), 500);
      } else if (videoDevices.length === 0) {
        stop();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, [stop, start]);

  // ── Render loop — 60fps, draws video + lerped boxes ───────────────────────
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

      if (mirroredRef.current) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, W, H);
        ctx.restore();
      } else {
        ctx.drawImage(video, 0, 0, W, H);
      }

      interpTRef.current = Math.min(1, interpTRef.current + 0.25);
      const smoothed = lerpDetections(prevDetsRef.current, targetDetsRef.current, interpTRef.current);

      if (smoothed.length > 0) {
        if (mirroredRef.current) {
          drawDetections(ctx, smoothed.map(d => ({ ...d, x1: W - d.x2, x2: W - d.x1 })));
        } else {
          drawDetections(ctx, smoothed);
        }
      }

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
      video.addEventListener('canplay', () => {
        rafRef.current = requestAnimationFrame(render);
      }, { once: true });
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isActive]);

  // ── Inference loop — starts after warmup delay ────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    const video = videoRef.current!;
    let demoTick = 0;

    const runDetection = async () => {
      // Don't infer until warmup period is over
      if (!inferReadyRef.current) return;
      if (inferBusyRef.current || !streamRef.current || video.readyState < 3) return;
      inferBusyRef.current = true;

      // Lazy-create offscreen canvas once
      if (!inferCanvasRef.current) {
        inferCanvasRef.current = document.createElement('canvas');
      }
      const offscreen = inferCanvasRef.current;

      // Only resize offscreen canvas if video dimensions changed
      const vw = video.videoWidth  || 1280;
      const vh = video.videoHeight || 720;
      if (offscreenSizeRef.current.w !== vw || offscreenSizeRef.current.h !== vh) {
        offscreen.width  = vw;
        offscreen.height = vh;
        offscreenSizeRef.current = { w: vw, h: vh };
      }

      const octx = offscreen.getContext('2d', { alpha: false })!;
      octx.drawImage(video, 0, 0, vw, vh);

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

      // Thumbnail for log — throttled to 3s
      let thumbnail: string | undefined;
      const now = Date.now();
      if (dets.length > 0 && (now - lastLogTimeRef.current > 3000)) {
        lastLogTimeRef.current = now;
        thumbnail = dc.toDataURL('image/jpeg', 0.75);
      }

      onDetections(dets, thumbnail);
      inferBusyRef.current = false;
    };

    // 200ms interval — slightly relaxed to keep render loop smooth
    inferIntervalRef.current = setInterval(runDetection, 200);
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