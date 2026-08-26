import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { LessonDemo } from '../components/LessonDemo';
import { ChapterNext } from '../components/ChapterNext';
import { pogoRhythmDemo } from '../engine/demo';
import { DASH_NUMBERS, ESCAPE_WINDOW } from './lessonPogo.helpers';

export function LessonPogo() {
  const chapter = chapterById('pogo');
  return (
    <ChapterGate current="pogo">
      <p className="eyebrow">
        Chapter {chapterIndex('pogo')} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">
        Kayla, the pogo — bouncing off things with a downward slash — is the one skill that changes
        how this game feels. Spikes become trampolines. Enemies become platforms.
      </p>

      <LessonDemo
        script={pogoRhythmDemo}
        label="Slow-motion demo of the Knight bouncing on an orb, with the down-slash hitbox drawn in green"
      />

      <h2>Three things that make it kinder than it looks</h2>
      <ul className="plain-list">
        <li>
          The down-slash is <em>wide</em> — wider than you. Near enough is enough.
        </li>
        <li>Every bounce is the same height (about half a jump). Learn one arc, trust it.</li>
        <li>
          <strong>Every bounce gives your dash back.</strong> That’s the secret that unlocks whole
          areas later.
        </li>
      </ul>

      <h2>It’s a beat, not a mash</h2>
      <p>
        Slash, bounce, breathe, slash — about two a second. If you’re hammering the button, land and
        start again slower: a swing that misses its moment leaves you falling with your nail on
        cooldown.
      </p>

      <h2>Hit, then leave</h2>
      <p>
        The dash isn’t really for crossing rooms, Kayla. It’s for the moment right after you land a
        hit: slash, dash out, and watch the answer arrive where you were standing.
      </p>
      <ul className="plain-list">
        <li>
          <strong>Running buys you {ESCAPE_WINDOW.running} s.</strong> Turn and go any later than
          that after your hit and the duelist’s swipe catches you on the way out — it travels
          forward with him, so running only just outpaces it. Dash and you have{' '}
          {ESCAPE_WINDOW.dashing} s.
        </li>
        <li>
          <strong>
            {DASH_NUMBERS.distancePx} px in a quarter second, against {DASH_NUMBERS.runDistancePx}{' '}
            running.
          </strong>{' '}
          That’s {DASH_NUMBERS.headStartPx} px of daylight, at {DASH_NUMBERS.timesRunSpeed}× your
          run speed.
        </li>
        <li>
          <strong>The rhythm is the dash, not the nail.</strong> Your nail is ready again after{' '}
          {DASH_NUMBERS.nailReadySeconds} s but your dash takes {DASH_NUMBERS.dashReadySeconds} s,
          so hit-and-away is paced by your legs. Bounce off something and the dash comes straight
          back — that’s the secret from up the page, doing real work.
        </li>
      </ul>
      <p className="thesis">
        The dash doubles the time you have to change your mind — from a tenth of a second to two
        tenths. That’s all it buys, and it’s enough.
      </p>
      <p>
        One exception, and it’s the one waiting at the bottom of the well: <strong>never</strong>{' '}
        dash away from Bill the man’s lance. Once he’s hot it travels at{' '}
        {DASH_NUMBERS.hotLancePxPerSecond} px/s and your dash is {DASH_NUMBERS.dashPxPerSecond}. You
        cannot outrun it along the floor. Get in the air instead.
      </p>

      <h2>Drills, in order</h2>
      <p>
        These four are level 1 of the Pogo Course. Each is a lantern, so a miss costs seconds, not
        the run:
      </p>
      <ol className="plain-list">
        <li>
          <strong>One bounce.</strong> Cross the first pit. Cross it back. Until it’s boring.
        </li>
        <li>
          <strong>Hold the beat.</strong> Three orbs in a row. No mashing.
        </li>
        <li>
          <strong>Read while you bounce.</strong> Staggered heights — plan the next one while your
          hands finish this one.
        </li>
        <li>
          <strong>Trust the nail.</strong> Orbs low over spikes. Your <em>body</em> on spikes costs
          seconds; your <em>nail</em> on spikes is flight.
        </li>
      </ol>

      <ChapterNext current="pogo" />

      <ChapterNav current="pogo" />
    </ChapterGate>
  );
}
