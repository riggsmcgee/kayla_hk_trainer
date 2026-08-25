import { Link } from 'react-router';
import { CHAPTERS, countWord, countWordCap } from '../chapters';
import { DojoMap } from '../components/DojoMap';
import { NextButton } from '../components/NextButton';
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
        <h1 className="home-hero">Kayla, it starts at the well.</h1>
        <p className="lede">
          {countWordCap(CHAPTERS.length)} stops, one road down. Start where the Knight is standing.
        </p>
      </div>
      <DojoMap />
      <div className="home-side">
        <aside className="next-sign" aria-label="Next stop">
          {next ? (
            <>
              <p className="eyebrow">Next stop</p>
              <p className="next-place">{next.place}</p>
              <p className="next-title">{next.title}</p>
              <p className="next-line">{next.line}</p>
              <div className="next-facts">
                <p className="next-done">To finish: {next.done}</p>
                {best && <p className="next-best">{best}</p>}
              </div>
              <NextButton title={next.title} to={next.route} where={next.place} />
            </>
          ) : (
            <>
              <p className="eyebrow">The whole road</p>
              <p className="next-title">You’ve walked all {stops} stops.</p>
              <p className="next-line">Replay whatever you like — the well’s always open.</p>
              {best && (
                <div className="next-facts">
                  <p className="next-best">{best}</p>
                </div>
              )}
              <Link className="button" to={finale.route}>
                Back down the well
              </Link>
            </>
          )}
        </aside>

        <ul className="map-legend" aria-label="Legend">
          <li className="legend-lesson">chapter</li>
          <li className="legend-game">mini-game</li>
          <li className="legend-done">done</li>
          <li className="legend-skipped">skipped</li>
          <li className="legend-locked">locked</li>
        </ul>

        <p className="thesis">The whole game in one line: hit them more than they hit you.</p>
        <p className="signature">surveyed &amp; inked for Kbug</p>
      </div>
    </div>
  );
}
