import {useEffect, useRef} from 'react';
import {createMistScene} from '../scene/engine.js';

/**
 * Starts the scene once the DOM it drives is mounted, and tears it down on unmount.
 * refs: {container, stage, canvas, fx, finale, heroFinal, meter} (React refs)
 * Returns a ref to the engine API: play, stop, isPlaying, skipToHero, seekCheckpoint, captureFrame, refresh, setPaused, setReducedMotion.
 */
export function useMistScene(refs, {image, reducedMotion, playSeconds, onPlayState,onAudioLevel,onWind,onBurst} = {}) {
  const playCb = useRef(onPlayState);
  playCb.current = onPlayState;
  const audioCb=useRef(onAudioLevel);audioCb.current=onAudioLevel;
  const windCb=useRef(onWind);windCb.current=onWind;
  const burstCb=useRef(onBurst);burstCb.current=onBurst;
  const api = useRef(null);
  useEffect(() => {
    const el = k => refs[k].current;
    if (!el('container') || !el('canvas')) return undefined;
    const scene = createMistScene({
      container: el('container'), stage: el('stage'), canvas: el('canvas'), fx: el('fx'),
      finale: el('finale'), heroFinal: el('heroFinal'), meter: el('meter'),
      image, reducedMotion, playSeconds,
      onPlayState: on => playCb.current && playCb.current(on),
      onAudioLevel:gain=>audioCb.current?.(gain),
      onWind:intensity=>windCb.current?.(intensity),
      onBurst:intensity=>burstCb.current?.(intensity)
    });
    api.current = scene;
    /* in development the API is reachable from the console, e.g. to export the lettered frame:
       await mistScene.captureFrame() */
    if (import.meta.env.DEV) window.mistScene = scene;
    return () => { scene.destroy(); api.current = null; if (window.mistScene === scene) delete window.mistScene; };
    /* the scene is built once per mount; texts and images are read at start */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return api;
}
