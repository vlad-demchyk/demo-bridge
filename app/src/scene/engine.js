/* The scene engine: one WebGL2 world of letters that the page scrolls through.
   createMistScene() takes the DOM elements rendered by the framework and drives them from the scroll position.
   Phases of the finale (progress Pf 0..1): magnet .00-.08, burst .08-.22, entry and walk .25-.46,
   return to the frontal frame .46-.56, detail .50-.70, hero text .72+. */
import {FONT,ACCENT_FONT,MONO,TAU,clamp,lerp,EASE,EASE_ID,rng,WARM,SCENE_WARM,COOL,colU} from './math.js';
import * as glc from './gl.js';
import {sceneAudioGain} from './audio.js';
import {sceneWindIntensity,sceneExplosionIntensity} from './wind.js';
import {VS_POINTS,FS_POINTS,VS_WORDS,VS_OCC,FS_OCC,FS_WORDS,L_PART,L_WORD} from './shaders.js';

import {lookAt,C,camQ} from './camera.js';
import {sceneViewport,filmReveal} from './viewport.js';
import {checkpointTimeline,meterProgress,bridgeMeterGeometry,pairPlaybackRate,sceneFinaleProgress,SCENE_NAV_END,SCENE_HANDOFF_START,WORLD_FORMED_PROGRESS,sceneHandoff,SCENE_EXIT_HOLD,sceneTravel} from './progress.js';
import {IMGCFG as DEFAULT_IMGCFG} from './config.js';



/**
 * @param {object} opts
 * @param {HTMLElement} opts.container  element that holds the .pair sections and .cap captions
 * @param {HTMLElement} opts.stage      fixed full-screen wrapper of the two canvases
 * @param {HTMLCanvasElement} opts.canvas WebGL canvas
 * @param {HTMLCanvasElement} opts.fx     2D overlay canvas (glow, flash, pulses)
 * @param {HTMLElement} opts.finale     the tall finale section
 * @param {HTMLElement} opts.heroFinal  hero block inside the finale (text lands on it)
 * @param {HTMLElement} [opts.meter]    interactive bridge progress through the pre-burst checkpoint

 * @param {object} [opts.image] illustration settings (src, deck, horizon).
 * @param {boolean} [opts.reducedMotion] force reduced motion (default: the OS setting)
 * @param {number} [opts.playSeconds]  length of the autoplay from the top to the hero (default 48)
 * @param {(playing:boolean)=>void} [opts.onPlayState] called when autoplay starts or stops
 */
