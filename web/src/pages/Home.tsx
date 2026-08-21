import { Link } from 'react-router';

export function Home() {
  return (
    <>
      <h1>Hey Kayla — welcome to your dojo.</h1>
      <p className="lede">
        Hollow Knight is the first genuinely hard game you&apos;ve taken on, and that&apos;s
        exactly why it&apos;s worth it. This little site is our practice space: a place to
        break the scary parts into small, learnable pieces and drill them until they feel
        easy. No pressure, no spoilers, no rush — let&apos;s learn this together.
      </p>
      <p className="muted">
        The whole plan fits in one sentence: hit them more than they hit you and you beat
        the game. Everything here exists to make that sentence true.
      </p>

      <h2>Lessons</h2>
      <ul className="card-grid">
        <li>
          <Link className="card" to="/lessons/pogo">
            <h3>Pogo</h3>
            <p>Bouncing on enemies and spikes with the downslash — your biggest unlock.</p>
          </Link>
        </li>
        <li>
          <Link className="card" to="/lessons/reading-enemies">
            <h3>Reading Enemies</h3>
            <p>Don&apos;t fight a new enemy. Watch it, dodge it, then take it apart.</p>
          </Link>
        </li>
        <li>
          <Link className="card" to="/lessons/setup">
            <h3>Your Setup</h3>
            <p>One controller, every session — build muscle memory that sticks.</p>
          </Link>
        </li>
      </ul>

      <h2>Practice</h2>
      <ul className="card-grid">
        <li>
          <Link className="card" to="/practice/pogo">
            <h3>Pogo Course</h3>
            <p>Chain downslash bounces across a spike course, checkpoint by checkpoint.</p>
          </Link>
        </li>
        <li>
          <Link className="card" to="/practice/dodge">
            <h3>Dodge Arena</h3>
            <p>One enemy at a time. Survive, learn its moves, land clean hits.</p>
          </Link>
        </li>
      </ul>
    </>
  );
}
