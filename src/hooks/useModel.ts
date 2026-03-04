import { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import { ModelStatus, MODEL_URL } from '../types';

interface UseModelReturn {
  model: tf.GraphModel | null;
  status: ModelStatus;
  backend: string;
  loadProgress: number;
}

export function useModel(): UseModelReturn {
  const modelRef = useRef<tf.GraphModel | null>(null);
  const [status, setStatus] = useState<ModelStatus>('idle');
  const [backend, setBackend] = useState<string>('—');
  const [loadProgress, setLoadProgress] = useState(0);

  const load = useCallback(async () => {
    setStatus('loading');
    setLoadProgress(10);

    try {
      // Animate progress while loading
      const progressInterval = setInterval(() => {
        setLoadProgress((p) => Math.min(p + 5, 85));
      }, 300);

      const loaded = await tf.loadGraphModel(MODEL_URL);

      clearInterval(progressInterval);
      setLoadProgress(100);

      modelRef.current = loaded;
      setStatus('ready');
      setBackend(tf.getBackend() || 'cpu');
    } catch (err) {
      console.warn('[SAFESENSE] Model not found — running in demo mode.', err);
      setStatus('demo');
      setBackend('demo');
      setLoadProgress(100);
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (modelRef.current) {
        modelRef.current.dispose();
      }
    };
  }, [load]);

  return {
    model: modelRef.current,
    status,
    backend,
    loadProgress,
  };
}