export function createMistScene(opts){
/* ---------- elements and options ---------- */
const {stage,canvas:cvG,fx:cvF,finale,heroFinal,meter=null}=opts;
const pairs=[...opts.container.querySelectorAll('.pair')];
let caps=[...opts.container.querySelectorAll('.cap')];
const meterNodes=meter?[...meter.querySelectorAll('[data-checkpoint]')]:[];
const filmControls=document.querySelector('.film-ctrls');
const meterCables=meter?[...meter.querySelectorAll('[data-meter-cable]')]:[];
const meterDecks=meter?[...meter.querySelectorAll('[data-meter-deck]')]:[];
const meterHangers=meter?[...meter.querySelectorAll('[data-meter-hanger]')]:[];
const meterReveal=meter?.querySelector('[data-meter-reveal]');
const root=opts.root||document.documentElement;
const fctx=cvF.getContext('2d');
const mq=matchMedia('(prefers-reduced-motion: reduce)');
let reduced=opts.reducedMotion??mq.matches,paused=false;
let Ys=scrollY,Yv=0,first=true;

function applyMotion(){root.classList.toggle('rm',reduced);}
const onMq=()=>{if(opts.reducedMotion==null){reduced=mq.matches;applyMotion();}};
mq.addEventListener('change',onMq);

const SRC={q:[],a:[]};
pairs.forEach((sec,k)=>sec.querySelectorAll('[data-role]').forEach(el=>{
  el.querySelectorAll('.w').forEach(sp=>{const accent=sp.classList.contains('acc'),raw=sp.textContent.replace(/[.,?!:;«»"()…]/g,''),w=accent?raw.toLocaleUpperCase('uk-UA'):raw;if(w)SRC[el.dataset.role].push({w,key:(accent?'accent:':'text:')+w,accent,k,el:sp});});
}));
/* where a word stands inside its sticky pair frame (layout only, without the fly-in transforms) */
function wordSpot(sp){let x=0,y=0,e=sp;while(e&&!e.classList.contains('pair-in')){x+=e.offsetLeft;y+=e.offsetTop;e=e.offsetParent;}
  return{x:x+sp.offsetWidth/2,y:y+sp.offsetHeight/2,fs:parseFloat(getComputedStyle(sp).fontSize)||24};}

/* ---------- timeline (scroll positions of sections) ---------- */
const T={qStart:1,qEnd:2,finTop:2,finLen:1,bounds:[],checkpoints:[],lock:[2,2,2,2,2,2],seam:[]};
function measure(){
  const sy=scrollY,vh=innerHeight;
  T.qStart=pairs[0].getBoundingClientRect().top+sy;
  T.finTop=finale.getBoundingClientRect().top+sy;
  T.qEnd=T.finTop;
  T.bounds=pairs.map(p=>({top:p.getBoundingClientRect().top+sy,height:p.offsetHeight}));
  T.finLen=sceneTravel(finale.offsetHeight,vh);
  T.checkpoints=checkpointTimeline(T.bounds,T.finTop,T.finLen,vh);
  T.lock=pairs.map(p=>{const t=p.getBoundingClientRect().top+sy;return(t+.74*(p.offsetHeight-vh)-T.qStart)/(T.qEnd-T.qStart);});
  T.seam=T.lock.map(q=>{const c=camQ(q);return{x:c.x+Math.sin(c.yaw)*600,y:c.y,z:c.z+Math.cos(c.yaw)*600};});
}

/* ---------- WebGL ---------- */
const gl=cvG.getContext('webgl2',{antialias:false,alpha:false,premultipliedAlpha:true,powerPreference:'high-performance'});
if(!gl)root.classList.add('no-gl');

const compile=(v,f)=>glc.compile(gl,v,f),makeVAO=(p,d,l,dv)=>glc.makeVAO(gl,p,d,l,dv),makeTex=(c,m)=>glc.makeTex(gl,c,m),strideOf=glc.strideOf;
let PROG=null;
if(gl)PROG={pts:compile(VS_POINTS,FS_POINTS),wrd:compile(VS_WORDS,FS_WORDS),occ:compile(VS_OCC,FS_OCC)};

/* ---------- glyph atlas: every letter of the questions and answers ---------- */
/* glyphs are also ranked by ink, so bright places can use dense letters */
let GLYPH=null,GI={},TXT='',NG=1,GINK=[];const GCOLS=16;let GROWS=1;
function makeGlyphs(){
  TXT=pairs.map(p=>[...p.querySelectorAll('[data-role]')].map(e=>e.textContent.trim()).join(' ')).join(' ').replace(/\s+/g,' ')+' ';
  const set=[...new Set(TXT.replace(/ /g,''))];NG=set.length;GROWS=Math.ceil(NG/GCOLS);
  const C=32,c=document.createElement('canvas');c.width=GCOLS*C;c.height=GROWS*C;const g=c.getContext('2d',{willReadFrequently:true});
  g.font='400 24px '+MONO;g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';
  set.forEach((ch,i)=>{GI[ch]=i;g.fillText(ch,(i%GCOLS+.5)*C,(((i/GCOLS)|0)+.5)*C+1);});
  const d=g.getImageData(0,0,c.width,c.height).data;
  GINK=set.map((ch,i)=>{let s=0;const x0=(i%GCOLS)*C,y0=((i/GCOLS)|0)*C;for(let y=0;y<C;y+=2)for(let x=0;x<C;x+=2)s+=d[((y0+y)*c.width+x0+x)*4+3];return[i,s];})
    .filter(e=>e[1]>0).sort((a,b)=>a[1]-b[1]).map(e=>e[0]);
  GLYPH=c;
}

/* ---------- word atlas ---------- */
let WORD_ATLAS=null,WORD_UV=null;
function makeWordAtlas(){
  const all=[...new Map(SRC.q.concat(SRC.a).map(s=>[s.key,s])).values()];
  const c=document.createElement('canvas'),g=c.getContext('2d');
  const setFont=accent=>{
    g.font=accent?'400 48px '+ACCENT_FONT:'500 semi-condensed 48px '+FONT;
    if('fontStretch' in g)g.fontStretch=accent?'normal':'semi-condensed';
  };
  const AW=1024,RH=64;let x=0,y=0;const pos={};
  for(const entry of all){setFont(entry.accent);const bw=Math.ceil(g.measureText(entry.w).width)+16;
    if(x+bw>AW){x=0;y+=RH;}pos[entry.key]=[x,y,bw];x+=bw;}
  c.width=AW;c.height=y+RH;
  g.fillStyle='#fff';g.textBaseline='middle';g.textAlign='left';
  WORD_UV={};
  for(const entry of all){setFont(entry.accent);const [px,py,bw]=pos[entry.key];
    g.fillText(entry.w,px+8,py+RH/2+2);WORD_UV[entry.key]=[px/AW,py/c.height,(px+bw)/AW,(py+RH)/c.height,bw/RH];}
  WORD_ATLAS=c;
}
/* ---------- world ---------- */
let W=0,H=0,DPR=1,F=1,CX=0,CY=0,WL=null,GPU=null,builtWidth=0,builtHeight=0,resizePending=false;
const Cc={x:0,y:-20,z:1700},RC=230;

function setRes(){DPR=Math.min(1.5,window.devicePixelRatio||1);
  const w=Math.round(W*DPR),h=Math.round(H*DPR);
  for(const canvas of [cvG,cvF]){if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;}fxDirty=true;}
// Update projection immediately; geometry is rebuilt once the resize settles.
function syncViewport(){
  const w=stage.clientWidth,h=stage.clientHeight,dpr=Math.min(1.5,window.devicePixelRatio||1);
  if(!w||!h||(W===w&&H===h&&DPR===dpr))return;
  W=w;H=h;setRes();
  const layout=sceneViewport(w,h,PHOTO?.width||1600,PHOTO?.height||1000,IMGCFG.cy);
  F=layout.focal;CX=layout.cx;CY=layout.cy;
  root.style.setProperty('--film-top',layout.bars.top+'px');root.style.setProperty('--film-bottom',layout.bars.bottom+'px');
  Object.assign(heroFinal.style,{left:'0px',top:'0px',width:w+'px',height:h+'px'});
  measure();lastKey='';
}
/* ---------- autoplay: the page plays itself like a film, from where it is to the finished hero ---------- */
let auto=null,seeking=null;
const PLAY_SECONDS=opts.playSeconds||48;
root.style.setProperty('--scene-exit-hold',SCENE_EXIT_HOLD+'px');
function playEnd(){return T.finTop+T.finLen;}
function autoStep(now){
  if(!auto)return;
  const dt=Math.min(.05,(now-auto.t)/1000);auto.t=now;auto.y+=auto.v*pairPlaybackRate(auto.y,T.bounds,innerHeight)*dt;
  if(auto.y>=playEnd()){scrollTo(0,playEnd());stopPlay();return;}
  auto.self=true;scrollTo(0,auto.y);
  auto.raf=requestAnimationFrame(autoStep);
}
const stopOnUser=e=>{if(!auto)return;if(e.type==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))return;stopPlay();};
function play(){
  seeking=null;if(auto)return;measure();
  const from=scrollY>=playEnd()-2?0:scrollY;if(from!==scrollY)scrollTo(0,from);
  auto={y:from,v:Math.max(120,(playEnd()-from)/PLAY_SECONDS),t:performance.now(),raf:0};
  addEventListener('wheel',stopOnUser,{passive:true});addEventListener('touchstart',stopOnUser,{passive:true});addEventListener('keydown',stopOnUser);
  root.classList.add('is-playing');opts.onPlayState&&opts.onPlayState(true);
  auto.raf=requestAnimationFrame(autoStep);
}
function stopPlay(){
  if(!auto)return;cancelAnimationFrame(auto.raf);auto=null;
  removeEventListener('wheel',stopOnUser);removeEventListener('touchstart',stopOnUser);removeEventListener('keydown',stopOnUser);
  root.classList.remove('is-playing');opts.onPlayState&&opts.onPlayState(false);
}

function build(){
  const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h||!gl)return;
  W=w;H=h;setRes();
  const CFG=IMGCFG;
  const r=rng(20261026);
  const ss=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

  /* the illustration is cover-fitted to the screen; everything is laid out in its normalised coordinates */
  const IW=PHOTO?PHOTO.width:1600,IH=PHOTO?PHOTO.height:1000;
  // Build for the complete canvas. The black bars never constrain the world or shade.
  const layout=sceneViewport(W,H,IW,IH,CFG.cy),FR=layout.frame;
  root.style.setProperty('--film-top',layout.bars.top+'px');root.style.setProperty('--film-bottom',layout.bars.bottom+'px');
  const {dw,dh,ix0,iy0}=layout.cover;
  const toS=(u,v)=>[ix0+u*dw,iy0+v*dh],toI=(sx,sy)=>[(sx-ix0)/dw,(sy-iy0)/dh];
  F=layout.focal;CX=layout.cx;CY=layout.cy;
  const pr0=(x,y,z)=>[CX+x*F/z,CY+y*F/z];

  /* colour source: the illustration itself, as the final camera sees it */
  const PS=.5,pw=Math.max(2,Math.ceil(dw*PS)),ph=Math.max(2,Math.ceil(dh*PS));
  const pc=document.createElement('canvas');pc.width=pw;pc.height=ph;const g=pc.getContext('2d',{willReadFrequently:true});
  if(PHOTO)g.drawImage(PHOTO,0,0,pw,ph);
  else{const gr=g.createLinearGradient(0,0,pw,0);gr.addColorStop(0,'#7a4a1c');gr.addColorStop(.5,'#c89a5a');gr.addColorStop(1,'#1c3478');g.fillStyle=gr;g.fillRect(0,0,pw,ph);
    const q=g.createRadialGradient(pw/2,(CY-iy0)*PS,0,pw/2,(CY-iy0)*PS,pw*.3);q.addColorStop(0,'rgba(255,230,170,.9)');q.addColorStop(1,'rgba(255,230,170,0)');g.fillStyle=q;g.fillRect(0,0,pw,ph);}
  const PD=g.getImageData(0,0,pw,ph).data;
  const refl=(v,L)=>{v=Math.abs(v)%(2*L);return v>L?2*L-v:v;};
  const sample=(x,y)=>{const lx=refl(x-ix0,dw)*PS,ly=refl(y-iy0,dh)*PS,o=(clamp(ly|0,0,ph-1)*pw+clamp(lx|0,0,pw-1))*4;return[PD[o],PD[o+1],PD[o+2]];};
  const lum=c=>.299*c[0]+.587*c[1]+.114*c[2];
  /* letters cover only part of their cell, so they carry the picture's saturation a little stronger to read as the same colour */
  const SAT=CFG.sat||1;
  const boost=c0=>{const l0=lum(c0),c=c0.map(v=>Math.max(0,l0+(v-l0)*SAT)),m=Math.max(c[0],c[1],c[2],1),k=Math.min(.85+Math.pow(Math.min(1,lum(c)/200),1.1)*1.25,255/m);return[c[0]*k,c[1]*k,c[2]*k];};

  /* bridge first: the glowing ribbon of the illustration becomes a walkable truss in a plane facing the final camera */
  const DECK=CFG.deck;
  const crm=(a,b,c,d,t)=>{const t2=t*t,t3=t2*t;return .5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);};
  const Zb=2600;
  const deckW=u=>{const n=DECK.length-1,f=clamp(u)*n,i=Math.min(n-1,f|0),t=f-i,P=k=>DECK[Math.max(0,Math.min(n,k))];
    const s=toS(crm(P(i-1)[0],P(i)[0],P(i+1)[0],P(i+2)[0],t),crm(P(i-1)[1],P(i)[1],P(i+1)[1],P(i+2)[1],t));
    return[(s[0]-CX)*Zb/F,(s[1]-CY)*Zb/F];};
  let len=0,deckLow=-1e9;{let p=deckW(0);for(let u=.005;u<=1.0001;u+=.005){const q=deckW(u);len+=Math.hypot(q[0]-p[0],q[1]-p[1]);deckLow=Math.max(deckLow,q[1]);p=q;}}
  const RH=CFG.rh*dh*Zb/F,BS=12,BW=Math.max(70,RH*.6);
  deckLow+=RH/2;
  /* floor at v=-RH/2, top chords at v=+RH/2; dz is depth across the deck (front face -BW, back face +BW) */
  const BPz=(u,dz,v)=>{const d=deckW(u);return[d[0],d[1]-v,Zb+dz,u];};
  const deckAt=u=>{const d=deckW(u);return{x:d[0],y:d[1],z:Zb};};
  const A=deckAt(0),B=deckAt(1);
  const Hp={x:A.x-170,y:A.y+RH*.2,z:Zb+60},hh=150;
  const Ap={x:B.x+280,y:B.y-170,z:Zb+340},ra=280;

  /* depth model of the illustration: a river valley. The river is a ground plane well below the bridge,
     the banks rise toward the viewer at both edges, mountains stand mid-distance, the sky is far */
  const Yp=Math.max(deckLow+170,560);
  let WALLT=null,SKY=null,ROADLEN=1;
  const depthAt=(sx,sy)=>{
    const [u,v]=toI(sx,sy),nx=Math.abs(u-.5)*2,side=ss(.28,.92,nx),bank=lerp(6000,950,side);
    if(sy>CY+1){const river=Yp*F/(sy-CY);return Math.min(river,bank*(1-.3*ss(.37,1,v)));}
    const up=clamp((CFG.cy-v)/CFG.cy);
    const hill=side>.35&&up<.9?bank*(1.05+up*.7):1e9;
    const mount=nx<.7&&up<.42?6000+up*9000:1e9;
    return Math.min(hill,mount,12000+up*9000);
  };

  /* the bridge: a transparent but solid-reading deck-truss. Doubled chords give the members thickness, faint skins
     mark the side faces and the road, the inner cross-frames and stringers show through, piers are real columns.
     While walking it, the road on top becomes a dense matte surface (a black plane under it), so it is not hollow underfoot.
     Warm on the human side, cool on the AI side */
  const paths=[];
  const du=(BS*.5)/len,panel=(RH/2.4)/len,FO=BW+3;
  for(const dz of [-FO,FO]){
    const back=dz>0;
    for(let k=0;k<=3;k++){
      const v=RH*(k/3-.5),edge=k===0||k===3;
      for(const off of edge?[-4,4]:[0]){const line=[];for(let u=0;u<=1.0001;u+=du)line.push(BPz(u,dz,v+off));paths.push({kind:edge?(back?'chordB':'chord'):(back?'railB':'rail'),pts:line});}
    }
    let up=true;
    for(let u=0;u<=1.0001;u+=panel,up=!up){
      for(const off of [-.6,.6]){const vert=[];for(let v=-RH/2;v<=RH/2;v+=BS*.5)vert.push(BPz(u+off/len*BS*.5,dz,v));paths.push({kind:back?'ribB':'rib',pts:vert});}
      if(u+panel<=1.0001){const d=[];for(let k=0;k<=12;k++){const t=k/12;d.push(BPz(u+panel*t,dz,up?lerp(-RH/2,RH/2,t):lerp(RH/2,-RH/2,t)));}paths.push({kind:back?'diagB':'diag',pts:d});}
    }
    /* faint skin on the side face */
    for(let v=-RH/2+BS*.4;v<RH/2;v+=BS*1.1){const line=[];for(let u=0;u<=1.0001;u+=du*1.3)line.push(BPz(u,dz*1.004,v));paths.push({kind:'skin',pts:line});}
  }
  /* tile grid on both faces (square cells with bright nodes at the crossings), as on the ribbon of the illustration */
  {
    const cell=RH/4,ucell=cell/len;
    for(const dz of [-FO*1.006,FO*1.006]){
      for(let k=1;k<4;k++){if(k===2)continue;const v=RH*(k/4-.5),line=[];for(let u=0;u<=1.0001;u+=du)line.push(BPz(u,dz,v));paths.push({kind:'tile',pts:line});}
      for(let u=0;u<=1.0001;u+=ucell){const vert=[];for(let v=-RH/2;v<=RH/2;v+=BS*.5)vert.push(BPz(u,dz,v));paths.push({kind:'tile',pts:vert});
        const nd=[];for(let k=0;k<=4;k++)nd.push(BPz(u,dz,RH*(k/4-.5)));paths.push({kind:'node',pts:nd});}
    }
  }
  /* road: a light skin always, densified while walking; kerbs along its edges */
  for(let dz=-BW+BS*.25;dz<BW;dz+=BS*.55){const line=[];for(let u=0;u<=1.0001;u+=du*.76)line.push(BPz(u,dz,RH/2+3));paths.push({kind:'road',pts:line});}
  for(let dz=-BW+BS*.52;dz<BW;dz+=BS*.55){const line=[];for(let u=du*.38;u<=1.0001;u+=du*.76)line.push(BPz(u,dz,RH/2+3));paths.push({kind:'roadW',pts:line});}
  for(const dz of [-BW*1.04,BW*1.04]){const line=[];for(let u=0;u<=1.0001;u+=du)line.push(BPz(u,dz,RH/2+BS*.9));paths.push({kind:'kerb',pts:line});}
  /* floor beams top and bottom, bottom lateral bracing, inner cross-frames, stringers */
  for(let u=0,cnt=0;u<=1.0001;u+=panel,cnt++){
    for(const v of [RH/2-4,-RH/2]){const b=[];for(let dz=-BW;dz<=BW;dz+=BS*.5)b.push(BPz(u,dz,v));paths.push({kind:'beam',pts:b});}
    if(u+panel<=1.0001)for(const s of [1,-1]){const x=[];for(let k=0;k<=14;k++){const t=k/14;x.push(BPz(u+panel*t,s*BW*(2*t-1),-RH/2));}paths.push({kind:'brace',pts:x});}
    if(cnt%2===0)for(const sg of [1,-1]){const x=[];for(let k=0;k<=18;k++){const t=k/18;x.push(BPz(u,sg*BW*(2*t-1),lerp(-RH/2,RH/2-6,t)));}paths.push({kind:'sway',pts:x});}
  }
  for(const dz of [-BW*.5,BW*.5])for(const v of [-RH/6,RH/6]){const line=[];for(let u=0;u<=1.0001;u+=du*1.2)line.push(BPz(u,dz,v));paths.push({kind:'stringer',pts:line});}
  /* piers: rectangular columns down to the river, with tie beams, fading a little toward the water */
  for(const up of [.12,.34,.66,.88]){
    const d=deckW(up),pw=Math.max(14,BW*.18),y0=d[1]+RH/2+6,fd=y=>1-.4*clamp((y-y0)/(Yp-y0));
    for(const dz of [-BW*.7,BW*.7]){
      for(const [ox,oz] of [[-pw,-pw],[pw,-pw],[pw,pw],[-pw,pw]]){const col=[];for(let y=y0;y<=Yp;y+=BS*.5)col.push([d[0]+ox,y,Zb+dz+oz,up,fd(y)]);paths.push({kind:'pier',pts:col});}
      for(let y=y0+BS*3;y<=Yp;y+=BS*4){const ring=[];for(let e=-pw;e<=pw;e+=BS*.5){ring.push([d[0]+e,y,Zb+dz-pw,up,fd(y)],[d[0]+e,y,Zb+dz+pw,up,fd(y)],[d[0]-pw,y,Zb+dz+e,up,fd(y)],[d[0]+pw,y,Zb+dz+e,up,fd(y)]);}paths.push({kind:'pierTie',pts:ring});}
    }
    for(let y=y0+BS*6;y<=Yp;y+=BS*9){const t=[];for(let dz=-BW*.7;dz<=BW*.7;dz+=BS*.5)t.push([d[0],y,Zb+dz,up,fd(y)]);paths.push({kind:'pierTie',pts:t});}
  }
  /* both ends run onto the banks and dissolve there, like the ribbon of the illustration: no blocks, no visible joint */
  const APPROACH=[];
  for(const [u0,uIn] of [[0,.01],[1,.99]]){
    const a=deckW(u0),b=deckW(uIn),L=Math.hypot(a[0]-b[0],a[1]-b[1])||1,ex=(a[0]-b[0])/L,ey=(a[1]-b[1])/L,Lap=RH*1.6;
    const at=(t,dz,v)=>[a[0]+ex*t,a[1]+ey*t*.3-v,Zb+dz,u0,Math.pow(1-clamp(t/Lap),1.6)];
    APPROACH.push({at,Lap});
    for(let dz=-BW+BS*.25;dz<BW;dz+=BS*.55){const line=[];for(let t=0;t<=Lap;t+=BS*.38)line.push(at(t,dz,RH/2+3));paths.push({kind:'roadA',pts:line});}
    for(let dz=-BW+BS*.52;dz<BW;dz+=BS*.55){const line=[];for(let t=BS*.19;t<=Lap;t+=BS*.38)line.push(at(t,dz,RH/2+3));paths.push({kind:'roadW',pts:line});}
    for(const dz of [-BW*1.04,BW*1.04]){const line=[];for(let t=0;t<=Lap;t+=BS*.5)line.push(at(t,dz,RH/2+BS*.9));paths.push({kind:'kerbA',pts:line});}
  }
  const KIND={tile:[BS*.8,.5],node:[BS*1.2,.8],strand:[BS*.9,.85],abut:[BS*.9,.42],roadA:[BS*.8,.5],kerbA:[BS*.95,.95],chord:[BS*1.05,.72],rail:[BS,.72],rib:[BS*.9,.75],diag:[BS*.85,.6],
    chordB:[BS*1.05,.8],railB:[BS*.9,.5],ribB:[BS*.85,.45],diagB:[BS*.8,.36],
    skin:[BS*.8,.16],road:[BS*.8,.5],roadW:[BS*.8,.55],kerb:[BS*.95,.7],
    beam:[BS*.8,.5],brace:[BS*.8,.42],sway:[BS*.8,.44],stringer:[BS*.85,.48],pier:[BS,.85],pierTie:[BS*.85,.6]};
  const FINE=new Set(['chord','rail','rib','diag','kerb','pier','chordB','sway','stringer']);
  /* the matte road: a black plane just under the road skin, drawn only while walking */
  const OCC=[];
  {
    const bw=BW-1,rh=RH/2-1,steps=Math.max(60,Math.round(len/14));
    const q=(a,b,c,d)=>OCC.push(...a,...b,...c,...a,...c,...d);
    const P=(u,dz,v)=>{const p=BPz(u,dz,v);return[p[0],p[1],p[2]];};
    for(let i=0;i<steps;i++){const u0=i/steps,u1=(i+1)/steps;q(P(u0,-bw,rh),P(u1,-bw,rh),P(u1,bw,rh),P(u0,bw,rh));}
  }

  /* ---- micro particles ---- */
  const Lp=[];// [x,y,z,size,r,g,b,kind,sx0,sy0,char]
  /* the frame written as lines of text, coloured by the illustration and placed at its depth.
     Bright places use dense letters and dark places light ones, so the picture reads through the colour.
     The main grid is what the scene shows; a second grid between its letters stays hidden and fills in
     at the very end of the finale, so the final frame doubles its detail in place */
  const ink=l=>GINK[clamp(Math.round(Math.pow(clamp(l/210),.8)*(GINK.length-1)+(r()-.5)*4),0,GINK.length-1)];
  const px=Math.max(5,Math.sqrt(2*W*H/40000)),adv=px*.5;
  const MX=W*.32,MY=H*.1;
  const grid=(ox,oy,detail,kg=1)=>{
    const pxg=px*kg,advg=adv*kg;
    const x0=detail?0:-MX,x1=detail?W:W+MX,y0g=detail?0:-MY,y1=detail?H:H+MY;
    for(let gy=Math.floor(y0g/pxg);(gy+.5)*pxg+oy<y1;gy++){
      let tp=(r()*TXT.length)|0;
      for(let gx=Math.floor(x0/advg);gx*advg+ox<x1;gx++){
        const st=TXT[tp++%TXT.length];if(st===' ')continue;
        const sx=(gx+.5)*advg+ox,sy=(gy+.5)*pxg+oy,out=sx<0||sx>W||sy<0||sy>H;if(out&&r()<.55)continue;
        const c0=sample(sx,sy),l=lum(c0);
        const fill=1+.32*ss(105,215,l),c=boost(c0),ch=r()<(l>170?.22:.08)?ink(l):GI[st],z=depthAt(sx,sy)*(1+(r()-.5)*.015);
        if(detail){Lp.push([(sx-CX)*z/F,(sy-CY)*z/F,z,pxg*z/F*fill,c[0],c[1],c[2],7,-1,-1,ch]);continue;}
        Lp.push([(sx-CX)*z/F,(sy-CY)*z/F,z,pxg*z/F*(out?1.25:fill),c[0],c[1],c[2],sy<CY?0:1,sx,sy,ch]);
        if(out)continue;
        /* relief: hills, city and mountains of the picture get thickness behind them, seen only from the bridge */
        const river=sy>CY+1?Yp*F/(sy-CY):1e9;
        if(z<7000&&z<river*.97)for(let L=1;L<=2;L++){const z3=z*(1+.045*L),k=.6-.16*L;Lp.push([(sx-CX)*z3/F,(sy-CY)*z3/F,z3,pxg*z3/F,c[0]*k,c[1]*k,c[2]*k,9,-1,-1,ch]);}
        if(z<11000&&r()<.25){const z2=z*(1+.07+r()*.05);Lp.push([(sx-CX)*z2/F,(sy-CY)*z2/F,z2,pxg*z2/F,c[0]*.5,c[1]*.5,c[2]*.5,6,-1,-1,(r()*NG)|0]);}
      }
    }
  };
  grid(0,0,false);grid(adv*.35,px*.35,true,.707);
  const GN=120,GR=[];
  for(let i=0;i<=GN;i++){let c=[0,0,0],m=0;for(let k=0;k<9;k++){const p=BPz(i/GN,0,RH*(k/8-.5)),sp=pr0(p[0],p[1],p[2]),ci=sample(sp[0],sp[1]);c[0]+=ci[0];c[1]+=ci[1];c[2]+=ci[2];m++;}GR.push(c.map(v=>v/m));}
  const GS=GR.map((_,i)=>{let c=[0,0,0],m=0;for(let j=-14;j<=14;j++){const g=GR[Math.max(0,Math.min(GN,i+j))],w=1-Math.abs(j)/15;c[0]+=g[0]*w;c[1]+=g[1]*w;c[2]+=g[2]*w;m+=w;}return boost(c.map(v=>v/m));});
  const picCol=(q,tint)=>{const ci=GS[Math.round(clamp(q[3])*GN)],cu=colU(q[3]);return[ci[0]*(1-tint)+cu[0]*tint,ci[1]*(1-tint)+cu[1]*tint,ci[2]*(1-tint)+cu[2]*tint];};
  /* the two cities the bridge joins, seen while walking and from the side. On the near bank a warm classical town on
     terraced hills (temples, towers, houses, cypresses); on the far bank a cool city of towers lit window by window,
     with one tall tower at the end of the road and a light at its foot. Everything is written in letters coloured by the
     illustration; far things use larger, sparser letters. The far city assembles itself while you walk; both cities fade
     before the frontal frame. The rails glow warm on the left and cool on the right while walking */
  {
    const wide=clamp((W/H-1.3)/1.1),cityGap=1500+wide*1600,cityScale=.78-wide*.16;
    const DEN=W<700?.65:1,yG=B.y+RH*.5+170,X0=B.x,HX=B.x+RH*1.6+2300+cityGap,MID=lerp(A.x,B.x,.5);let tp=(r()*TXT.length)|0;
    const nextCh=()=>{let ch=TXT[tp++%TXT.length];if(ch===' ')ch=TXT[tp++%TXT.length];return GI[ch];};
    const put=(x,y,z,sz,c,k)=>Lp.push([x,y,z,sz,c[0]*k,c[1]*k,c[2]*k,10,-1,-1,nextCh(),0]);
    const bld=(x,y,z,sz,c,k,dl,ch)=>{if(DEN<1&&r()>DEN)return;Lp.push([x,yG+(y-yG)*cityScale,z+(x<B.x+cityGap?Math.sign(z-Zb)*(900+wide*700):0),sz,c[0]*k*.82,c[1]*k*.82,c[2]*k*.82,13,-1,-1,ch===undefined?nextCh():ch,0,clamp(dl)]);};
    const pic=(u,v)=>{const sp=toS(u,v),c0=sample(sp[0],sp[1]);return[boost(c0),lum(c0)];};
    const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    const hash=(a,b)=>{const q=Math.sin(a*12.9898+b*78.233)*43758.5453;return q-Math.floor(q);};
    const sfAt=(x,z)=>clamp(Math.hypot(x-MID,z-Zb)/2200,1,2.2);
    const line=(a,b,step,sz,c,k,d0,d1)=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),m=Math.max(1,Math.round(L/step));
      for(let i=0;i<=m;i++){const t=i/m;bld(lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t),sz,c,k,lerp(d0,d1,t));}};
    /* a face: rows of windows and floor bands, its colour a patch of the illustration mixed with the bank's tint */
    const facade=(p0,du,dv,Wd,Hd,tint,ru,rv,dl0,dlH,sf,win)=>{
      const st=sf<1.5?.72:.85;
      for(let b=6*sf;b<Hd;b+=22*sf*st)for(let a=6*sf;a<Wd;a+=17*sf*st){
        const fl=(b/(44*sf))|0,bay=(a/(30*sf))|0,band=(b%(44*sf))<12*sf,on=hash(fl+ru*97,bay+rv*53+p0[0]*.01);
        if(band&&r()<.5)continue;
        const lit=win&&on>.45,[c0,l]=pic(ru+a/Wd*.1,rv+(1-b/Hd)*.25),c=lit?mix(c0,tint,.65):mix(c0,tint,.5),k=band?.24:(lit?.94:.24);
        bld(p0[0]+du[0]*a+dv[0]*b,p0[1]+du[1]*a+dv[1]*b,p0[2]+du[2]*a+dv[2]*b,12*sf,c,k,dl0+b/Hd*dlH,r()<.12?ink(Math.max(l,90)):undefined);
      }
    };
    const box=(cx,cz,yb,w,d,h,tint,dl0,dlH,win,ru,rv)=>{
      const sf=sfAt(cx,cz),x0=cx-w/2,z0=cz-d/2,z1=cz+d/2,ed=mix(tint,[255,255,255],.12);
      facade([x0,yb,z0],[0,0,1],[0,-1,0],d,h,tint,ru,rv,dl0,dlH,sf,win);
      facade([x0+w,yb,z0],[0,0,1],[0,-1,0],d,h,tint,ru+.09,rv,dl0,dlH,sf,win);
      facade([x0,yb,z0-1],[1,0,0],[0,-1,0],w,h,tint,ru+.03,rv,dl0,dlH,sf,win);
      facade([x0,yb,z1+1],[1,0,0],[0,-1,0],w,h,tint,ru+.06,rv,dl0,dlH,sf,win);
      for(const [x,z] of [[x0,z0],[x0,z1],[x0+w,z0],[x0+w,z1]])line([x,yb,z],[x,yb-h,z],12*sf,11*sf,ed,.5,dl0,dl0+dlH);
      for(const [a,b] of [[[x0,z0],[x0+w,z0]],[[x0,z1],[x0+w,z1]],[[x0,z0],[x0,z1]],[[x0+w,z0],[x0+w,z1]]])line([a[0],yb-h,a[1]],[b[0],yb-h,b[1]],12*sf,11*sf,ed,.5,dl0+dlH,dl0+dlH);
    };

    /* ---- the far bank: a city of towers ---- */
    const cool=COOL,AIX0=B.x+cityGap+380,AIX1=HX+2600,warmSpots=[];
    const tower=(cx,cz,w,d,h,dl)=>{
      const ru=.62+r()*.28,rv=.04+r()*.35,setb=h>1300&&r()<.6,h1=setb?h*.68:h;
      box(cx,cz,yG,w,d,h1,cool,dl,.3,true,ru,rv);
      if(setb)box(cx,cz,yG-h1,w*.62,d*.62,h-h1,cool,dl+.3,.12,true,ru,rv);
      if(r()<.45)line([cx,yG-h,cz],[cx,yG-h*1.18,cz],10,11,[200,235,255],.9,dl+.42,dl+.45);
    };
    for(let x=AIX0;x<=AIX1;x+=560)for(let z=Zb-1700;z<=Zb+3200;z+=520){
      const xx=x+(r()-.5)*150,zz=z+(r()-.5)*150;
      /* a wide avenue stays open along the road, so the city stands at a distance and the tower closes the view */
      if(Math.abs(zz-Zb)<BW+260+Math.max(0,HX-xx)*.03&&xx<HX+420)continue;
      if(Math.abs(xx-HX)<330&&Math.abs(zz-Zb)<330)continue;
      if(r()<.3)continue;
      if(zz>Zb+120&&xx<HX+700){warmSpots.push([xx,zz]);continue;}
      const core=1-clamp(Math.hypot(xx-HX,zz-Zb)/2800);
      tower(xx,zz,140+r()*130,140+r()*130,450+r()*800+core*1500,clamp((xx-AIX0)/(AIX1-AIX0))*.5);
    }
    /* the skyline behind the tower: taller towers packed close, white toward the middle */
    for(let x=HX+300;x<=HX+2700;x+=420)for(let z=Zb-1250;z<=Zb+1250;z+=440){
      const xx=x+(r()-.5)*90,zz=z+(r()-.5)*90;if(Math.abs(zz-Zb)<240&&xx<HX+520)continue;if(r()<.3)continue;
      const mid=1-clamp(Math.abs(zz-Zb)/1300);
      box(xx,zz,yG,130+r()*110,130+r()*110,900+r()*900+mid*1100,mix(cool,[215,232,255],mid*.6),.25+clamp((xx-HX)/2700)*.4,.3,true,.62+r()*.3,.04+r()*.3);
    }
    /* the AI sky of the illustration: a ringed planet, a spiral galaxy, and a brain-like tree among the towers */
    {const px0=HX+1700,py0=yG-2500,pz0=Zb-1800,PR=260;
     for(let i=0;i<2200;i++){const u=r()*2-1,a=r()*TAU,q=Math.sqrt(1-u*u),x=q*Math.cos(a),y=u,z=q*Math.sin(a),sh=.35+.65*clamp(.5-.5*(x*.6+y*.5-z*.6));
       bld(px0+x*PR,py0+y*PR,pz0+z*PR,13,[lerp(60,180,sh),lerp(110,215,sh),255],.25+.7*sh,.55+r()*.1);}
     for(let i=0;i<1400;i++){const a=r()*TAU,rr=PR*(1.45+r()*.55),x=Math.cos(a)*rr,z=Math.sin(a)*rr;bld(px0+x,py0+z*.28+x*.12,pz0+z*.5,11,[170,215,255],.6,.62);}}
    {const gx0=HX+3400,gy0=yG-3500,gz0=Zb-2800,GR=760;
     for(let i=0;i<3200;i++){const arm=i%2,t=Math.pow(r(),.7),a=t*TAU*1.6+arm*Math.PI+(r()-.5)*.5,rr=t*GR,x=Math.cos(a)*rr,y=Math.sin(a)*rr*.42;
       bld(gx0+x,gy0+y,gz0+(r()-.5)*60+x*.2,11+8*(1-t),[lerp(255,150,t),lerp(235,120,t),255],.25+.75*(1-t),.6+r()*.1);}}
    {const bx=HX+620,bz=Zb-1350,by=yG;
     line([bx,by,bz],[bx,by-520,bz],10,12,[150,200,255],.9,.3,.42);
     for(let i=0;i<2400;i++){const u=r()*2-1,a=r()*TAU,q=Math.sqrt(1-u*u),fold=1+.12*Math.sin(a*9+u*7),x=q*Math.cos(a)*fold,y=u*fold,z=q*Math.sin(a)*fold;
       bld(bx+x*280,by-520-200+y*190,bz+z*230,11,[120+80*fold,190,255],.35+.55*clamp(fold-.9),.42+r()*.12);}}
    /* the ground of the far city: a field of cool letters */
    for(let x=AIX0;x<=AIX1;x+=46)for(let z=Zb-1500;z<=Zb+3000;z+=34){
      const sf=sfAt(x,z);if(r()>1/sf)continue;if(z>Zb+120&&x<HX+700)continue;if(Math.abs(z-Zb)<BW+30&&x<HX)continue;
      const [c,l]=pic(lerp(.6,1,(z-Zb+1500)/4500),lerp(.72,.95,(x-AIX0)/(AIX1-AIX0)));if(l<8)continue;
      if(Math.abs(z-Zb)<700)continue;bld(x,yG+2,z,12*sf,mix(c,cool,.4),.18,clamp((x-AIX0)/(AIX1-AIX0))*.4);}
    /* the tall tower at the end of the road, a light at its foot and on its top */
    box(HX,Zb,yG,280,280,3000,[205,228,255],.35,.5,true,.7,.08);
    line([HX,yG-3000,Zb],[HX,yG-3550,Zb],10,13,[235,245,255],1,.86,.9);
    for(let i=0;i<1400;i++){const a=(r()+r()+r()-1.5),b=(r()+r()+r()-1.5),e=(r()+r()+r()-1.5),k=Math.exp(-(a*a+b*b+e*e)*.8);
      bld(HX-200+e*170,yG-90+b*80,Zb+a*230,12+12*k,[255,lerp(215,250,k),lerp(170,240,k)],.2+.55*k,.6+.2*r());}

    /* ---- the near bank: a classical town on terraced hills ---- */
    const warm=SCENE_WARM,HX0=A.x-2600,HX1=MID+250;
    const hillY=(x,z)=>yG-Math.max(0,z-(Zb+330))*.42-Math.max(0,Math.min(1,(z-Zb-200)/400))*(80*Math.sin(x/640)+50);
    for(let x=HX0;x<=HX1;x+=38)for(let z=Zb+330;z<=Zb+3200;z+=30){
      const sf=sfAt(x,z);if(r()>1/sf)continue;
      const [c,l]=pic(lerp(.02,.38,(x-HX0)/(HX1-HX0)),lerp(.55,.15,(z-Zb-330)/2870));if(l<8)continue;
      const hy=hillY(x,z);if(yG-hy<40)continue;bld(x,hy,z,12*sf,mix(c,warm,.3),.36,.05*r());}
    const temple=(cx,cz)=>{
      const yb=hillY(cx,cz),w=320,d=210,hc=170,col=[255,226,170],ru=.08+r()*.2,rv=.12+r()*.2,sf=sfAt(cx,cz);
      facade([cx-w/2-16,yb,cz-d/2-16],[1,0,0],[0,-1,0],w+32,26,col,ru,rv,.02,0,sf,false);
      for(let i=0;i<7;i++){const x=cx-w/2+i*w/6;for(const o of [-4,4])line([x+o,yb-26,cz-d/2],[x+o,yb-26-hc,cz-d/2],9*sf,10*sf,col,.9,.04,.12);}
      for(let i=0;i<4;i++){const z=cz-d/2+i*d/3;for(const o of [-4,4])line([cx-w/2,yb-26,z+o],[cx-w/2,yb-26-hc,z+o],9*sf,10*sf,col,.8,.04,.12);}
      facade([cx-w/2-8,yb-26-hc,cz-d/2-2],[1,0,0],[0,-1,0],w+16,36,col,ru,rv,.13,0,sf,false);
      const yp=yb-26-hc-36;for(let b=0;b<70;b+=12*sf){const hw=(w/2+8)*(1-b/70);for(let a=-hw;a<=hw;a+=13*sf)bld(cx+a,yp-b,cz-d/2-2,11*sf,col,b<4?.95:.55,.15);}
      line([cx,yp-70,cz-d/2],[cx,yp-70,cz+d/2],12*sf,10*sf,col,.7,.15,.15);
    };
    const domeTower=(cx,cz)=>{
      const yb=hillY(cx,cz),rr=46,h=360,col=[255,210,140],sf=sfAt(cx,cz);
      for(let y=0;y<h;y+=17*sf)for(let a=0;a<TAU;a+=14*sf/rr)if(Math.cos(a)<.35)bld(cx+Math.cos(a)*rr,yb-y,cz+Math.sin(a)*rr,10*sf,col,(y/17|0)%4===0?.9:.5,.03+y/h*.12);
      for(let t=0;t<1;t+=.08)for(let a=0;a<TAU;a+=16*sf/(rr*Math.cos(t*TAU/4)+1))bld(cx+Math.cos(a)*rr*Math.cos(t*TAU/4),yb-h-Math.sin(t*TAU/4)*rr,cz+Math.sin(a)*rr*Math.cos(t*TAU/4),10*sf,col,.8,.16);
      line([cx,yb-h-rr,cz],[cx,yb-h-rr-70,cz],9,10,[255,235,190],.95,.17,.18);
    };
    const cypress=(x,z)=>{const yb=hillY(x,z),h=150+r()*120,w=22+r()*10,c=[170,165,80],sf=sfAt(x,z);
      for(let i=0;i<46/sf;i++){const t=r(),rad=w*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.05)),.7);bld(x+(r()-.5)*2*rad,yb-t*h,z+(r()-.5)*2*rad,10*sf,c,.45+.3*r(),.02);}};
    const tpos=[[.12,.25],[.3,.55],[.5,.3],[.68,.7],[.2,.85],[.82,.45],[.45,.8]];
    for(const [a,b] of tpos)temple(lerp(HX0+300,HX1-400,a),lerp(Zb+1000,Zb+2900,b));
    for(const [a,b] of [[.38,.42],[.75,.25],[.6,.9]])domeTower(lerp(HX0+300,HX1-300,a),lerp(Zb+950,Zb+2900,b));
    for(let i=0;i<34;i++){const x=lerp(HX0+150,HX1-150,r()),z=lerp(Zb+900,Zb+3100,r());
      box(x,z,hillY(x,z),90+r()*90,90+r()*80,70+r()*110,warm,.02,.1,true,.05+r()*.3,.1+r()*.35);}
    for(let i=0;i<60;i++)cypress(lerp(HX0+100,HX1,r()),lerp(Zb+800,Zb+3200,r()));
    for(let x=AIX0;x<=HX+700;x+=40)for(let z=Zb+BW+40;z<=Zb+3200;z+=30){
      const sf=sfAt(x,z);if(r()>1/sf)continue;
      const [c,l]=pic(lerp(.05,.35,(z-Zb)/3000),lerp(.5,.2,(z-Zb)/3000));if(l<8)continue;
      const hy=hillY(x,z);if(yG-hy<40)continue;bld(x,hy,z,12*sf,mix(c,warm,.35),.36,.1*r());}
    for(const [x,z] of warmSpots){const k=r();
      if(k<.32)temple(x,z);else if(k<.5)domeTower(x,z);
      else for(let j=0;j<3;j++){const hx=x+(r()-.5)*260,hz=z+(r()-.5)*260;box(hx,hz,hillY(hx,hz),90+r()*90,90+r()*80,70+r()*120,warm,.05,.15,true,.05+r()*.3,.1+r()*.35);}
      for(let j=0;j<3;j++)cypress(x+(r()-.5)*380,z+(r()-.5)*380);}

    /* ---- the road on: dotted path to the tower, rails warm on the left and cool on the right (walk only) ---- */
    const pathY=()=>B.y-RH/2-3;
    // Match the bridge's two interleaved road grids and fade gently into the city.
    const roadEnd=HX-140,roadLen=roadEnd-X0,roadSteps=Math.ceil(roadLen/(BS*.38));ROADLEN=roadLen;
    const roadFade=x=>lerp(1,.28,EASE.io(clamp((x-X0)/roadLen)));
    const roadColor=picCol([0,0,0,1],.25).map(v=>Math.min(255,v*.95+12));
    for(let layer=0;layer<2;layer++)for(let i=0;i<=roadSteps;i++){
      const x=Math.min(roadEnd,X0+i/roadSteps*roadLen+layer*BS*.19),k=(layer?.55:.5)*roadFade(x);
      for(let dz=-BW+BS*(layer?.52:.25);dz<BW;dz+=BS*.55)
        Lp.push([x,pathY(),Zb+dz,BS*.8,roadColor[0]*k,roadColor[1]*k,roadColor[2]*k,10,-1,-1,nextCh(),1,0,1+(x-X0)/roadLen]);
    }
    const putRoad=(x,y,z,sz,c,k)=>put(x,y,z,sz,c,k*roadFade(x));
    // Continue the matte backing all the way from the bridge to the entrance.
    const roadQuad=(a,b,c,d)=>OCC.push(...a,...b,...c,...a,...c,...d);
    roadQuad([X0,pathY()+2,Zb-BW],[roadEnd,pathY()+2,Zb-BW],[roadEnd,pathY()+2,Zb+BW],[X0,pathY()+2,Zb+BW]);
    const railC=dz=>dz>0?SCENE_WARM:COOL;
    for(const dz of [BW*1.04,-BW*1.04]){
      for(let u=0;u<=1.0001;u+=(BS*.4)/len){const p=BPz(u,dz,RH/2+BS*1.4);put(p[0],p[1],p[2],BS*1.15,railC(dz),1);}
      for(let i=0;i<=roadSteps;i++){
        const x=lerp(X0,roadEnd,i/roadSteps);
        putRoad(x,pathY()-BS*1.4,Zb+dz,BS*1.15,railC(dz),1);
        putRoad(x,pathY()+RH*.7,Zb+dz,BS*.8,railC(dz),.38);
      }
      for(let x=X0;x<roadEnd;x+=96){
        for(let y=-BS*1.4;y<=RH*.7;y+=8)putRoad(x,pathY()+y,Zb+dz,7,railC(dz),.5);
        for(let i=0;i<=16;i++)putRoad(Math.min(roadEnd,x+i*6),pathY()+lerp(0,RH*.7,i/16),Zb+dz,6,railC(dz),.4);
      }
    }
    // Cross beams, supports and an entrance frame finish the extension.
    for(let x=X0;x<=roadEnd;x+=192){
      for(let dz=-BW;dz<=BW;dz+=8)putRoad(x,pathY()+RH*.7,Zb+dz,7,cool,.4);
      for(const dz of [-BW*.8,BW*.8])for(let y=pathY()+RH*.7;y<yG+120;y+=9)putRoad(x,y,Zb+dz,8,cool,.36);
    }
    for(const dz of [-BW,BW])for(let y=0;y<=100;y+=8)putRoad(roadEnd-2,pathY()-y,Zb+dz,8,[205,228,255],.65);
    for(let dz=-BW;dz<=BW;dz+=8)putRoad(roadEnd-2,pathY()-100,Zb+dz,8,[205,228,255],.65);
    // Walk-only upper structure: railings above the deck, arched chords and hangers.
    // They are actual spatial members, so side views retain the same detail.
    const deckPoint=t=>{
      if(t<=1){const d=deckAt(t);return{x:d.x,y:d.y-RH/2-3};}
      return{x:lerp(X0,roadEnd,t-1),y:pathY()};
    };
    const member=(a,b,c,k,sz=6)=>{
      const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/4));
      for(let i=0;i<=n;i++){const t=i/n,x=lerp(a[0],b[0],t);putRoad(x,lerp(a[1],b[1],t),lerp(a[2],b[2],t),sz,c,k);}
    };
    for(const side of [-1,1]){
      const z=Zb+side*BW*1.04,col=mix(side>0?SCENE_WARM:COOL,[255,255,255],.35);
      for(const [start,end] of [[0,.5],[.5,1],[1,1.5],[1.5,2]]){
        let prev=null;
        for(let i=0;i<=90;i++){
          const t=i/90,p=deckPoint(lerp(start,end,t)),h=52+Math.sin(Math.PI*t)*145;
          const upper=[p.x,p.y-h,z];
          if(prev){member(prev,upper,col,.82,7);member([prev[0],prev[1]+9,z+side*4],[upper[0],upper[1]+9,z+side*4],col,.4,5);}
          if(i%6===0)member([p.x,p.y,z],upper,[165,220,255],.56,6);
          prev=upper;
        }
      }
      for(let i=0;i<220;i++){
        const a=deckPoint(i/110),b=deckPoint((i+1)/110);
        for(const h of [24,44])member([a.x,a.y-h,z],[b.x,b.y-h,z],[190,229,255],.48,5);
      }
      // Filled side truss of the approach, with vertical panels and crossed bracing.
      for(let x=X0;x<roadEnd;x+=96){
        const x1=Math.min(roadEnd,x+96),y=pathY(),bottom=y+RH;
        member([x,y,z],[x,bottom,z],col,.56);
        member([x,bottom,z],[x1,y,z],col,.42);
        member([x,y,z],[x1,bottom,z],col,.32);
        for(const f of [.25,.5,.75,1])member([x,y+RH*f,z],[x1,y+RH*f,z],col,.28,5);
      }
    }
    // Close both side faces across the seam, overlapping the final curved panel.
    // Match the main truss depth and width before blending into the straight span.
    const seamStart=deckAt(.965),seamEnd=X0+120,seamSteps=Math.max(12,Math.ceil((seamEnd-seamStart.x)/7));
    const seamPoint=(t,f,side)=>{
      const x=lerp(seamStart.x,seamEnd,t),onDeck=x<=X0;
      const u=onDeck?lerp(.965,1,clamp((x-seamStart.x)/(X0-seamStart.x))):1;
      const p=deckAt(u),y=(onDeck?p.y-RH/2-3:pathY())+f*(RH+3);
      const z=Zb+side*lerp(BW+3,BW*1.04,EASE.io(t));
      return[x,y,z];
    };
    for(const side of [-1,1]){
      const col=mix(side>0?SCENE_WARM:COOL,[255,255,255],.25);
      for(let i=0;i<seamSteps;i++){
        const t=i/seamSteps,t1=(i+1)/seamSteps;
        for(const f of [0,.25,.5,.75,1])member(seamPoint(t,f,side),seamPoint(t1,f,side),col,f===0||f===1?.5:.28,6);
        // A fine, translucent skin keeps the joint readable between its beams.
        for(let f=.07;f<1;f+=.07){const p=seamPoint(t,f,side);putRoad(p[0],p[1],p[2],5,col,.13);}
      }
      for(let i=0;i<=3;i++){
        const t=i/3;
        member(seamPoint(t,0,side),seamPoint(t,1,side),col,.48,7);
        if(i<3){
          member(seamPoint(t,0,side),seamPoint((i+1)/3,1,side),col,.4,6);
          member(seamPoint(t,1,side),seamPoint((i+1)/3,0,side),col,.32,6);
        }
      }
    }
    // Additional city blocks stay beyond the far abutment; the bridge span stays open.
    for(let i=0;i<12;i++){
      const x=lerp(B.x+cityGap+800,HX+1800,i/11),stagger=(i%3)*160;
      for(const side of [-1,1]){
        const z=Zb+side*(900+stagger),tint=side>0?SCENE_WARM:COOL;
        const base=side>0?hillY(x,z):yG;
        box(x,z,base,180+(i%3)*40,170,320+(i%4)*145,tint,.05,.22,true,side>0?.16:.73,.18);
        if(i%3===1)box(x+60,z+side*230,base,120,120,780,tint,.08,.26,true,.65,.12);
      }
    }
    // Broken horizontal reflections give the water and the lower sides depth.
    const waterY=Math.max(Yp,yG+180);
    for(let i=0;i<(W<700?4500:9000);i++){
      const x=lerp(A.x-900,HX+500,r()),side=r()<.5?-1:1,z=Zb+side*(BW+100+r()*1900);
      const stripe=.5+.5*Math.sin(x*.018+z*.025),col=side>0?SCENE_WARM:COOL;
      bld(x,waterY+Math.sin(z*.03)*4,z,8,col,(.035+.13*Math.pow(stripe,5))*(1-clamp((Math.abs(z-Zb)-BW)/2300)),.08);
    }
    // Distant sky, in a YZ plane facing the view along the bridge (+X).
    const skyR=rng(731904),galaxy=[],skyStars=[],skyNodes=[];
    const galaxyCenter={x:HX+2400,y:yG-2950,z:Zb+250};
    for(let i=0;i<(W<700?650:1200);i++){
      const arm=i%3,t=Math.pow(skyR(),.7),a=t*TAU*1.35+arm*TAU/3+(skyR()-.5)*.28;
      galaxy.push({z:Math.cos(a)*t*2350,y:Math.sin(a)*t*540,x:(skyR()-.5)*160,t,ch:GI[TXT[(skyR()*TXT.length)|0]]??0});
    }
    for(let i=0;i<280;i++)skyStars.push({x:HX+1500+skyR()*5000,y:yG-2300-skyR()*3700,z:Zb+(skyR()-.5)*14500,phase:skyR()*TAU});
    for(let i=0;i<12;i++)skyNodes.push({x:HX+1900+skyR()*1200,y:yG-2450-skyR()*2400,z:Zb+(skyR()-.5)*5400});
    const skyEdges=[];
    skyNodes.forEach((p,i)=>{
      const near=skyNodes.map((q,j)=>({j,d:Math.hypot(p.y-q.y,p.z-q.z)})).filter(q=>q.j!==i).sort((a,b)=>a.d-b.d).slice(0,2);
      near.forEach(q=>{if(!skyEdges.some(e=>e[0]===q.j&&e[1]===i))skyEdges.push([i,q.j]);});
    });
    SKY={galaxy,galaxyCenter,stars:skyStars,nodes:skyNodes,edges:skyEdges};
    WALLT={x:roadEnd,y:pathY()-90,z:Zb};
  }
  /* the bridge in letters of the questions and answers */
  /* one smooth gradient along the whole bridge: the ribbon's colours in the illustration, averaged across it and along it */
  const glyphAt=(u,tp)=>{let s=TXT[tp%TXT.length];if(s===' ')s=TXT[(tp+1)%TXT.length];return GI[s];};
  for(const p of paths){
    let tp=(r()*TXT.length)|0;const ks=KIND[p.kind];
    const walkOnly=p.kind==='roadW'||p.kind==='roadA'||p.kind==='kerbA';
    const kd=walkOnly?10:p.kind==='road'?11:12,lit=(p.kind==='road'||p.kind==='roadW'||p.kind==='roadA')?1:0;
    for(const q of p.pts){let c=picCol(q,lit?.25:.3);if(lit)c=c.map(v=>Math.min(255,v*.95+12));const fd=(q.length>4?q[4]:1)*ks[1];if(fd<.02)continue;Lp.push([q[0],q[1],q[2],ks[0],c[0]*fd,c[1]*fd,c[2]*fd,kd,-1,-1,glyphAt(q[3],tp++),lit,0,lit?q[3]+Math.max(0,q[0]-B.x)/ROADLEN:0]);}
  }
  /* close-up detail: a finer layer on the structural lines that only shows when the camera is near */
  for(const p of paths){
    if(!FINE.has(p.kind))continue;
    const ks=KIND[p.kind];let tp=(r()*TXT.length)|0;
    for(let i=1;i<p.pts.length;i++){
      const a=p.pts[i-1],b=p.pts[i],seg=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]),m=Math.max(1,Math.round(seg/2.2));
      for(let k=0;k<m;k++){
        const t=(k+.5)/m,u=lerp(a[3],b[3],t),c=picCol([lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t),u],.3),o=()=>(r()-.5)*BS*.4;
        const fk=ks[1]*.9*(a.length>4?lerp(a[4],b[4],t):1);
        Lp.push([lerp(a[0],b[0],t)+o(),lerp(a[1],b[1],t)+o(),lerp(a[2],b[2],t),BS*.36,c[0]*fk,c[1]*fk,c[2]*fk,8,-1,-1,glyphAt(u,tp++)]);
      }
    }
  }
  /* human: a warm light on the near bank; AI: a cool nebula on the far bank */
  const gs=()=>(r()+r()+r()-1.5)*2;
  for(let i=0;i<1600;i++){
    const ex=gs(),ey=gs(),ez=gs(),k=Math.exp(-(ex*ex+ey*ey+ez*ez)*.45),b=.25+.75*k;
    Lp.push([Hp.x+ex*40,Hp.y-hh*.5+ey*52,Hp.z+ez*40,7+4*k,255*b,lerp(120,228,k)*b,lerp(50,180,k)*b,3,-1,-1]);
  }
  for(let i=0;i<2600;i++){
    const ex=gs(),ey=gs(),ez=gs(),k=Math.exp(-(ex*ex+ey*ey*2.4+ez*ez)*.32),b=.2+.8*k;
    Lp.push([Ap.x+ex*ra*.6,Ap.y+ey*ra*.28,Ap.z+ez*ra*.6,9+6*k,lerp(60,235,k)*b,lerp(165,248,k)*b,255*b,4,-1,-1]);
  }
  /* atmosphere: faint letters filling the volume, so no camera angle looks empty */
  for(let i=0;i<4000;i++){
    const x=lerp(-6500,6500,r()),y=lerp(-3200,Yp-10,Math.pow(r(),.7)),z=lerp(-2500,14000,r());
    const t=clamp((x+2500)/5000),b=.08+.14*r();
    Lp.push([x,y,z,5+r()*3,lerp(255,98,t)*b,lerp(150,210,t)*b,lerp(70,255,t)*b,5,-1,-1]);
  }

  /* groups: 0 always (picture, bridge, lights, atmosphere), 1 the second half of the symbols (the finale finale),
     2 close-up detail (scene shots only), 3 bank worlds (bridge shots only), 4 bridge surfaces (walking only) */
  const grpOf=k=>k===7?1:k===8?2:k===9?3:k===10?4:k===11?5:k===12?6:k===13?7:0;
  /* focus culling: the relief, the walk-only world and the cities are sorted into cells of space; each frame draws only
     the cells inside the camera's view, so the load follows what is on screen */
  const CELL=700,CULL=new Set([0,2,3,4,5,6,7]);
  const cellKey=q=>((Math.floor(q[0]/CELL)+256)*512+(Math.floor(q[2]/CELL)+256))*128+(Math.floor(q[1]/CELL)+64);
  Lp.forEach((q,i)=>{q.g=grpOf(q[7]);q.o=i;q.c=CULL.has(q.g)?cellKey(q):0;q.k=CULL.has(q.g)?r():0;});Lp.sort((a,b)=>a.g-b.g||a.c-b.c||a.k-b.k||a.o-b.o);
  const RNG=[0,0,0,0,0,0,0,0,0];for(const q of Lp)RNG[q.g+1]++;for(let k=1;k<9;k++)RNG[k]+=RNG[k-1];
  const CELLS={0:[],2:[],3:[],4:[],5:[],6:[],7:[]};
  {let cur=null;Lp.forEach((q,i)=>{if(!CULL.has(q.g)){cur=null;return;}
    if(!cur||cur.g!==q.g||cur.c!==q.c){cur={g:q.g,c:q.c,s:i,n:0,x0:1e9,y0:1e9,z0:1e9,x1:-1e9,y1:-1e9,z1:-1e9};CELLS[q.g].push(cur);}
    cur.n++;cur.x0=Math.min(cur.x0,q[0]);cur.x1=Math.max(cur.x1,q[0]);cur.y0=Math.min(cur.y0,q[1]);cur.y1=Math.max(cur.y1,q[1]);cur.z0=Math.min(cur.z0,q[2]);cur.z1=Math.max(cur.z1,q[2]);});
   for(const g in CELLS)for(const c of CELLS[g]){c.x=(c.x0+c.x1)/2;c.y=(c.y0+c.y1)/2;c.z=(c.z0+c.z1)/2;c.r=Math.hypot(c.x1-c.x0,c.y1-c.y0,c.z1-c.z0)/2+(g==='7'?760:60);}}
  const n=Lp.length,SP=strideOf(L_PART),PD_=new Float32Array(n*SP);
  for(let i=0;i<n;i++){
    const q=Lp[i],o=i*SP;
    /* dust: warm on the left, cool on the right, a clear gap between them; they sway but hardly mix */
    const dA=r()*TAU,dR=300+Math.pow(r(),.6)*2500,side=r()<.5?-1:1,sx=side*(260+Math.abs(Math.cos(dA))*dR*1.25),dY=Math.sin(dA)*dR*.75;
    const kk=.55+.45*r(),bcol=r()<.05?[235,235,240]:side<0?WARM:COOL;
    let ux=r()*2-1,uy=r()*2-1,uz=r()*2-1;const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
    const sxp=q[8]>=0?q[8]:(q[2]>50?pr0(q[0],q[1],q[2])[0]:CX);

    const dist=Math.hypot(q[0]-Cc.x,q[1]-Cc.y,q[2]-Cc.z);

    PD_.set([
      sx,dY,-10500+r()*9300,
      q[0],q[1],q[2],q[3],
      bcol[0]*kk/255,bcol[1]*kk/255,bcol[2]*kk/255,
      q[4]/255,q[5]/255,q[6]/255,
      ux,uy,uz,
      Math.cbrt(r()),(r()*Math.max(1,pairs.length))|0,r()*.05,r(),
      q[7]===7?-1:q[7]===8?-2:q[7]===9?-3:q[7]===10?-4:q[7]===13?-5:((r()*3)|0)*TAU/3+r()*.6,q[11]?7:(q[7]<2||q[7]===9||q[7]===5)?-1:.08+.92*Math.sqrt(r()),q[11]?(q[13]??0):q[7]===13?q[12]*90-45:(r()-.5)*90,
      q[7]>=2?clamp(dist/9000)*.5:clamp(dist/16000),clamp(sxp/W),
      r()*TAU,
      q[10]!==undefined?q[10]:(r()*NG)|0
    ],o);
  }
  /* ---- words: a quiet line along the top of the ribbon ---- */
  const qi={q:(r()*SRC.q.length)|0,a:0};
  const WB=[];
  function along(pts,role,hgt,al,gap){
    const cum=[0];
    for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1],pts[i][2]-pts[i-1][2]));
    const total=cum[cum.length-1],list=SRC[role];let pos=hgt*.3,seg=1;
    for(;;){
      const src=list[qi[role]++%list.length],uv=WORD_UV[src.key],wl=uv[4]*hgt*1.333*.82;
      if(pos+wl>total)break;
      const mid=pos+wl/2;
      while(seg<cum.length-1&&cum[seg]<mid)seg++;
      const p0=pts[seg-1],p1=pts[seg],t=(mid-cum[seg-1])/((cum[seg]-cum[seg-1])||1);
      const x=lerp(p0[0],p1[0],t),y=lerp(p0[1],p1[1],t),z=lerp(p0[2],p1[2],t),u=lerp(p0[3],p1[3],t);
      const tlen=Math.hypot(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2])||1;
      WB.push({src,role,x,y,z,tx:(p1[0]-p0[0])/tlen,ty:(p1[1]-p0[1])/tlen,tz:(p1[2]-p0[2])/tlen,h:hgt,al,c:colU(u).map(v=>v*.7+255*.3)});
      pos+=wl+hgt*gap;
    }
  }
  /* the questions run along the top of the ribbon's front face, the answers along its foot */
  {const ln=(dz,v)=>{const p=[];for(let u=0;u<=1.0001;u+=.004)p.push(BPz(u,dz,v));return p;};
   along(ln(-FO*1.012,RH/2+BS*.9),'q',BS*1.1,.5,.6);
   along(ln(-FO*1.012,-RH/2-BS*.7),'a',BS*.9,.42,.6);}
  const NW=Math.min(WB.length,1800),SW=strideOf(L_WORD),WD_=new Float32Array(Math.max(1,NW)*SW);
  for(let i=0;i<NW;i++){
    const b=WB[i];let ux=r()*2-1,uy=r()*2-1,uz=r()*2-1;const ul=Math.hypot(ux,uy,uz)||1;
    const s=pr0(b.x,b.y,b.z);
    const dist=Math.hypot(b.x-Cc.x,b.y-Cc.y,b.z-Cc.z),uv=WORD_UV[b.src.key];
    const sp0=b.src.el?wordSpot(b.src.el):{x:CX+(b.role==='q'?-1:1)*220,y:CY,fs:24},ws={x:(sp0.x-CX)*600/F,y:(sp0.y-CY)*600/F,h:sp0.fs*.78*600/F};
    WD_.set([
      ws.x,ws.y,b.src.k,r()*.012,
      ux/ul,uy/ul,uz/ul,Math.cbrt(r()),
      b.x,b.y,b.z,b.h,
      b.tx,b.ty,b.tz,b.al,
      b.c[0]/255,b.c[1]/255,b.c[2]/255,(b.role==='q'?0:1)+(b.src.accent?0:2),
      ws.h,
      clamp(dist/9000)*.5,clamp(s[0]/W),
      r(),uv[4],
      uv[0],uv[1],uv[2],uv[3]
    ],i*SW);
  }

  const stars=[];for(let i=0;i<Lp.length&&stars.length<70;i++){const q=Lp[i];if(q[7]===0&&lum([q[4],q[5],q[6]])>200&&r()<.25)stars.push([q[0],q[1],q[2],r()*TAU]);}

  const sunS=toS(CFG.sun[0],CFG.sun[1]),sun=[(sunS[0]-CX)*20000/F,(sunS[1]-CY)*20000/F,20000];
  WL={sky:SKY,MIDX:lerp(A.x,B.x,.5),wallT:WALLT,RH,BW,stars,deckAt,sun};
  buildCams();
  /* the hero lies in the sticky full-screen frame of the finale, exactly over the fixed stage (body has no margin) */
  Object.assign(heroFinal.style,{left:FR.x+'px',top:FR.y+'px',width:FR.w+'px',height:FR.h+'px'});



  /* Reuse immutable atlases; dispose every replaced buffer, VAO and texture. */
  const oldGPU=GPU,texW=oldGPU?.texW||makeTex(WORD_ATLAS,true),texG=oldGPU?.texG||makeTex(GLYPH,true);

  GPU={
    pts:makeVAO(PROG.pts.p,PD_,L_PART,0),np:n,rng:RNG,cells:CELLS,
    occ:makeVAO(PROG.occ.p,new Float32Array(OCC),[['aPos',3]],0),no:OCC.length/3,
    wrd:makeVAO(PROG.wrd.p,WD_,L_WORD,1),nw:NW,texW,texG
  };
  glc.disposeResources(gl,oldGPU,new Set([texW,texG]));
  GLYPH=null;WORD_ATLAS=null;
  builtWidth=W;builtHeight=H;
}
/* ---------- camera direction (shot list) ---------- */
let CAMS=null;
function buildCams(){
  const {deckAt,RH}=WL,BWc=WL.BW||70;
  /* over the shoulder of the warm light, looking along the ribbon toward the AI bank */
  /* diagonal views: the world faces the final camera, so looking straight along the ribbon would see it edge-on */
  const a0=deckAt(0),eye=u=>{const p=deckAt(u);return{x:p.x,y:p.y-RH/2-62,z:p.z};};
  const sP={x:a0.x-430,y:a0.y-RH/2-150,z:a0.z-320},sT=eye(.3);sT.y+=30;sT.z+=120;
  const shoulder=Object.assign({},sP,lookAt(sP,sT),{roll:0});
  /* walking the deck inside the truss, eyes a little above the floor, turned slightly toward the valley */
  const travel=(u,pitch)=>{const pos=eye(u),q=eye(Math.min(1,u+.12)),la=lookAt(pos,q);
    return Object.assign(pos,{yaw:la.yaw-.05,pitch:la.pitch+pitch+.04,roll:0});};
  /* stepping onto the deck from above it, so the camera never passes through the side face */
  const onP=eye(.1);onP.y-=RH*.85;onP.z-=BWc*.2;const onto=Object.assign(onP,lookAt(onP,eye(.34)),{roll:0});onto.yaw-=.12;
  /* the end of the walk: look ahead to where the bridge leads */
  const wP=eye(.66);wP.y-=50;const wall=Object.assign(wP,lookAt(wP,WL.wallT),{roll:0});
  const q1=camQ(1);

  const shots=[C(0,q1),C(.05,{y:-20,z:Cc.z-680}),C(.075,{y:-20,z:Cc.z-560}),C(.14,{y:-80,z:-1300}),C(.22,{}),
     C(.26,{x:20,y:-10,z:180,yaw:.04}),C(.31,shoulder),C(.345,onto),C(.38,travel(.34,-.04)),C(.415,travel(.58,-.04)),C(.45,wall),C(.5,{z:-170,y:-12}),C(.69,{}),C(1,{})];
  CAMS=shots;
}
function camF(p){
  const keys=CAMS;
  let i=0;while(i<keys.length-2&&p>keys[i+1].p)i++;
  const a=keys[i],b=keys[i+1],g=clamp((p-a.p)/(b.p-a.p));
  if(reduced){const s=g<.5?a.c:b.c;return{c:Object.assign({},s),fade:1-Math.abs(2*g-1)};}
  const e=EASE.io(g),c={};for(const k in a.c)c[k]=lerp(a.c[k],b.c[k],e);
  return{c,fade:0};
}

