import { Link } from 'react-router';
import { CHAPTERS, countWord } from '../chapters';
import { DojoMap } from '../components/DojoMap';
import { NextButton } from '../components/NextButton';
import { homeCopy } from '../copy/home';
import { mapProgress } from '../storage/progress';
import { useProgress } from '../storage/useChapterProgress';
import { bestLine } from './bestLine';

export function Home() {
  const { progress, visited, runs } = useProgress();
  const { next } = mapProgress(progress, visited);
  const finale = CHAPTERS[CHAPTERS.length - 1]!;
  const best = bestLine(next ?? finale, runs);
  const stops = countWord(CHAPTERS.length);

  return (
    <div className="home">
      <div className="home-hero-block">
        <h1 className="home-hero">{homeCopy.hero}</h1>
        <p className="lede">{homeCopy.lede}</p>
      </div>
      <DojoMap />
      <div className="home-side">
        <aside className="next-sign" aria-label={homeCopy.signLabel}>
          {next ? (
            <>
              <p className="eyebrow">{homeCopy.signEyebrow}</p>
              <p className="next-place">{next.place}</p>
              <p className="next-title">{next.title}</p>
              <p className="next-line">{next.line}</p>
              <div className="next-facts">
                <p className="next-done">{homeCopy.signToFinish(next.done)}</p>
                {best && <p className="next-best">{best}</p>}
              </div>
              <NextButton title={next.title} to={next.route} where={next.place} />
            </>
          ) : (
            <>
              <p className="eyebrow">{homeCopy.doneEyebrow}</p>
              <p className="next-title">{homeCopy.doneTitle(stops)}</p>
              <p className="next-line">{homeCopy.doneLine}</p>
              {best && (
                <div className="next-facts">
                  <p className="next-best">{best}</p>
                </div>
              )}
              <Link className="button" to={finale.route}>
                {homeCopy.doneButton}
              </Link>
            </>
          )}
        </aside>

        <ul className="map-legend" aria-label={homeCopy.legendLabel}>
          <li className="legend-lesson">{homeCopy.legendLesson}</li>
          <li className="legend-game">{homeCopy.legendMiniGame}</li>
          <li className="legend-done">{homeCopy.legendDone}</li>
          <li className="legend-skipped">{homeCopy.legendSkipped}</li>
          <li className="legend-locked">{homeCopy.legendLocked}</li>
        </ul>
      </div>
    </div>
  );
}
