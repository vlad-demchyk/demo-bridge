import {clamp,EASE} from './math.js';

/** The world always covers the viewport; cinema bars only mask it. */
export function sceneViewport(w,h,iw=1600,ih=1000,horizon=.365){
  const k=Math.max(w/iw,h/ih),dw=iw*k,dh=ih*k,ix0=(w-dw)/2,iy0=(h-dh)/2;
  const band=Math.max(60,h*.08),available=Math.max(1,h-band*2);
  const filmHeight=w/available<1.25?h:Math.min(available,w/1.6);
  const top=Math.round((h-filmHeight)/2),bottom=h-top-Math.round(filmHeight);
  return{frame:{x:0,y:0,w,h},bars:{top,bottom},cover:{dw,dh,ix0,iy0},focal:Math.max(w,h*1.2)*.75,cx:w/2,cy:iy0+horizon*dh};
}

/** Reveal the full canvas continuously as the final hero arrives. */
export function filmReveal(progress){return EASE.io(clamp((progress-.70)/.14));}