/* ---------- finale state segments ---------- */
// 1 core, 2 compressed, 3 world
const SEGS=[{f:1,t:2,a:.05,b:.075,e:'in'},{f:2,t:3,a:.08,b:WORLD_FORMED_PROGRESS,e:'out'}];
function locate(P,segs){
  if(P<=segs[0].a)return{f:segs[0].f,t:segs[0].f,g:0,e:'io'};
  for(let i=segs.length-1;i>=0;i--){const s=segs[i];if(P>=s.a){if(P>=s.b)return{f:s.t,t:s.t,g:1,e:s.e};return{f:s.f,t:s.t,g:(P-s.a)/(s.b-s.a),e:s.e};}}
  return{f:1,t:1,g:0,e:'io'};
}
let time=0;

/* ---------- CPU camera (for overlay effects) ---------- */
let cam=null,cY=1,sY=0,cP=1,sP=0,cR=1,sR=0;
const PR=new Float32Array(3),projectScratch=new Float32Array(3);
function setCam(c){cam=c;cY=Math.cos(c.yaw);sY=Math.sin(c.yaw);cP=Math.cos(c.pitch);sP=Math.sin(c.pitch);cR=Math.cos(c.roll);sR=Math.sin(c.roll);}
function rotate(dx,dy,dz,out){const x1=dx*cY-dz*sY,z1=dx*sY+dz*cY,y2=dy*cP-z1*sP,z2=dy*sP+z1*cP;out[0]=x1*cR-y2*sR;out[1]=x1*sR+y2*cR;out[2]=z2;}
function project(x,y,z){const v=projectScratch;rotate(x-cam.x,y-cam.y,z-cam.z,v);if(v[2]<30)return false;const s=F/v[2];PR[0]=CX+v[0]*s;PR[1]=CY+v[1]*s;PR[2]=s;return true;}
const ROT=new Float32Array(9);
function rotMatrix(){const v=[0,0,0];rotate(1,0,0,v);ROT[0]=v[0];ROT[1]=v[1];ROT[2]=v[2];rotate(0,1,0,v);ROT[3]=v[0];ROT[4]=v[1];ROT[5]=v[2];rotate(0,0,1,v);ROT[6]=v[0];ROT[7]=v[1];ROT[8]=v[2];return ROT;}

