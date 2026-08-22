/**
 * The dojo map — "Down the Well". A hand-inked cross-section of Kayla's own
 * little Hallownest: the road starts at a bench in Dirtmouth, drops down the
 * well, and winds through five strata to the bottom of the well. The six
 * stops are the six chapters in road order (chapters.ts owns the order).
 *
 * Architecture: ONE aria-hidden SVG holds the art (terrain, well, trail,
 * decor). The stops are HTML links positioned over it at percentage
 * coordinates, so tap targets and labels stay full-size on a phone while
 * the art scales underneath. Keyboard users get the same six links in order.
 *
 * Each stop is drawn by its state (storage/progress.ts): done lights up
 * with a full ring, skipped gets a dashed ring, visited a half ring, locked
 * is greyed (still a link — the page shows the gate). The Knight stands on
 * the stop to play next.
 */
import { Link } from 'react-router';
import { CHAPTERS, type ChapterId } from '../chapters';
import type { ChapterState } from '../storage/progress';
import { useMapProgress } from '../storage/useChapterProgress';
import '../styles/map-states.css';

/** The art's coordinate space. */
const W = 600;
const H = 1080;

/** Stop centres in art units (the road order itself comes from CHAPTERS). */
const STOPS: Record<ChapterId, { x: number; y: number }> = {
  setup: { x: 200, y: 128 },
  pogo: { x: 180, y: 330 },
  'pogo-course': { x: 430, y: 520 },
  // The lower strata sit further apart than the upper ones: stops 3/5 and
  // 4/6 share a column, and at 18 px the labels of one would otherwise run
  // into the Knight (or the disc) of the next on a phone-width map. Stop 6
  // also sits left of stop 5's label edge.
  'reading-enemies': { x: 170, y: 680 },
  'dodge-arena': { x: 430, y: 826 },
  finale: { x: 200, y: 962 },
};

/** Trail legs between consecutive stops in road order (the first one goes via the well). */
const LEGS: string[] = [
  // Dirtmouth → along the surface → down the well → the Crossroads
  'M 236 128 H 450 Q 500 128 500 180 V 250 C 500 300, 330 330, 216 330',
  // Crossroads → the Bounce Bog
  'M 216 330 C 330 330, 470 380, 430 484',
  // Bounce Bog → Greenpath
  'M 430 556 C 420 620, 300 680, 206 680',
  // Greenpath → the Colosseum
  'M 206 680 C 330 680, 450 726, 430 790',
  // Colosseum → the Bottom of the Well
  'M 430 862 C 436 914, 220 890, 200 926',
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
    case 'finale':
      // A well bucket on its rope, going down.
      return (
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 2 V11" />
          <path d="M10 15 Q16 7 22 15" />
          <path d="M9 15 H23 L21 29 H11 Z" />
          <path d="M12 22 H20" />
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

/** Class and screen-reader suffix for each stop state. */
const STATE_VIEW: Record<ChapterState, { cls: string; sr: string | null }> = {
  done: { cls: 'is-lit is-done', sr: ', done' },
  skipped: { cls: 'is-skipped', sr: ', skipped' },
  visited: { cls: 'is-visited', sr: ', started' },
  locked: { cls: 'is-locked', sr: ', locked' },
  open: { cls: '', sr: null },
};

export function DojoMap() {
  const { next, reached, states } = useMapProgress();
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

        {/* strata: Crossroads, Bounce Bog, Greenpath, Colosseum, the bottom of the well */}
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
          d="M0 700 C20 708, 40 690, 80 700 C140 718, 200 686, 260 702 C320 720, 380 684, 440 700 C500 716, 550 690, 600 700 V900 C550 890, 500 916, 440 900 C380 884, 320 920, 260 902 C200 886, 140 918, 80 900 C40 890, 20 908, 0 900 Z"
        />
        <path
          className="band band-5"
          d="M0 900 C20 908, 40 890, 80 900 C140 918, 200 886, 260 902 C320 920, 380 884, 440 900 C500 916, 550 890, 600 900 V1080 H0 Z"
        />
        <rect x="0" y="110" width={W} height={H - 110} fill="url(#hatch)" />
        <g className="band-edge">
          <path d="M0 300 C40 310, 80 290, 120 300 C180 316, 240 288, 300 302 C360 318, 420 284, 480 300 C520 312, 560 290, 600 300" />
          <path d="M0 500 C20 508, 50 490, 90 500 C150 516, 210 490, 270 504 C330 520, 380 486, 440 500 C500 514, 540 492, 600 500" />
          <path d="M0 700 C20 708, 40 690, 80 700 C140 718, 200 686, 260 702 C320 720, 380 684, 440 700 C500 716, 550 690, 600 700" />
          <path d="M0 900 C20 908, 40 890, 80 900 C140 918, 200 886, 260 902 C320 920, 380 884, 440 900 C500 916, 550 890, 600 900" />
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

        {/* decor: crossroads spikes, bog mushrooms, greenpath fronds, colosseum arches */}
        <g className="ink decor">
          <path d="M300 410 l8 -16 l8 16 l8 -16 l8 16 l8 -16 l8 16" />
          <path d="M520 440 l7 -14 l7 14 l7 -14 l7 14" />
        </g>
        <g className="spore decor">
          <path d="M520 632 a16 8 0 0 1 32 0 Z M536 632 v14" />
          <path d="M566 646 a11 6 0 0 1 22 0 Z M577 646 v10" />
          <path d="M90 600 a13 7 0 0 1 26 0 Z M103 600 v12" />
        </g>
        <g className="moss decor">
          <path d="M70 800 q-10 -40 20 -60 M70 800 q10 -30 -4 -56 M100 820 q-6 -30 18 -44" />
          <path d="M540 776 q-8 -36 18 -52 M560 786 q4 -28 -10 -48" />
        </g>
        <g className="ink decor">
          <path d="M60 870 v-30 a16 16 0 0 1 32 0 v30 M104 870 v-30 a16 16 0 0 1 32 0 v30 M148 870 v-30 a16 16 0 0 1 32 0 v30" />
          <line x1="40" y1="870" x2="180" y2="870" />
        </g>

        {/* the bottom of the well: plain stone, a still dark pool, one lantern */}
        <g className="lamp">
          <line x1="70" y1="900" x2="70" y2="928" />
          <circle cx="70" cy="934" r="24" fill="url(#lamp)" stroke="none" />
          <circle cx="70" cy="934" r="4" className="lamp-bulb" />
        </g>
        <g className="pool">
          <ellipse cx="470" cy="1032" rx="90" ry="12" />
          <path className="pool-glint" d="M 418 1028 h 26 M 462 1036 h 16 M 500 1030 h 22" />
        </g>
        <g className="ink decor stone">
          <path d="M 330 1000 h 28 M 560 976 h 22 M 130 1052 h 26 M 380 1064 h 20" />
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
          const view = STATE_VIEW[states[c.id]];
          const isHere = c.id === standingAt.id;
          const isNext = next?.id === c.id;
          const cls = [
            'map-stop',
            c.kind === 'mini-game' ? 'map-stop-game' : 'map-stop-lesson',
            view.cls,
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
                  {view.sr && <span className="sr-only">{view.sr}</span>}
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
