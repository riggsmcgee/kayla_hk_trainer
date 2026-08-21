import { Link } from 'react-router';
import { LessonDemo } from '../components/LessonDemo';
import { pogoRhythmDemo } from '../engine/demo';

export function LessonPogo() {
  return (
    <>
      <h1>Lesson: Pogo</h1>
      <p className="lede">
        Kayla, the pogo — bouncing off things with a downward slash — is the single skill
        that will change how this game feels for you. Spikes stop being walls and start
        being trampolines, and enemies become platforms. It&apos;s a rhythm, not a reflex:
        jump, slash down as you fall, rise, repeat. We&apos;ll start slow and build the beat
        together until your hands know it without you.
      </p>

      <h2>How the bounce actually works</h2>
      <p>
        While you&apos;re in the air, hold <strong>down</strong> and slash. If your nail
        touches anything bounceable underneath you, you get launched: a quarter-second of
        rising, then a gentle float at the top. Three things make this kinder than it
        sounds:
      </p>
      <p>
        First, the down-slash is <em>wide</em> — noticeably wider than the Knight. You do
        not need to be pixel-perfect above the target; near enough is enough. Second, the
        bounce height is always the same (about half a jump), so your eyes can learn one
        arc and trust it. Third — and this is the secret that unlocks whole areas later —{' '}
        <strong>every bounce gives your dash back</strong>.
      </p>
      <LessonDemo
        script={pogoRhythmDemo}
        label="Slow-motion demo of the Knight bouncing on an orb, with the down-slash hitbox drawn in green"
      />
      <p className="muted">
        This demo runs on the exact engine and hitboxes as the practice game, at half
        speed. The green arc is your real down-slash — see how far it reaches?
      </p>

      <h2>The rhythm</h2>
      <p>
        The nail swings about twice a second, and a full bounce takes about half a second
        — which means pogo is a steady <em>beat</em>, not a mash. Slash, bounce, breathe,
        slash. If you find yourself hammering the button, stop, land, and start again
        slower. Mashing actually breaks the rhythm, because a swing that misses its moment
        leaves you falling with your nail on cooldown.
      </p>

      <h2>Drills</h2>
      <p>
        Head to the <Link to="/practice/pogo">Pogo Course</Link> and take these in order —
        each one is a checkpoint on the same course, so a miss just puts you back a few
        seconds:
      </p>
      <p>
        <strong>One bounce.</strong> The first pit has a single orb. Cross it. Then turn
        around and cross it back. Do it until it feels boring.
        <br />
        <strong>Hold the beat.</strong> The second pit is three orbs in a row — this is
        where the rhythm lives. Two bounces a second, no mashing.
        <br />
        <strong>Read while you bounce.</strong> The third pit staggers the orb heights, so
        your eyes have to plan the next bounce while your hands finish this one.
        <br />
        <strong>Trust the nail.</strong> The last pit puts the orbs low over the spikes.
        Scary — and completely safe, because spikes are bounceable too. Touching them with
        your <em>body</em> costs seconds; touching them with your <em>nail</em> is flight.
      </p>
    </>
  );
}