/* ---------- GPU draw ---------- */
const LOCK=new Float32Array(6),SEAM=new Float32Array(18);
function setUniforms(P,S,Lc){
  const U=P.U;gl.useProgram(P.p);
  gl.uniform1f(U.uMode,S.mode==='F'?1:0);gl.uniform1f(U.uQT,S.mode==='H'?-1:S.qT);gl.uniform1f(U.uTime,time);
  if(U.uSide)gl.uniform1f(U.uSide,S.mode==='F'?clamp((S.Pf-.26)/.045)*(1-clamp((S.Pf-.46)/.045)):0);
  gl.uniform1f(U.uG,Lc?Lc.g:0);gl.uniform1f(U.uSpread,.5);gl.uniform1f(U.uReduced,reduced?1:0);
  gl.uniform1f(U.uF,Lc?Lc.f:1);gl.uniform1f(U.uT,Lc?Lc.t:1);gl.uniform1f(U.uEase,Lc?EASE_ID[Lc.e]:0);
  gl.uniform1f(U.uFocal,F);if(U.uDetail)gl.uniform1f(U.uDetail,DETAIL);if(U.uAI)gl.uniform1f(U.uAI,AIV);if(U.uWalk)gl.uniform1f(U.uWalk,WALK);if(U.uBuild)gl.uniform1f(U.uBuild,BUILD);if(U.uOff)gl.uniform3f(U.uOff,0,0,0);if(U.uOffA)gl.uniform1f(U.uOffA,1);if(U.uSun)gl.uniform3f(U.uSun,WL.sun[0],WL.sun[1],WL.sun[2]);if(U.uDpr)gl.uniform1f(U.uDpr,DPR);
  gl.uniform1fv(U.uLock,LOCK);gl.uniform3fv(U.uSeam,SEAM);
  gl.uniform3f(U.uCamPos,cam.x,cam.y,cam.z);gl.uniformMatrix3fv(U.uRot,false,ROT);
  gl.uniform2f(U.uCenter,CX,CY);gl.uniform2f(U.uRes,W,H);
  gl.uniform4f(U.uCore,Cc.x,Cc.y,Cc.z,RC);

}
function renderGL(S,Lc){
  for(let k=0;k<6;k++){LOCK[k]=T.lock[Math.min(k,T.lock.length-1)];const s=T.seam[k]||Cc;SEAM[k*3]=s.x;SEAM[k*3+1]=s.y;SEAM[k*3+2]=s.z;}
  rotMatrix();
  gl.viewport(0,0,cvG.width,cvG.height);
  gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  setUniforms(PROG.pts,S,Lc);gl.blendFunc(gl.ONE,gl.ONE);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,GPU.texG);gl.uniform1i(PROG.pts.U.uGlyph,0);gl.uniform2f(PROG.pts.U.uGrid,GCOLS,GROWS);
  gl.bindVertexArray(GPU.pts.v);
  {const R=GPU.rng,on=[true,DETAIL>0,S.mode==='F'&&S.Pf>.17&&S.Pf<.52,AIV>0];
   const range=k=>{if(R[k+1]>R[k])gl.drawArrays(gl.POINTS,R[k],R[k+1]-R[k]);};
   const v=[0,0,0],hw=W*.75/F,hh=H*.75/F;
   const cells=(g,ox,oy,oz,keep)=>{let s0=-1,e0=-1;
     for(const c of GPU.cells[g]){
       if(keep&&!keep(c))continue;
       rotate(c.x+ox-cam.x,c.y+oy-cam.y,c.z+oz-cam.z,v);const zf=v[2]+c.r;
       const vis=zf>30&&v[2]-c.r<26000&&Math.abs(v[0])-c.r<hw*zf&&Math.abs(v[1])-c.r<hh*zf;
       if(!vis)continue;
       if(c.s===e0)e0+=c.n;else{if(e0>s0)gl.drawArrays(gl.POINTS,s0,e0-s0);s0=c.s;e0=c.s+c.n;}}
     if(e0>s0)gl.drawArrays(gl.POINTS,s0,e0-s0);};
   /* the settled scene (side views and the walk) is drawn by cells; the frontal picture, the flights and the morph whole */
   const FOC=S.mode==='F'&&S.Pf>.25&&S.Pf<.5,part=k=>FOC?cells(k,0,0,0):range(k);
   for(let k=0;k<3;k++)if(on[k])(k===1?range(k):part(k));
   if(on[3])cells(3,0,0,0);
   if(on[3]){
     cells(7,0,0,0);
     /* copies further out: the far city repeated behind itself, the near town repeated up the hills */
     const U=PROG.pts.U,mid=WL.MIDX;
     for(const [ox,oz,al,side] of [[3600,1500,.3,1],[-2300,1900,.3,-1]]){
       gl.uniform3f(U.uOff,ox,0,oz);gl.uniform1f(U.uOffA,al);cells(7,ox,0,oz,c=>side>0?c.x>mid+200:c.x<mid);}
     gl.uniform3f(U.uOff,0,0,0);gl.uniform1f(U.uOffA,1);
   }
   /* the matte road fades in while walking: a black plane over what lies below, then the road skin on top */
   if(WALK>0&&Lc){
     gl.clear(gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);
     setUniforms(PROG.occ,S,Lc);gl.uniform1f(PROG.occ.U.uOccA,Math.min(.3,WALK*.32));gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
     gl.bindVertexArray(GPU.occ.v);gl.drawArrays(gl.TRIANGLES,0,GPU.no);
     gl.depthMask(false);gl.useProgram(PROG.pts.p);gl.blendFunc(gl.ONE,gl.ONE);gl.bindVertexArray(GPU.pts.v);
   }
   /* the bridge itself is depth-tested against the road while walking, so the far side of the hump does not show through */
   part(5);if(WALK>0)cells(4,0,0,0);part(6);
   gl.disable(gl.DEPTH_TEST);gl.depthMask(true);}
  gl.disable(gl.DEPTH_TEST);
  setUniforms(PROG.wrd,S,Lc);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,GPU.texW);gl.uniform1i(PROG.wrd.U.uTex,0);
  gl.bindVertexArray(GPU.wrd.v);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,GPU.nw);
  gl.bindVertexArray(null);
}

