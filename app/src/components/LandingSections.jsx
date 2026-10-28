import {Icon} from './Icon.jsx';
import {CTA, FEATURES, HOW} from '../content/landing.js';

/* Ordinary landing content after the scene: solid black sections that scroll over the lifted stage. */
export function Features() {
  return (
    <section className="land" id="features" aria-labelledby="f-title">
      <div className="land-in">
        <p className="eyebrow">{FEATURES.eyebrow}</p>
        <h2 id="f-title">{FEATURES.title}</h2>
        <div className="feat-grid">
          {FEATURES.items.map(([h, p]) => <div key={h}><h3>{h}</h3><p>{p}</p></div>)}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="land" id="how" aria-labelledby="h-title">
      <div className="land-in">
        <p className="eyebrow">{HOW.eyebrow}</p>
        <h2 id="h-title">{HOW.title}</h2>
        <ol className="steps">
          {HOW.steps.map(([h, p], i) => <li key={h}><span className="sn">{String(i + 1).padStart(2, '0')}</span><h3>{h}</h3><p>{p}</p></li>)}
        </ol>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="land land-cta" aria-labelledby="c-title">
      <div className="land-in">
        <h2 id="c-title">{CTA.title}</h2>
        <p>{CTA.text}</p>
        <a className="cta" href={CTA.link.href}>{CTA.link.label}<Icon name="up" /></a>
      </div>
    </section>
  );
}
