import {SideInfo} from './SideInfo.jsx';
import {CAPTIONS, HERO_FINAL, SCENE_A11Y} from '../content/landing.js';

/* The finale: a tall section whose sticky frame holds the side information and the hero.
   The world itself is drawn on the fixed stage behind; when the hero is reached, the engine
   fades in its text (--txt) and, at the end of the section, lifts the stage away with the page. */
export function Finale({finaleRef, heroRef}) {
  return (
    <section className="finale" id="finale" ref={finaleRef} aria-labelledby="fin-title">
      <div className="fin-in">
        <p className="sr-only">{SCENE_A11Y}</p>
        <div className="caps">
          {CAPTIONS.map((c, i) => <SideInfo key={i} {...c} />)}
        </div>
        <div className="hero-final" ref={heroRef}>
          <div className="hf-shade" aria-hidden="true" />
          <div className="hf-content">
            <p className="eyebrow">{HERO_FINAL.eyebrow}</p>
            <h2 className="hf-title" id="fin-title">{HERO_FINAL.title}</h2>
            <p className="hf-lead">{HERO_FINAL.lead}</p>
            <div className="hf-cta">
              {HERO_FINAL.ctas.map(c => <a key={c.href} className={'cta' + (c.ghost ? ' ghost' : '')} href={c.href}>{c.label}</a>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
