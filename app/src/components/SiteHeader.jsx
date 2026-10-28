import {BRAND} from '../content/landing.js';

export function SiteHeader() {
  return (
    <header className="bar">
      <a className="brand" href={BRAND.home} aria-label={BRAND.name + ', back to the start'}>
        <svg viewBox="0 0 26 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><path d="M1 12h24M6.5 12V3M19.5 12V3M1 8.5Q5 6 6.5 3Q13 12 19.5 3Q21 6 25 8.5" /></svg>
        {BRAND.name}
      </a>
    </header>
  );
}