/* ---------- overlay: core glow, lock rings, bridge pulses, twinkles, network lines, shot fades ---------- */
function glowAt(c,x,y,R,col,a){const q=c.createRadialGradient(x,y,0,x,y,R);q.addColorStop(0,'rgba('+col+','+a+')');q.addColorStop(1,'rgba('+col+',0)');c.fillStyle=q;c.fillRect(x-R,y-R,R*2,R*2);}
let fxDirty=true;


function renderFx(S,Lc,fade){
  const {mode,qT,Pf}=S;
  const coreOn=mode!=='F'||Pf<.24;
  const ringOn=mode==='Q'&&!reduced&&T.lock.some(l=>qT-l>=0&&qT-l<=.05);
  const sceneLive=Lc&&Lc.f===3&&Lc.t===3&&!reduced;
  const skyOn=mode==='F'&&AIV>0&&WL?.sky;
  const any=coreOn||ringOn||sceneLive||skyOn||fade>.01;
  if(!any&&!fxDirty)return;
  fctx.setTransform(1,0,0,1,0,0);fctx.clearRect(0,0,cvF.width,cvF.height);fxDirty=any;
  if(!any)return;
  fctx.setTransform(DPR,0,0,DPR,0,0);
  if(skyOn){
    const sky=WL.sky,point=p=>project(p.x,p.y,p.z)?PR:null;
    const segment=(a,b,alpha)=>{const p=point(a);if(!p)return;const px=p[0],py=p[1],q=point(b);if(!q)return;
      fctx.globalAlpha=alpha*AIV;fctx.beginPath();fctx.moveTo(px,py);fctx.lineTo(q[0],q[1]);fctx.stroke();};
    fctx.save();fctx.globalCompositeOperation='lighter';
    for(const star of sky.stars){const p=point(star);if(!p)continue;
      fctx.globalAlpha=AIV*(.08+.22*(.5+.5*Math.sin(time*.45+star.phase)));
      fctx.fillStyle='#94bfe8';fctx.fillRect(p[0],p[1],1.2,1.2);
    }
    const gc=sky.galaxyCenter,angle=time*.012,cs=Math.cos(angle),sn=Math.sin(angle);
    fctx.font='400 8px '+MONO;fctx.textAlign='center';fctx.textBaseline='middle';
    sky.galaxy.forEach((g,i)=>{
      const p=point({x:gc.x+g.x,y:gc.y+g.y*cs+g.z*sn*.28,z:gc.z+g.z*cs-g.y*sn});if(!p)return;
      fctx.globalAlpha=AIV*(.12+.4*(1-g.t));fctx.fillStyle=g.t<.18?'#e0dcff':i%3?'#737fc5':'#b895e7';
      if(i%5===0)fctx.fillText(TXT[g.ch%TXT.length]||'·',p[0],p[1]);else fctx.fillRect(p[0],p[1],1.3,1.3);
    });
    const center=point(gc);if(center)glowAt(fctx,center[0],center[1],Math.min(W*.15,180),'134,130,230',AIV*.045);
    fctx.strokeStyle='#64d5ff';fctx.lineWidth=.65;
    sky.edges.forEach(([i,j],k)=>{
      const a=sky.nodes[i],b=sky.nodes[j];segment(a,b,.1);
      const t=(time*.07+k*.173)%1,p=point({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z:lerp(a.z,b.z,t)});
      if(p){fctx.globalAlpha=AIV*.65;fctx.fillStyle='#bfddff';fctx.fillRect(p[0]-1,p[1]-1,2,2);}
    });
    for(const node of sky.nodes){const p=point(node);if(!p)continue;
      fctx.globalAlpha=AIV*.6;fctx.fillStyle='#b5d3ff';fctx.beginPath();fctx.arc(p[0],p[1],1.8,0,TAU);fctx.fill();
      glowAt(fctx,p[0],p[1],12,'100,213,255',AIV*.08);
    }
    fctx.restore();
  }
  if(coreOn&&project(Cc.x,Cc.y,Cc.z)){
    let fill=0;for(const l of T.lock)fill+=clamp((qT-l)/.16);if(mode==='F')fill=6;
    /* flash: fast rise into the burst, slower white-hot decay */
    const pk=.08,dd=Pf-pk;
    const blast=mode==='F'?(dd<0?Math.pow(clamp(1+dd/.012),3):Math.pow(clamp(1-dd/.05),1.6)):0;
    const R=Math.min(Math.max(W,H)*1.6,RC*PR[2]*(1.6+fill*.25)+blast*Math.max(W,H)*1.2);
    fctx.globalCompositeOperation='lighter';
    glowAt(fctx,PR[0],PR[1],R*.7,'255,214,140',.014+fill*.006+blast*.45);
    glowAt(fctx,PR[0],PR[1],R*.3,'255,236,170',.035+fill*.012+blast*.6);
    if(blast>.01&&!reduced){fctx.globalAlpha=Math.pow(blast,1.6)*.38;fctx.fillStyle='#fffaf0';fctx.fillRect(0,0,W,H);fctx.globalAlpha=1;}
    fctx.globalCompositeOperation='source-over';
  }
  if(ringOn){
    T.lock.forEach(l=>{const d=(qT-l)/.05;if(d<0||d>1)return;
      fctx.globalAlpha=(1-d)*.45;fctx.strokeStyle='#dfefff';fctx.lineWidth=1.5*(1-d)+.4;
      fctx.beginPath();fctx.arc(CX,CY,d*Math.max(W,H)*.6,0,TAU);fctx.stroke();fctx.globalAlpha=1;});
  }
  if(sceneLive){
    
    fctx.textAlign='center';fctx.textBaseline='middle';
    fctx.strokeStyle='#fff';fctx.lineWidth=1;
    for(const s of WL.stars){
      const a=Math.max(0,Math.sin(time*1.6+s[3]));if(a<.05||!project(s[0],s[1],s[2]))continue;
      const l=2+a*4;fctx.globalAlpha=a*.6;
      fctx.beginPath();fctx.moveTo(PR[0]-l,PR[1]);fctx.lineTo(PR[0]+l,PR[1]);fctx.moveTo(PR[0],PR[1]-l);fctx.lineTo(PR[0],PR[1]+l);fctx.stroke();
    }
    fctx.globalAlpha=1;
  }
  if(fade>.01){fctx.globalAlpha=fade;fctx.fillStyle='#000';fctx.fillRect(0,0,W,H);fctx.globalAlpha=1;}
}

