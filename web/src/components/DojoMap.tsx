/**
 * The dojo map — "Down the Well". A hand-inked cross-section of Kayla's own
 * little Hallownest: the road starts at a bench in Dirtmouth, drops down the
 * well, and winds through four strata to a colosseum at the bottom. The five
 * stops are the five chapters in teaching order.
 *
 * Architecture: ONE aria-hidden SVG holds the art (terrain, well, trail,
 * decor). The stops are HTML links positioned over it at percentage
 * coordinates, so tap targets and labels stay full-size on a phone while
 * the art scales underneath. Keyboard users get the same five links in order.
 */
import { Link } from 'react-router';
import { CHAPTERS, mapProgress, type ChapterId } from '../chapters';
import { useLitChapters } from '../storage/useChapterProgress';

/** The art's coordinate space. */
const W = 600;
const H = 900;

/** Stop centres in art units, in chapter order. */
const STOPS: Record<ChapterId, { x: number; y: number }> = {
  setup: { x: 200, y: 128 },
  pogo: { x: 180, y: 330 },
  'reading-enemies': { x: 430, y: 520 },
  'pogo-course': { x: 170, y: 700 },
  'dodge-arena': { x: 430, y: 796 },
};

/** Trail legs between consecutive stops (the first one goes via the well). */
const LEGS: string[] = [
  // Dirtmouth → along the surface → down the well → the Crossroads
  'M 236 128 H 450 Q 500 128 500 180 V 250 C 500 300, 330 330, 216 330',
  // Crossroads → Greenpath
  'M 216 330 C 330 330, 470 380, 430 484',
  // Greenpath → the Bounce Bog
  'M 430 556 C 420 640, 300 700, 206 700',
  // Bounce Bog → the Colosseum
  'M 206 700 C 330 700, 450 720, 430 760',
];

function Glyph({ id }: { id: ChapterId }) {
  switch (id) {
    case 'setup':
      // A save bench: seat, curled arms, two legs.
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M6 18 H26 M9 18 V24 M23 18 V24 M6 18 q-2 -6 2 -8 M26 18 q2 -6 -2 -8" />
        </svg>
      );
    case 'pogo':
      // A nail pointing down at a row of spikes.
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 3 V17 M12 7 H20 M13.5 17 L16 21 L18.5 17" />
          <path d="M4 28 l4 -7 l4 7 l4 -7 l4 7 l4 -7 l4 7" />
        </svg>
      );
    case 'reading-enemies':
      // The Hunter's eye.
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M4 16 q12 -12 24 0 q-12 12 -24 0 Z" />
          <circle cx="16" cy="16" r="3.5" />
          <path d="M16 13 V19" />
        </svg>
      );
    case 'pogo-course':
      // Two bounces riding over spikes.
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M3 22 q7 -18 13 0 q7 -18 13 0" />
          <path d="M5 29 l3 -5 l3 5 M13 29 l3 -5 l3 5 M21 29 l3 -5 l3 5" />
        </svg>
      );
    case 'dodge-arena':
      // A shield with a nail across it.
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="13" cy="19" r="9" />
          <path d="M8 26 L27 7 M20 7 H27 V14" />
        </svg>
      );
  }
}

/** The Knight, small, standing on the stop she has reached. */
function Avatar() {
  return (
    <svg className="map-knight" viewBox="0 0 24 40" aria-hidden="true">
      <path d="M7 2 Q4 10 8 12 M17 2 Q20 10 16 12" />
      <path d="M7 16 a5 5 0 0 1 10 0 V36 a2 2 0 0 1 -2 2 H9 a2 2 0 0 1 -2 -2 Z" />
      <ellipse className="eye" cx="9.5" cy="17" rx="1.4" ry="2.4" />
      <ellipse className="eye" cx="14.5" cy="17" rx="1.4" ry="2.4" />
    </svg>
  );
}

