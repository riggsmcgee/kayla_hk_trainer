/**
 * Inline-SVG controller diagrams for the Setup chapter. Geometry is in
 * millimetres from the real hardware (Nintendo's Joy-Con diagram; Snackbox
 * Micro / Hit Box layouts) so the silhouettes read as the actual objects
 * on Kayla's desk. Gold = the controls Hollow Knight cares about (on the
 * Joy-Con that includes the stick — she moves and pogos from it).
 */
import { setupCopy } from '../copy/setup';

interface LabelProps {
  x: number;
  y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}

function Label({ x, y, text, anchor = 'middle' }: LabelProps) {
  return (
    <text className="cd-label" x={x} y={y} textAnchor={anchor}>
      {text}
    </text>
  );
}

interface CalloutProps {
  from: [number, number];
  to: [number, number];
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}

/** A leader line from a button to a short caption. */
function Callout({ from, to, text, anchor = 'start' }: CalloutProps) {
  return (
    <g className="cd-callout">
      <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
      <text
        x={to[0] + (anchor === 'end' ? -2 : anchor === 'start' ? 2 : 0)}
        y={to[1] + 1.2}
        textAnchor={anchor}
      >
        {text}
      </text>
    </g>
  );
}

/** The Joy-Con pair, docked in the grip, as she holds it on the couch. */
export function JoyConDiagram() {
  // Left Joy-Con: stick above the four directional buttons.
  const L = { x: 20, y: 8 };
  // Right Joy-Con: A/B/X/Y diamond above the stick — not a mirror image.
  const R = { x: 124, y: 8 };
  return (
    <svg
      className="cd"
      viewBox="-4 -20 236 168"
      role="img"
      aria-label={setupCopy.joyConDescription}
    >
      {/* grip bridge and handles */}
      <rect className="cd-grip" x="36" y="10" width="108" height="78" rx="6" />
      <path
        className="cd-grip"
        d="M31 70 h30 v50 a15 15 0 0 1 -30 0 z"
        transform="rotate(8 46 95)"
      />
      <path
        className="cd-grip"
        d="M119 70 h30 v50 a15 15 0 0 1 -30 0 z"
        transform="rotate(-8 134 95)"
      />

      {/* shoulders and triggers */}
      <rect className="cd-trigger" x={L.x + 8} y={L.y - 8} width="20" height="5" rx="2" />
      <rect className="cd-shoulder" x={L.x + 4} y={L.y - 4} width="24" height="5" rx="2" />
      <rect className="cd-trigger cd-btn-hk" x={R.x + 8} y={R.y - 8} width="20" height="5" rx="2" />
      <rect className="cd-shoulder" x={R.x + 8} y={R.y - 4} width="24" height="5" rx="2" />

      {/* slabs: outer edge one long curve, inner (rail) edge straight */}
      <path
        className="cd-body"
        d={`M${L.x + 36} ${L.y} H${L.x + 16} A16 16 0 0 0 ${L.x} ${L.y + 16} V${L.y + 86} A16 16 0 0 0 ${L.x + 16} ${L.y + 102} H${L.x + 36} Z`}
      />
      <path
        className="cd-body"
        d={`M${R.x} ${R.y} H${R.x + 20} A16 16 0 0 1 ${R.x + 36} ${R.y + 16} V${R.y + 86} A16 16 0 0 1 ${R.x + 20} ${R.y + 102} H${R.x} Z`}
      />

      {/* left: minus, stick (hers — gold), directional buttons, capture */}
      <rect className="cd-btn-small" x={L.x + 28} y={L.y + 8.5} width="6" height="1.6" />
      {/* `cd-btn cd-btn-hk` rather than `cd-stick cd-btn-hk`: .cd-stick is declared later
          in styles.css at equal specificity and would override the gold. */}
      <circle className="cd-btn cd-btn-hk" cx={L.x + 18} cy={L.y + 27} r="8" />
      <circle
        className="cd-stick-cap"
        cx={L.x + 18}
        cy={L.y + 27}
        r="5"
        style={{ stroke: 'var(--gold)' }}
      />
      <circle className="cd-btn" cx={L.x + 18} cy={L.y + 52} r="3.5" />
      <circle className="cd-btn" cx={L.x + 10} cy={L.y + 60} r="3.5" />
      <circle className="cd-btn" cx={L.x + 26} cy={L.y + 60} r="3.5" />
      <circle className="cd-btn" cx={L.x + 18} cy={L.y + 68} r="3.5" />
      <rect className="cd-btn-small" x={L.x + 28} y={L.y + 84} width="5" height="5" rx="1" />

      {/* right: plus, A/B/X/Y, stick, home */}
      <path
        className="cd-btn-small"
        d={`M${R.x + 5} ${R.y + 6.5} v6 M${R.x + 2} ${R.y + 9.5} h6`}
      />
      <circle className="cd-btn" cx={R.x + 18} cy={R.y + 19} r="3.8" />
      <circle className="cd-btn" cx={R.x + 26} cy={R.y + 27} r="3.8" />
      <circle className="cd-btn cd-btn-hk" cx={R.x + 18} cy={R.y + 35} r="3.8" />
      <circle className="cd-btn cd-btn-hk" cx={R.x + 10} cy={R.y + 27} r="3.8" />
      <Label x={R.x + 18} y={R.y + 20.4} text="X" />
      <Label x={R.x + 26} y={R.y + 28.4} text="A" />
      <Label x={R.x + 18} y={R.y + 36.4} text="B" />
      <Label x={R.x + 10} y={R.y + 28.4} text="Y" />
      <circle className="cd-stick" cx={R.x + 18} cy={R.y + 60} r="8" />
      <circle className="cd-stick-cap" cx={R.x + 18} cy={R.y + 60} r="5" />
      <circle className="cd-btn-small" cx={R.x + 6} cy={R.y + 86} r="3" />

      {/* callouts */}
      <Callout from={[R.x + 21, R.y + 37]} to={[178, 64]} text="B — jump" />
      <Callout from={[R.x + 7, R.y + 27]} to={[104, 38]} text="Y — attack" anchor="end" />
      {/* Beside the right shoulder, on its own line: the top line belongs to the
          stick callout, which at this size runs all the way to x 180. The leader
          leaves the trigger's right corner so it clears the shoulder under it. */}
      <Callout from={[R.x + 27, R.y - 7]} to={[178, 9]} text="ZR — dash" />
      {/* Top-left: the stick is hers. Drawn by hand rather than with <Callout> so the
          leader stops under the word instead of running into it. */}
      <g className="cd-callout">
        <line x1={L.x + 11} y1={L.y + 21} x2={8} y2={-4} />
        <text x={2} y={-9.8} textAnchor="start">
          stick — move · hold ↓ + attack = pogo
        </text>
      </g>
      {/* Bottom-left, faded: the one Joy-Con tip that fixes a pogo problem. */}
      <g opacity="0.7">
        <Callout
          from={[L.x + 15, L.y + 69]}
          to={[0, 141]}
          text="↓ button — a more reliable down"
          anchor="start"
        />
      </g>
    </svg>
  );
}

