import {clamp,EASE} from './math.js';

// Fade early during the return shot; the final hero is silent.
export function sceneAudioGain(mode,phase){
  return mode==='F'?1-EASE.io(clamp((phase-.46)/.24)):1;
}

// A RAF timestamp can precede performance.now() sampled inside the same frame.
export function nextAudioVolume(current,target,elapsed){
  const dt=clamp(elapsed,0,.1);
  return clamp(current+(target-current)*(1-Math.exp(-dt*2.5)));
}
