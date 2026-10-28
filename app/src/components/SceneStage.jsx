/* The fixed full-screen stage: a WebGL canvas for the world and a 2D canvas for glows and flashes.
   During the finale two overlay bands mask the full canvas (CSS vars --film-*, class .in-finale,
   both set by the engine); the bands above and below hold the navigation and the controls. */
export function SceneStage({stageRef, canvasRef, fxRef}) {
  return (
    <>
      <div className="stage" ref={stageRef} aria-hidden="true">
        <canvas className="stage-gl" ref={canvasRef} />
        <canvas className="stage-fx" ref={fxRef} />
      </div>
      <div className="film" aria-hidden="true">
        <div className="film-band film-band-top" />
        <div className="film-band film-band-bottom" />
      </div>
    </>
  );
}
