import {Icon} from './Icon.jsx';
import {FILM} from '../content/landing.js';

/* Controls in the bottom band of the film frame: play the scene by itself, or skip to the finished hero.
   Hidden once the page has moved on to the landing content (class .after-film on <html>). */
export function FilmControls({playing, onToggle, onSkip,soundOn,onToggleSound,showSound}) {
  return (
    <div className="film-ctrls" role="group" aria-label={FILM.label}>
      <div className={'play-control'+(showSound?' has-sound':'')}>
      <button type="button" className="play" aria-pressed={playing} onClick={onToggle}>
        <Icon name={playing?'pause':'play'} />{playing ? FILM.pause : FILM.play}
      </button>
      <button type="button" className="sound-toggle" data-sound-toggle disabled={!showSound} aria-hidden={!showSound} tabIndex={showSound?0:-1}
        aria-label={soundOn?'Mute all sounds':'Unmute all sounds'}
        title={soundOn?'Mute all sounds':'Unmute all sounds'}
        aria-pressed={soundOn} onClick={onToggleSound}>
        <Icon name={soundOn?'volume':'muted'} />
      </button>
      </div>
      <button type="button" className="film-skip" onClick={onSkip}>{FILM.skip}<Icon /></button>
    </div>
  );
}
