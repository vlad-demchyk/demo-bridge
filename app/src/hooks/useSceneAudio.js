import {useCallback,useEffect,useRef,useState} from 'react';
import {createSpaceWind} from '../scene/wind.js';
import {nextAudioVolume} from '../scene/audio.js';


// Only the explicit Watch action arms music; other clicks and scrolling are silent.
export function useSceneAudio({src,volume=.08}) {
  const wind=useRef(null);
  const ensureWind=useCallback(()=>{
    try{if(!wind.current)wind.current=createSpaceWind();wind.current?.resume();}catch{/* Music can play without Web Audio. */}
  },[]);
  const setWind=useCallback(intensity=>{
    const allowed=armed.current&&!mutedRef.current&&!document.hidden&&media.current&&!media.current.paused;
    wind.current?.setIntensity(allowed?intensity:0);
  },[]);
  const setBurst=useCallback(intensity=>{
    const allowed=armed.current&&!mutedRef.current&&!document.hidden&&media.current&&!media.current.paused;
    wind.current?.setBurst(allowed?intensity:0);
  },[]);
  const media=useRef(null),mutedRef=useRef(false),armed=useRef(false);
  const gain=useRef(1),fade=useRef(0),baseVolume=useRef(volume),resume=useRef(()=>{}),fadeStart=useRef(0);
  const [muted,setMuted]=useState(mutedRef.current),[playing,setPlaying]=useState(false);
  baseVolume.current=volume;
  const setGain=useCallback(value=>{
    const next=Math.max(0,Math.min(1,value)),previousGain=gain.current;
    if(next===previousGain&&fadeStart.current===0)return;
    gain.current=next;
    if(previousGain===0&&next>0)resume.current();
    if(fade.current||!media.current)return;
    let previous=performance.now();
    const step=now=>{
      const audio=media.current;
      if(!audio){fade.current=0;return;}
      const entry=fadeStart.current?Math.max(0,Math.min(1,(now-fadeStart.current)/4000)):1;
      const smoothEntry=entry*entry*(3-2*entry);
      const target=baseVolume.current*gain.current*smoothEntry;
      const dt=Math.max(0,Math.min(.1,(now-previous)/1000));previous=now;
      const nextVolume=nextAudioVolume(audio.volume,target,dt);
      if(entry>=1&&Math.abs(nextVolume-target)<.0001){
        audio.volume=target;fade.current=0;fadeStart.current=0;
        if(target===0)audio.pause();
      }else{audio.volume=Math.max(0,Math.min(1,nextVolume));fade.current=requestAnimationFrame(step);}
    };
    fade.current=requestAnimationFrame(step);
  },[]);
  useEffect(()=>{
    const audio=media.current;if(!audio)return;
    audio.src=src;audio.loop=true;audio.volume=0;
    audio.muted=mutedRef.current;audio.preload='auto';
    let disposed=false;
    const start=()=>{
      if(disposed||!armed.current||mutedRef.current||document.hidden||gain.current===0||!audio.paused)return;
      audio.volume=0;fadeStart.current=performance.now();
      audio.play().then(()=>{setGain(gain.current);}).catch(()=>{fadeStart.current=0;});
    };
    resume.current=start;
    const sync=()=>{if(!disposed)setPlaying(!audio.paused);};
    audio.addEventListener('play',sync);audio.addEventListener('pause',sync);audio.addEventListener('volumechange',sync);
    const visibility=()=>{if(document.hidden){audio.pause();wind.current?.suspend();}else{start();wind.current?.resume();}};
    document.addEventListener('visibilitychange',visibility);
    return()=>{
      disposed=true;resume.current=()=>{};
      audio.removeEventListener('play',sync);audio.removeEventListener('pause',sync);audio.removeEventListener('volumechange',sync);
      cancelAnimationFrame(fade.current);fade.current=0;
      document.removeEventListener('visibilitychange',visibility);
      audio.pause();audio.removeAttribute('src');audio.load();
      wind.current?.destroy();wind.current=null;
    };
  },[src,volume,setGain,ensureWind]);
  const startMusic=useCallback(()=>{
    armed.current=true;resume.current();
    ensureWind();
  },[ensureWind]);
  const toggleSound=useCallback(()=>{
    const audio=media.current;
    // Before first playback or after a blocked attempt, this button explicitly starts sound.
    const next=!mutedRef.current;
    mutedRef.current=next;setMuted(next);
    wind.current?.setMuted(next);
    if(audio){audio.muted=next;if(!next){armed.current=true;resume.current();}}
  },[]);
  return{mediaRef:media,soundOn:playing&&!muted,showSound:playing,toggleSound,setGain,setWind,setBurst,startMusic};
}
