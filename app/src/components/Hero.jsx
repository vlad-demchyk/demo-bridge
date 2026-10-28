import {Icon} from './Icon.jsx';
import {useEffect, useState} from 'react';
import {HERO} from '../content/landing.js';

/* Opening screen. Returning visitors get a link that skips the flight and lands on the finished hero. */
export function Hero({onSkip}) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    try { setSeen(localStorage.getItem('mist-seen') === '1'); localStorage.setItem('mist-seen', '1'); } catch { /* storage blocked */ }
  }, []);
  return (
    <section className="hero" id="top">
      <p className="eyebrow">{HERO.eyebrow}</p>
      <h1>{HERO.title.map((p, i) => p.tone ? <span key={i} className={p.tone}>{p.t}</span> : p.t)}</h1>
      <p className="lead">{HERO.lead}</p>
      <p className="cue">
        <i aria-hidden="true" />{HERO.cue}
        {seen && <button type="button" className="skip" onClick={onSkip}>{HERO.skip}<Icon /></button>}
      </p>
    </section>
  );
}
