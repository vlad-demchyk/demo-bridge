import {Fragment, useMemo} from 'react';
import {rng} from '../scene/math.js';

/* Splits a text into word spans that fly in from the side through depth (CSS in pairs.css).
   Each word gets its own start --s inside [from, to] of the pair progress, and a vertical offset --dy.
   *accent* marks accented words. The scene engine reads these spans: their screen spots are where
   the words leave from when the pair dissolves into the core. */
export function parseAccents(text) {
  const words = [];
  text.split('*').forEach((part, i) => {
    const acc = i % 2 === 1;
    for (const w of part.split(/\s+/)) {
      if (!w) continue;
      if (/^[.,:;!?…]+$/.test(w) && words.length) words[words.length - 1].w += w;
      else words.push({w, acc});
    }
  });
  return words;
}

export function SplitWords({as: Tag = 'p', text, role, from, to, seed = 5, className, id}) {
  const words = useMemo(() => {
    const r = rng(seed), list = parseAccents(text);
    return list.map((x, i) => ({...x, s: (from + (to - from) * i / Math.max(1, list.length - 1)).toFixed(3), dy: ((r() - .5) * 200).toFixed(0)}));
  }, [text, from, to, seed]);
  return (
    <Tag className={className} id={id} data-role={role}>
      {words.map((x, i) => (
        <Fragment key={i}>
          <span className={'w' + (x.acc ? ' acc' : '')} style={{'--s': x.s, '--dy': x.dy}}>{x.w}</span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
}
