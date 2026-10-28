import {useRef, useState} from 'react';
import {SceneStage} from './components/SceneStage.jsx';
import {SiteHeader} from './components/SiteHeader.jsx';
import {Hero} from './components/Hero.jsx';
import {PairSection} from './components/PairSection.jsx';
import {Finale} from './components/Finale.jsx';
import {Features, HowItWorks, CallToAction} from './components/LandingSections.jsx';
import {ProgressMeter} from './components/ProgressMeter.jsx';
import {PageScrollbar} from './components/PageScrollbar.jsx';
import {FilmControls} from './components/FilmControls.jsx';
import {useMistScene} from './hooks/useMistScene.js';
import {useSceneAudio} from './hooks/useSceneAudio.js';
import {PAIRS} from './content/landing.js';
import {SCENE} from './scene.config.js';

/* Page order matters to the scene: hero, the pairs, the finale, then the ordinary landing content.
   The engine measures these sections and maps the scroll position onto the camera and the phases. */
export default function App() {
  const refs = {
    container: useRef(null), stage: useRef(null), canvas: useRef(null), fx: useRef(null),
    finale: useRef(null), heroFinal: useRef(null), meter: useRef(null)
  };
  const [playing, setPlaying] = useState(false);
  const audio=useSceneAudio({src:import.meta.env.BASE_URL+'audio/deep-space-drift-soft_out.aac',volume:.08});
  const scene = useMistScene(refs, {image: SCENE.image, playSeconds: SCENE.playSeconds, onPlayState: setPlaying,onAudioLevel:audio.setGain,onWind:audio.setWind,onBurst:audio.setBurst});
  const skip = () => { scene.current?.stop(); scene.current?.skipToHero(); };

  return (
    <>
      <audio ref={audio.mediaRef} loop preload="auto" aria-hidden="true" />
      <SceneStage stageRef={refs.stage} canvasRef={refs.canvas} fxRef={refs.fx} />
      <SiteHeader />
      <main id="page-content" ref={refs.container}>
        <Hero onSkip={skip} />
        {PAIRS.map((p, i) => <PairSection key={i} index={i} total={PAIRS.length} {...p} />)}
        <Finale finaleRef={refs.finale} heroRef={refs.heroFinal} />
        <Features />
        <HowItWorks />
        <CallToAction />
      </main>
      <PageScrollbar finaleRef={refs.finale} containerRef={refs.container} />
      <ProgressMeter meterRef={refs.meter} count={PAIRS.length} onSeek={index=>scene.current?.seekCheckpoint(index)} />
      <FilmControls showSound={audio.showSound} soundOn={audio.soundOn} onToggleSound={audio.toggleSound} playing={playing} onToggle={() => {if(playing)scene.current?.stop();else{audio.startMusic();scene.current?.play();}}} onSkip={skip} />
    </>
  );
}
