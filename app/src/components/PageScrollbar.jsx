import {useEffect,useRef,useState} from 'react';
import {sceneFinaleScrollProgress,SCENE_NAV_END,sceneTravel} from '../scene/progress.js';

/* A page scrollbar appears only after the cinematic section; it never drives scene phases. */
export function PageScrollbar({finaleRef,containerRef}){
  const bounds=useRef({start:0,end:1});
  const [value,setValue]=useState(0),[visible,setVisible]=useState(false);
  useEffect(()=>{
    let raf=0;
    const update=()=>{
      raf=0;const {start,end}=bounds.current;
      setVisible(scrollY>=start-2);
      setValue(Math.round(Math.max(0,Math.min(1,(scrollY-start)/Math.max(1,end-start)))*1000));
    };
    const measure=()=>{
      const finale=finaleRef.current;if(!finale)return;
      bounds.current={start:finale.getBoundingClientRect().top+scrollY+sceneTravel(finale.offsetHeight,innerHeight)*sceneFinaleScrollProgress(SCENE_NAV_END),end:document.documentElement.scrollHeight-innerHeight};update();
    };
    const scroll=()=>{if(!raf)raf=requestAnimationFrame(update);};
    const observer=new ResizeObserver(measure);
    if(containerRef.current)observer.observe(containerRef.current);
    addEventListener('scroll',scroll,{passive:true});addEventListener('resize',measure);measure();
    return()=>{cancelAnimationFrame(raf);observer.disconnect();removeEventListener('scroll',scroll);removeEventListener('resize',measure);};
  },[finaleRef,containerRef]);
  return <div className={'page-scrollbar'+(visible?' is-visible':'')} style={{'--scroll-progress':value/1000}}>
    <span className="page-scrollbar-thumb" aria-hidden="true" />
    <input className="page-scrollbar-input" type="range" min="0" max="1000" step="1" value={value}
    aria-label="Page scroll after the scene" aria-orientation="vertical" aria-controls="page-content"
    aria-hidden={!visible} disabled={!visible} tabIndex={visible?0:-1}
    onChange={e=>{const next=Number(e.target.value);setValue(next);const {start,end}=bounds.current;scrollTo(0,start+(end-start)*next/1000);}} />
  </div>;
}