export function DojoMap() {
  const lit = useLitChapters();
  const { next, reached } = mapProgress(lit);
  const standingAt = next ?? CHAPTERS[CHAPTERS.length - 1]!;

  return (
    <nav className="map" aria-label="Map of the dojo">
      <svg className="map-art" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
        <defs>
          <pattern
            id="hatch"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="8" className="hatch-line" />
          </pattern>
          <radialGradient id="lamp">
            <stop offset="0" stopColor="#cfe4fa" stopOpacity="0.28" />
            <stop offset="1" stopColor="#cfe4fa" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="shaft" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#05070e" stopOpacity="0.2" />
            <stop offset="1" stopColor="#05070e" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* sky and surface */}
        <rect x="0" y="0" width={W} height="110" className="band-sky" />
        <g className="lamp">
          <line x1="110" y1="58" x2="110" y2="108" />
          <circle cx="110" cy="54" r="22" fill="url(#lamp)" stroke="none" />
          <circle cx="110" cy="54" r="4" className="lamp-bulb" />
          <line x1="330" y1="58" x2="330" y2="108" />
          <circle cx="330" cy="54" r="22" fill="url(#lamp)" stroke="none" />
          <circle cx="330" cy="54" r="4" className="lamp-bulb" />
        </g>

        {/* strata */}
        <path
          className="band band-1"
          d="M0 110 H600 V300 C560 290, 520 312, 480 300 C420 284, 360 318, 300 302 C240 288, 180 316, 120 300 C80 290, 40 310, 0 300 Z"
        />
        <path
          className="band band-2"
          d="M0 300 C40 310, 80 290, 120 300 C180 316, 240 288, 300 302 C360 318, 420 284, 480 300 C520 312, 560 290, 600 300 V500 C540 492, 500 514, 440 500 C380 486, 330 520, 270 504 C210 490, 150 516, 90 500 C50 490, 20 508, 0 500 Z"
        />
        <path
          className="band band-3"
          d="M0 500 C20 508, 50 490, 90 500 C150 516, 210 490, 270 504 C330 520, 380 486, 440 500 C500 514, 540 492, 600 500 V700 C550 690, 500 716, 440 700 C380 684, 320 720, 260 702 C200 686, 140 718, 80 700 C40 690, 20 708, 0 700 Z"
        />
        <path
          className="band band-4"
          d="M0 700 C20 708, 40 690, 80 700 C140 718, 200 686, 260 702 C320 720, 380 684, 440 700 C500 716, 550 690, 600 700 V900 H0 Z"
        />
        <rect x="0" y="110" width={W} height="790" fill="url(#hatch)" />
        <g className="band-edge">
          <path d="M0 300 C40 310, 80 290, 120 300 C180 316, 240 288, 300 302 C360 318, 420 284, 480 300 C520 312, 560 290, 600 300" />
          <path d="M0 500 C20 508, 50 490, 90 500 C150 516, 210 490, 270 504 C330 520, 380 486, 440 500 C500 514, 540 492, 600 500" />
          <path d="M0 700 C20 708, 40 690, 80 700 C140 718, 200 686, 260 702 C320 720, 380 684, 440 700 C500 716, 550 690, 600 700" />
        </g>

        {/* the well */}
        <rect x="481" y="108" width="38" height="150" fill="url(#shaft)" stroke="none" />
        <g className="ink">
          <line x1="481" y1="108" x2="481" y2="250" />
          <line x1="519" y1="108" x2="519" y2="250" />
          <rect x="472" y="96" width="56" height="12" rx="3" />
          <line x1="486" y1="96" x2="486" y2="70" />
          <line x1="514" y1="96" x2="514" y2="70" />
          <path d="M480 70 h40 l-4 -10 h-32 Z" />
        </g>

        {/* decor: crossroads spikes, greenpath fronds, bog mushrooms, colosseum */}
        <g className="ink decor">
          <path d="M300 410 l8 -16 l8 16 l8 -16 l8 16 l8 -16 l8 16" />
          <path d="M520 440 l7 -14 l7 14 l7 -14 l7 14" />
        </g>
        <g className="moss decor">
          <path d="M120 620 q-10 -40 20 -60 M120 620 q10 -30 -4 -56 M150 640 q-6 -30 18 -44" />
          <path d="M520 640 q-8 -36 18 -52 M540 650 q4 -28 -10 -48" />
        </g>
        <g className="spore decor">
          <path d="M300 790 a16 8 0 0 1 32 0 Z M316 790 v14" />
          <path d="M350 800 a11 6 0 0 1 22 0 Z M361 800 v10" />
          <path d="M90 808 a13 7 0 0 1 26 0 Z M103 808 v12" />
        </g>
        <g className="ink decor">
          <path d="M60 892 v-30 a16 16 0 0 1 32 0 v30 M104 892 v-30 a16 16 0 0 1 32 0 v30 M148 892 v-30 a16 16 0 0 1 32 0 v30" />
          <line x1="40" y1="892" x2="200" y2="892" />
        </g>

        {/* the road */}
        {LEGS.map((d, i) => {
          // Leg i leads to stop i + 1; it's walked once that stop is reached in order.
          const walked = reached > i + 1;
          return <path key={i} d={d} className={walked ? 'trail trail-walked' : 'trail'} />;
        })}
      </svg>

      <ol className="map-stops">
        {CHAPTERS.map((c, i) => {
          const pos = STOPS[c.id];
          const isLit = lit.has(c.id);
          const isHere = c.id === standingAt.id;
          const isNext = next?.id === c.id;
          const cls = [
            'map-stop',
            c.kind === 'mini-game' ? 'map-stop-game' : 'map-stop-lesson',
            isLit ? 'is-lit' : '',
            isNext ? 'is-next' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li
              key={c.id}
              className={cls}
              style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%` }}
            >
              <Link to={c.route} aria-current={isNext ? 'step' : undefined}>
                {isHere && <Avatar />}
                <span className="map-disc">
                  <Glyph id={c.id} />
                </span>
                <span className="map-label">
                  <span className="map-place">
                    {i + 1} · {c.place}
                  </span>
                  <span className="map-title">{c.title}</span>
                  {isLit && <span className="sr-only">, done</span>}
                  {isHere && <span className="sr-only">, you are here</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
