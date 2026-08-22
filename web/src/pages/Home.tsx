import { Link } from 'react-router';
import { mapProgress } from '../chapters';
import { DojoMap } from '../components/DojoMap';
import { useLitChapters } from '../storage/useChapterProgress';

export function Home() {
  const lit = useLitChapters();
  const { next } = mapProgress(lit);

  return (
    <div className="home">
      <div className="home-hero-block">
        <h1 className="home-hero">Kayla, it starts at the well.</h1>
        <p className="lede">
          Three chapters, two mini-games, one road down. Start where the Knight is standing.
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
              <Link className="button" to={next.route}>
                Go
              </Link>
            </>
          ) : (
            <>
              <p className="eyebrow">The whole road</p>
              <p className="next-title">You’ve walked all five stops.</p>
              <p className="next-line">Replay whatever you like — the arena’s always open.</p>
              <Link className="button" to="/play/dodge">
                Back to the arena
              </Link>
            </>
          )}
        </aside>

        <ul className="map-legend" aria-label="Legend">
          <li className="legend-lesson">chapter</li>
          <li className="legend-game">mini-game</li>
        </ul>

        <p className="thesis">The whole game in one line: hit them more than they hit you.</p>
        <p className="signature">surveyed &amp; inked for Kbug</p>
      </div>
    </div>
  );
}