/* ---------- DOM sync ---------- */
function updateCaps(Pf){
  caps.forEach((c,i)=>{
    const v=c.dataset.range;if(!v)return;
    const [a,b]=v.split(' ').map(Number);
    const entry=i===0?sceneHandoff(Pf).card:(a<=0?1:clamp((Pf-a)/.02));
    const o=Math.min(entry,clamp((b-Pf)/.02));
    const s=o.toFixed(2);if(c._o!==s){c._o=s;c.style.opacity=s;c.style.visibility=o<.02?'hidden':'visible';
      c.style.transform=reduced?'':'translateY('+((1-o)*(Pf<(a+b)/2?18:-12)).toFixed(1)+'px)';}
  });
}
function updatePairs(){
  const vh=innerHeight;
  pairs.forEach((s,i)=>{
    const {top,height}=T.bounds[i],p=clamp((Ys-top)/Math.max(1,height-vh));
    if(top+height-scrollY>-50&&top-scrollY<vh+50){const v=reduced?Math.min(p,.8):Math.round(p*1500)/1500;if(s._v!==v){s._v=v;s.style.setProperty('--p',v);}}

  });
}

function updateMeter(mode,Pf){
  if(!meter)return;
  const phaseFade=mode==='F'&&Pf>=SCENE_HANDOFF_START;
  meter.classList.toggle('phase-fade',phaseFade);
  const opacity=mode==='F'?sceneHandoff(Pf).navigation:1;
  if(meter._opacity!==opacity){meter._opacity=opacity;meter.style.setProperty('--meter-phase-opacity',opacity.toFixed(4));}
  const show=Ys>=T.qStart-innerHeight*.8&&(mode!=='F'||Pf<SCENE_NAV_END);
  if(meter._show!==show){meter._show=show;meter.classList.toggle('on',show);meter.toggleAttribute('inert',!show);meter.setAttribute('aria-hidden',String(!show));}
  const p=Math.round(meterProgress(Ys,T.qStart,T.checkpoints)*1500)/1500;
  if(meter._progress===p)return;meter._progress=p;
  const shape=bridgeMeterGeometry(p);
  meterCables.forEach(path=>path.setAttribute('d',shape.path));
  meterDecks.forEach(path=>path.setAttribute('d',shape.deckPath));
  meterReveal?.setAttribute('width',String(336*p));
  meterHangers.forEach(line=>{const u=Number(line.dataset.u);line.setAttribute('y1',shape.yAt(u).toFixed(2));line.setAttribute('y2',shape.deckAt(u).toFixed(2));});
  meterNodes.forEach((node,i)=>{
    const u=i/(meterNodes.length-1);
    node.style.setProperty('--node-y',shape.yAt(u).toFixed(2));
    node.style.setProperty('--node-color','rgb('+WARM.map((v,j)=>Math.round(lerp(v,COOL[j],u))).join(',')+')');
    node.classList.toggle('is-complete',p>=u-.0007);
    if(i===Math.max(0,Math.min(meterNodes.length-1,Math.ceil(p*(meterNodes.length-1)))))node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
  });
}
function seekCheckpoint(index){
  if(!Number.isInteger(index)||index<-1||index>=T.checkpoints.length)return;
  stopPlay();measure();const target=index===-1?0:T.checkpoints[index];
  if(reduced){seeking=null;scrollTo(0,target);first=true;lastKey='';return;}
  seeking={from:scrollY,to:target,start:performance.now(),duration:520};
}
const cancelSeek=e=>{if(e.type!=='keydown'||['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key))seeking=null;};
/* ---------- loop ---------- */
let windPhase={mode:'H',progress:0};
let last=performance.now(),lastKey='',ready=false,prevSy=scrollY,lastMove=0,idleA=0;
function frame(now){
  if(document.hidden)return;
  if(resizePending){resizePending=false;syncViewport();}
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(seeking){
    const t=clamp((now-seeking.start)/seeking.duration),y=lerp(seeking.from,seeking.to,EASE.io(t));
    scrollTo(0,y);Ys=y;Yv=0;first=true;if(t>=1)seeking=null;
  }
  const live=!paused&&!reduced;
  if(live)time+=dt;
  const sy=scrollY;
  if(first||reduced||Math.abs(sy-Ys)>innerHeight*2.5){Ys=sy;Yv=0;first=false;}else{const w=4.2,ac=w*w*(sy-Ys)-2*w*Yv;Yv+=ac*dt;Ys+=Yv*dt;}
  updatePairs();
  const mode=Ys<T.qStart?'H':Ys<T.finTop?'Q':'F';
  const qT=clamp((Ys-T.qStart)/(T.qEnd-T.qStart));
  /* the scene runs at its pace up to the hero; after that the remaining finale is crossed quickly */
  const Praw=clamp((Ys-T.finTop)/T.finLen),Pf=sceneFinaleProgress(Praw);
  opts.onAudioLevel?.(sceneAudioGain(mode,Pf));
  const particleProgress=mode==='Q'?qT:Pf;
  const particleSpeed=windPhase.mode===mode?(particleProgress-windPhase.progress)/Math.max(.001,dt)/(mode==='Q'?.15:.14):0;
  windPhase.mode=mode;windPhase.progress=particleProgress;
  opts.onWind?.(sceneWindIntensity(mode,Pf,qT,T.lock,particleSpeed));
  opts.onBurst?.(mode==='F'?sceneExplosionIntensity(Pf,particleSpeed):0);
  root.classList.toggle('in-finale',mode==='F'&&sy<T.finTop+T.finLen+2);
  // The final frame gains a finer layer of symbols in place.
  DETAIL=mode==='F'?(reduced?(Pf>.6?1:0):EASE.io(clamp((Pf-.5)/.2))):0;
  AIV=mode==='F'?clamp((Pf-.24)/.05)*(1-clamp((Pf-.47)/.05)):0;
  BUILD=mode==='F'?(reduced?(Pf>.24?1:0):clamp((Pf-.2)/.08)):0;
  WALK=mode==='F'?clamp((Pf-.285)/.025)*(1-clamp((Pf-.455)/.03)):0;
  const over=Math.max(0,sy-(T.finTop+T.finLen+SCENE_EXIT_HOLD)),gone=over>innerHeight;
  {
    const tx=mode==='F'?clamp((Pf-.72)/.06):0;
    heroFinal.style.setProperty('--txt',tx.toFixed(3));
    const reveal=mode==='F'?(reduced?(Pf>=.78?1:0):filmReveal(Pf)):0;
    root.style.setProperty('--film-open',reveal.toFixed(4));
    root.classList.toggle('scene-complete',reveal>=.9999);
    root.classList.toggle('scene-scrollbar',mode==='F'&&Pf>=SCENE_NAV_END);
    const controls=1-EASE.io(clamp(reveal/.6));root.style.setProperty('--film-controls',controls.toFixed(4));
    const finished=controls<=.0001;root.classList.toggle('film-finished',finished);
    if(filmControls&&filmControls.hasAttribute('inert')!==finished)filmControls.toggleAttribute('inert',finished);
    heroFinal.style.visibility=tx>.01?'visible':'hidden';
    const tf=over>0?'translate3d(0,'+(-Math.min(over,innerHeight+40)).toFixed(1)+'px,0)':'';
    if(stage.style.transform!==tf)stage.style.transform=tf;
    root.classList.toggle('after-film',over>innerHeight*.3);
  }
  if(Math.abs(sy-prevSy)>.5)lastMove=now;prevSy=sy;
  const idleT=now-lastMove>700?1:0;idleA+=(idleT-idleA)*Math.min(1,dt*(idleT?.6:2.5));
  updateMeter(mode,Pf);
  updateCaps(Pf);
  if(ready&&!gone){
    let c,fade=0;
    if(mode==='H'){c=camQ(0);c.z-=1400*(1-clamp(Ys/T.qStart));}
    else if(mode==='Q')c=reduced?camQ(.5):camQ(qT);
    else{const r=camF(Pf);c=r.c;fade=r.fade;}
    if(live){
      /* living camera: a slow drift that grows when the reader stops scrolling, so depth shows as parallax */
      const kk=WALK>0?.1:(mode==='F'&&Pf>.47?.06:1);
      const ix=Math.sin(time*.21)*120*idleA*kk,iy=(WALK>0?-Math.abs(Math.cos(time*.16)):Math.cos(time*.16))*45*idleA*kk,iz=Math.sin(time*.13)*80*idleA*kk;
      const br=1;
      c.x+=ix+Math.sin(time*.31)*7*br;c.y+=iy+Math.sin(time*.23)*5*br;c.z+=iz;c.yaw-=ix/2800;c.pitch-=iy/2800;c.roll+=Math.sin(time*.17)*.006*br;
      if(mode==='F'){const a=.05,b=.08;if(Pf>a&&Pf<b){const amp=Math.sin(Math.PI*(Pf-a)/(b-a));c.x+=Math.sin(time*47)*10*amp;c.y+=Math.cos(time*41)*7*amp;c.roll+=Math.sin(time*31)*.018*amp;}}
    }
    const key=mode+'|'+Ys.toFixed(1)+'|'+reduced;
    if(live||key!==lastKey){
      setCam(c);
      const S={mode,qT,Pf},Lc=mode==='F'?locate(Pf,SEGS):null;
      renderGL(S,Lc);renderFx(S,Lc,fade);
      lastKey=key;
    }
  }
  if(running)rafId=requestAnimationFrame(frame);
}
let running=true,rafId=0;
measure();applyMotion();
rafId=requestAnimationFrame(frame);
/* build once: after the text font is ready, off the critical path */
let PHOTO=null,DETAIL=0,AIV=0,WALK=0,BUILD=0;

const IMGCFG={...DEFAULT_IMGCFG,...opts.image};

const loadPhoto=src=>new Promise(res=>{
  if(!src){res(null);return;}
  const im=new Image(),timer=setTimeout(()=>finish(null),6000);
  function finish(value){clearTimeout(timer);im.onload=im.onerror=null;res(value);}
  im.onload=()=>finish(im);im.onerror=()=>finish(null);im.src=src;
});
async function start(){
  if(!gl||!running)return;
  const photo=await loadPhoto(IMGCFG.src);
  if(!running)return;
  PHOTO=photo;
  measure();makeWordAtlas();makeGlyphs();build();
  ready=true;lastKey='';
  requestAnimationFrame(()=>{if(running)root.classList.add('ready');});
}
const fontReady=document.fonts&&document.fonts.load?Promise.race([Promise.all([document.fonts.load('500 semi-condensed 48px "Noto Sans"','Light and space'),document.fonts.load('400 48px "Martian Mono"','LIGHT AND SPACE'),document.fonts.load('400 24px "JetBrains Mono"')]),new Promise(r=>setTimeout(r,1500))]):Promise.resolve();
fontReady.then(()=>setTimeout(start,30),()=>setTimeout(start,30));

let rt;
const onResize=()=>{
  resizePending=true;clearTimeout(rt);
  rt=setTimeout(()=>{
    if(!running)return;
    syncViewport();measure();
    if(ready&&(W!==builtWidth||H!==builtHeight))build();
    lastKey='';
  },180);
};
// Caption components can be replaced by hot reload or a host application's content update.
const capsHost=opts.container.querySelector('.caps');
const capsObserver=new MutationObserver(()=>{caps=[...opts.container.querySelectorAll('.cap')];lastKey='';});
if(capsHost)capsObserver.observe(capsHost,{childList:true,subtree:true});
const resizeObserver=new ResizeObserver(onResize);resizeObserver.observe(stage);
addEventListener('resize',onResize);
const onVisibility=()=>{
  cancelAnimationFrame(rafId);
  if(!document.hidden&&running){last=performance.now();resizePending=true;lastKey='';rafId=requestAnimationFrame(frame);}
};
document.addEventListener('visibilitychange',onVisibility);
addEventListener('wheel',cancelSeek,{passive:true});addEventListener('touchstart',cancelSeek,{passive:true});addEventListener('keydown',cancelSeek);
return {
  /** Re-measure section positions (call after the page layout above the scene changes). */
  refresh(){measure();lastKey='';},
  seekCheckpoint,
  setPaused(p){paused=!!p;},
  setReducedMotion(r){reduced=r==null?mq.matches:!!r;applyMotion();lastKey='';},
  /** Export the symbol frame without DOM text. */
  captureFrame({type='image/png',quality=.95}={}){
    lastKey='';
    return new Promise(res=>requestAnimationFrame(()=>requestAnimationFrame(()=>cvG.toBlob(res,type,quality))));
  },
  /** Play the scene by itself, like a film, to the finished hero. Any wheel, touch or scroll key stops it. */
  play(){play();},
  stop(){seeking=null;stopPlay();},
  isPlaying(){return !!auto;},
  /** Jump to the finished hero (for returning visitors). */
  skipToHero(){seeking=null;scrollTo(0,playEnd());},
  destroy(){stopPlay();running=false;cancelAnimationFrame(rafId);clearTimeout(rt);removeEventListener('resize',onResize);resizeObserver.disconnect();capsObserver.disconnect();document.removeEventListener('visibilitychange',onVisibility);seeking=null;removeEventListener('wheel',cancelSeek);removeEventListener('touchstart',cancelSeek);removeEventListener('keydown',cancelSeek);
    glc.disposeResources(gl,GPU);GPU=null;if(gl&&PROG)Object.values(PROG).forEach(p=>gl.deleteProgram(p.p));PROG=null;WL=null;PHOTO=null;GLYPH=null;WORD_ATLAS=null;
    mq.removeEventListener('change',onMq);
    root.classList.remove('ready','in-finale','rm','no-gl','is-playing','after-film','film-finished','scene-complete','scene-scrollbar');stage.style.transform='';filmControls?.removeAttribute('inert');
    for(const key of ['--film-top','--film-bottom','--film-open','--film-controls','--scene-exit-hold'])root.style.removeProperty(key);}
};
}
