/* Vector controls share currentColor and remain crisp at every scale. */
export function Icon({name='arrow'}) {
  if(name==='volume'||name==='muted')return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9h4l5-4v14l-5-4H4Z" />
    {name==='volume'?<path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />:<path d="m17 9 5 6m0-6-5 6" />}
  </svg>;
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    {name==='play'?<path d="m8 5 11 7-11 7Z" fill="currentColor"/>:name==='pause'?<path d="M8 5v14M16 5v14" fill="none" stroke="currentColor" strokeWidth="3"/>:<path d={name==='up'?'M12 20V4m-6 6 6-6 6 6':'M4 12h16m-6-6 6 6-6 6'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>}
  </svg>;
}
