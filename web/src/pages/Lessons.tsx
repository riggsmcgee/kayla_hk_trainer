import { Link } from 'react-router';

export function Lessons() {
  return (
    <>
      <h1>Lessons</h1>
      <p className="lede">
        Three short lessons, Kayla — one for your hands, one for your eyes, and one for
        your gear. The little demos inside them run on the same engine as the practice
        modes, with the real hitboxes drawn in — so what you see here is exactly what
        you&apos;ll feel in game.
      </p>
      <ul className="card-grid">
        <li>
          <Link className="card" to="/lessons/pogo">
            <h3>Pogo</h3>
            <p>The downslash bounce: the skill that turns hazards into stepping stones.</p>
          </Link>
        </li>
        <li>
          <Link className="card" to="/lessons/reading-enemies">
            <h3>Reading Enemies</h3>
            <p>The dodge-first method: spend a life just watching, then strike safely.</p>
          </Link>
        </li>
        <li>
          <Link className="card" to="/lessons/setup">
            <h3>Your Setup</h3>
            <p>Why picking one controller and sticking with it makes everything easier.</p>
          </Link>
        </li>
      </ul>
    </>
  );
}
