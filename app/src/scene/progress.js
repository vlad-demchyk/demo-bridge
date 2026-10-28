import {clamp,EASE} from './math.js';

export const SCENE_HANDOFF_START=.14;
export const FIRST_CARD_START=.20;
export const WORLD_FORMED_PROGRESS=.22;
export const SCENE_NAV_END=.17;
export function sceneHandoff(phase){
  const navigation=1-EASE.io(clamp((phase-SCENE_HANDOFF_START)/(SCENE_NAV_END-SCENE_HANDOFF_START)));
  const card=EASE.io(clamp((phase-FIRST_CARD_START)/(WORLD_FORMED_PROGRESS-FIRST_CARD_START)));
  return{navigation,card};
}
// The approach to the burst uses 60% of its previous scroll distance.
const BURST_PHASE=.08,BURST_SCROLL=.08*(.78/.72)*.6;
export function finaleProgress(raw){
  if(raw<BURST_SCROLL)return raw/BURST_SCROLL*BURST_PHASE;
  return raw<.78?BURST_PHASE+(raw-BURST_SCROLL)/(.78-BURST_SCROLL)*(.72-BURST_PHASE):.72+(raw-.78)/.22*.28;
}
export function finaleScrollProgress(phase){
  if(phase<BURST_PHASE)return phase/BURST_PHASE*BURST_SCROLL;
  return phase<.72?BURST_SCROLL+(phase-BURST_PHASE)/(.72-BURST_PHASE)*(.78-BURST_SCROLL):.78+(phase-.72)/.28*.22;
}
// End the sticky scene when the final frame and cinema reveal are complete.
export const FINALE_END_PHASE=.84;
export const SCENE_EXIT_HOLD=120;
export const sceneTravel=(finaleHeight,viewportHeight)=>Math.max(1,finaleHeight-viewportHeight-SCENE_EXIT_HOLD);
export const FINALE_RAW_END=finaleScrollProgress(FINALE_END_PHASE);
export const sceneFinaleProgress=scrollProgress=>finaleProgress(clamp(scrollProgress)*FINALE_RAW_END);
export const sceneFinaleScrollProgress=phase=>finaleScrollProgress(phase)/FINALE_RAW_END;
export function pairPlaybackRate(scroll,bounds,viewportHeight){
  for(const {top,height} of bounds){
    const p=(scroll-top)/Math.max(1,height-viewportHeight);
    if(p>=.62&&p<=.95){
      const envelope=Math.min(clamp((p-.62)/.06),clamp((.95-p)/.06));
      return 1-.35*EASE.io(envelope);
    }
  }
  return 1;
}
export function checkpointTimeline(bounds,finTop,finLen,viewportHeight){
  return [...bounds.map(({top,height})=>top+.74*Math.max(1,height-viewportHeight)),finTop+finLen*sceneFinaleScrollProgress(SCENE_HANDOFF_START)];
}
export function meterProgress(scroll,start,stops){
  if(scroll<=start||!stops.length)return 0;
  let previous=start;
  for(let i=0;i<stops.length;i++){
    if(scroll<=stops[i])return(i+clamp((scroll-previous)/Math.max(1,stops[i]-previous)))/stops.length;
    previous=stops[i];
  }
  return 1;
}
// Wide tapered deck, with a raised central arch; all curves collapse to one line at zero.
export function bridgeMeterGeometry(progress){
  const p=EASE.io(clamp(progress));
  const deckAt=u=>34-p*19*Math.pow(Math.sin(Math.PI*u),3);
  const yAt=u=>{const v=clamp((u-.22)/.56);return deckAt(u)-(v>0&&v<1?p*13*Math.pow(Math.sin(Math.PI*v),.8):0);};
  const curve=fn=>'M'+Array.from({length:97},(_,i)=>{const u=i/96;return(12+336*u).toFixed(2)+','+fn(u).toFixed(2);}).join(' L');
  return{path:curve(yAt),deckPath:curve(deckAt),yAt,deckAt};
}