/** A leverless (all-button) board in Switch mode. */
export function LeverlessDiagram() {
  const top: [number, number, string][] = [
    [148, 54, 'Y'],
    [176, 48, 'X'],
    [204, 49, 'R'],
    [232, 55, 'L'],
  ];
  const bottom: [number, number, string][] = [
    [151, 90, 'B'],
    [179, 84, 'A'],
    [207, 85, 'ZR'],
    [235, 91, 'ZL'],
  ];
  const hk = new Set(['Y', 'B', 'ZR']);
  return (
    <svg
      className="cd cd-leverless"
      viewBox="-4 -18 270 168"
      role="img"
      aria-label={setupCopy.leverlessDescription}
    >
      <rect className="cd-body" x="0" y="0" width="260" height="126" rx="8" />
      {/* function buttons along the top edge */}
      {[40, 54, 68, 82, 96, 110].map((x) => (
        <circle key={x} className="cd-btn-small" cx={x} cy={12} r="3" />
      ))}

      {/* left hand */}
      <circle className="cd-btn" cx="48" cy="56" r="12" />
      <circle className="cd-btn cd-btn-hk" cx="78" cy="50" r="12" />
      <circle className="cd-btn" cx="108" cy="56" r="12" />
      <circle className="cd-btn" cx="100" cy="100" r="15" />
      <Label x={48} y={58} text="←" />
      <Label x={78} y={52} text="↓" />
      <Label x={108} y={58} text="→" />
      <Label x={100} y={102} text="↑" />

      {/* right hand */}
      {top.map(([x, y, t]) => (
        <g key={t}>
          <circle className={hk.has(t) ? 'cd-btn cd-btn-hk' : 'cd-btn'} cx={x} cy={y} r="12" />
          <Label x={x} y={y + 2} text={t} />
        </g>
      ))}
      {bottom.map(([x, y, t]) => (
        <g key={t}>
          <circle className={hk.has(t) ? 'cd-btn cd-btn-hk' : 'cd-btn'} cx={x} cy={y} r="12" />
          <Label x={x} y={y + 2} text={t} />
        </g>
      ))}

      {/* callouts */}
      <Callout
        from={[78, 38]}
        to={[70, -7]}
        text="middle finger holds ↓ for pogo"
        anchor="middle"
      />
      <Callout from={[148, 42]} to={[182, -7]} text="Y — attack" anchor="middle" />
      <Callout
        from={[151, 102]}
        to={[96, 140]}
        text="B — jump · same finger as Y, so remap one"
        anchor="middle"
      />
      <Callout from={[207, 97]} to={[236, 140]} text="ZR — dash" anchor="middle" />
    </svg>
  );
}
