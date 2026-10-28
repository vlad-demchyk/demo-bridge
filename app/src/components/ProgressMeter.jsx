import {useId} from 'react';

/* One continuous gradient and a bridge silhouette driven by overall scene progress. */
export function ProgressMeter({meterRef, count, onSeek}) {
  const id=useId().replace(/:/g,''),gradient='meter-gradient-'+id,clip='meter-clip-'+id;
  const checkpoints=['Start',...Array.from({length:count+1},(_,i)=>i<count?'Part '+(i+1)+': words and motion':'Formation: scene overview')];
  return (
    <nav className="meter" ref={meterRef} aria-label="Scene checkpoints" aria-hidden="true" inert="">
      <span className="warm">START</span>
      <div className="meter-bridge">
        <svg viewBox="0 0 360 52" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={gradient} x1="12" y1="0" x2="348" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--warm)" /><stop offset="1" stopColor="var(--cool)" />
            </linearGradient>
            <clipPath id={clip}><rect data-meter-reveal x="12" y="0" width="0" height="52" /></clipPath>
          </defs>
          <path className="meter-track" data-meter-deck d="M12 34 H348" />
          <path className="meter-track" data-meter-cable d="M12 34 H348" />
          <g className="meter-filled" stroke={'url(#'+gradient+')'} clipPath={'url(#'+clip+')'}>
            <path data-meter-deck d="M12 34 H348" />
            <path data-meter-cable d="M12 34 H348" />
            {Array.from({length:19},(_,i)=><line key={i} data-meter-hanger data-u={(i+1)/20} x1={12+336*(i+1)/20} x2={12+336*(i+1)/20} y1="34" y2="34" />)}
          </g>
        </svg>
        {checkpoints.map((label,i)=>(
          <button key={i} type="button" className="meter-node" data-checkpoint={i-1}
            style={{left:(12+336*i/(checkpoints.length-1))/360*100+'%'}}
            aria-label={label} title={label} onClick={()=>onSeek(i-1)}>
            <span className="sr-only">{label}</span>
          </button>
        ))}
      </div>
      <span className="cool">VIEW</span>
    </nav>
  );
}