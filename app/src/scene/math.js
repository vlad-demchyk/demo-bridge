/* Small numeric helpers shared by the scene. */
export const FONT='"Noto Sans","Segoe UI",system-ui,sans-serif';
export const ACCENT_FONT='"Martian Mono","Noto Sans",sans-serif';
export const MONO='"JetBrains Mono",ui-monospace,Consolas,monospace';
export const TAU=Math.PI*2;
export const clamp=(v,a=0,b=1)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const EASE={io:t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,in:t=>t*t*t,out:t=>1-Math.pow(1-t,3)};
export const EASE_ID={io:0,in:1,out:2};
export function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export const WARM=[255,125,64],COOL=[100,213,255];
// The built world retains its previous warm palette independently of text/UI.
export const SCENE_WARM=[255,64,31];
export const colU=u=>{const middle=[255,245,228],a=u<.5?SCENE_WARM:middle,b=u<.5?middle:COOL,t=u<.5?u*2:(u-.5)*2;return a.map((v,i)=>lerp(v,b[i],t));};

