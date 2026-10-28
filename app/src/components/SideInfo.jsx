import {useId,useRef} from 'react';
import {useCaptionShade} from '../hooks/useCaptionShade.js';

/* One block of side information during the finale. The engine fades it in and out by its range,
   read from data-range ("from to" in finale progress). */
export function SideInfo({side, range, kicker, title, text, metric, facts, tags, steps, bar}) {
  const titleId=useId(),shadeRef=useRef(null);
  useCaptionShade(shadeRef);
  const r = v => (v ? v.join(' ') : undefined);
  const Metric = metric && (
    <div className="cap-m"><b>{metric.value}</b><span>{metric.label.map((l, i) => <span key={i}>{l}<br /></span>)}</span></div>
  );
  return (
    <div className={'cap-region '+side}>
    <aside ref={shadeRef} className={'cap ' + side} data-range={r(range)} aria-labelledby={titleId}>
      <p className="cap-k">{kicker}</p>
      <h3 className="cap-h" id={titleId}>{title}</h3>
      {metric && !text && Metric}
      {text && !metric && <p className="cap-t">{text}</p>}
      {text && metric && side === 'l' && (<><p className="cap-t">{text}</p>{Metric}</>)}
      {text && metric && side === 'r' && (<>{Metric}<p className="cap-t">{text}</p></>)}
      {facts && <dl className="cap-d">{facts.map(([k, v]) => [<dt key={k + 't'}>{k}</dt>, <dd key={k + 'd'}>{v}</dd>])}</dl>}
      {tags && <div className="cap-tags">{tags.map(t => <span key={t}>{t}</span>)}</div>}
      {steps && <ol className="cap-s">{steps.map(t => <li key={t}>{t}</li>)}</ol>}
      {bar && (<><div className="cap-bar" style={{'--w': bar.value + '%'}}><i /></div><p className="cap-k cap-note">{bar.label}</p></>)}
    </aside>
    </div>
  );
}
