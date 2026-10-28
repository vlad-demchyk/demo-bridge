import {SplitWords} from './SplitWords.jsx';
import {PAIR_LABELS} from '../content/landing.js';

/* One question/answer pair: a tall section with a sticky frame. The engine writes its scroll progress
   to --p; the question arrives over [.02,.16], the answer over [.18,.32], they lock at .74 and the
   words leave for the core. */
export function PairSection({index, total, q, a}) {
  const n = String(index + 1).padStart(2, '0'), id = 'q' + (index + 1);
  return (
    <section className="pair" aria-labelledby={id}>
      <div className="pair-in">
        <p className="idx">{n} / {String(total).padStart(2, '0')}</p>
        <div className="halves">
          <div className="half qh">
            <p className="tag tag-pain">{PAIR_LABELS.pain}</p>
            <SplitWords as="h2" className="q" id={id} role="q" text={q} from={.02} to={.16} seed={5 + index * 2} />
          </div>
          <div className="seam" aria-hidden="true"><i /></div>
          <div className="half ah">
            <p className="tag tag-solve">{PAIR_LABELS.solve}</p>
            <SplitWords as="p" className="a" role="a" text={a} from={.18} to={.32} seed={6 + index * 2} />
          </div>
        </div>
      </div>
    </section>
  );
}
