import { Link } from 'react-router';

export function LessonSetup() {
  return (
    <>
      <h1>Lesson: Your Setup</h1>
      <p className="lede">
        Kayla, this one&apos;s short but it matters: pick one controller and stay with it.
        Switching between the Joy-Con and the leverless means your hands have to learn the
        game twice — every hour on one setup is an hour your muscle memory keeps, and
        splitting time splits the progress. Whichever one feels better is the right answer;
        committing is what makes it right.
      </p>

      <h2>Why this works</h2>
      <p>
        Everything the other two lessons teach — the pogo beat, the dodge timings, the
        punish windows — ends up stored in your hands, not your head. That storage is
        specific: <em>this thumb, this button, this distance</em>. Swap controllers and
        the timings your hands saved stop lining up with the buttons under them, so the
        game feels harder than you actually are. It isn&apos;t you. It&apos;s the moving
        target.
      </p>

      <h2>How to choose</h2>
      <p>
        Play twenty minutes on each, once, and notice two things: which one disappears
        from your attention faster, and which one your hands reach for when a fight gets
        scary. That one wins. There is no wrong answer — pros play on everything — there
        is only <em>switching</em>, which is always wrong.
      </p>

      <h2>Small habits that add up</h2>
      <p>
        Short sessions beat marathons — twenty focused minutes of the{' '}
        <Link to="/practice/pogo">Pogo Course</Link> or the{' '}
        <Link to="/practice/dodge">Dodge Arena</Link> does more for your hands than two
        tired hours. Stop while it still feels good; your hands keep practicing overnight
        (really — that&apos;s when muscle memory consolidates). And keep the same buttons
        here as in the real game, so everything you build on this site walks straight over
        to the Switch.
      </p>

      <p className="muted">
        Coming soon: this site will read your controller directly (in the browser!), so
        you can practice jumps, dashes, and nail timing on the exact buttons you&apos;ll
        use in game.
      </p>
    </>
  );
}
