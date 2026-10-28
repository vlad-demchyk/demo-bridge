import {useLayoutEffect} from 'react';

/* Measure only on layout/font changes, never during the scroll/render loop. */
export function useCaptionShade(ref){
  useLayoutEffect(()=>{
    const card=ref.current;if(!card)return;
    let raf=0,disposed=false;
    const measure=()=>{
      raf=0;if(disposed)return;
      const origin=card.getBoundingClientRect(),range=document.createRange();
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      const include=r=>{if(r.width<=0||r.height<=0)return;left=Math.min(left,r.left);top=Math.min(top,r.top);right=Math.max(right,r.right);bottom=Math.max(bottom,r.bottom);};
      for(const el of card.querySelectorAll('p,h3,b,dt,dd,.cap-tags span,.cap-s li,.cap-m > span,.cap-bar')){
        if(el.matches('.cap-tags span,.cap-bar')){include(el.getBoundingClientRect());continue;}
        range.selectNodeContents(el);for(const rect of range.getClientRects())include(rect);
        // Generated list numbers are outside the text range, but need the same protection.
        if(el.matches('.cap-s li'))left=Math.min(left,el.getBoundingClientRect().left);
      }
      if(Number.isFinite(left)){
        for(const [key,value] of Object.entries({left:left-origin.left,top:top-origin.top,width:right-left,height:bottom-top}))card.style.setProperty('--shade-'+key,value.toFixed(2)+'px');
      }
    };
    const schedule=()=>{if(!raf)raf=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);observer.observe(card);
    addEventListener('resize',schedule);document.fonts?.ready.then(()=>{if(!disposed)schedule();});measure();
    return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();removeEventListener('resize',schedule);};
  },[ref]);
}
