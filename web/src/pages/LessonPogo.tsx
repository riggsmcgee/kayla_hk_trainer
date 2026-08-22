import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { LessonDemo } from '../components/LessonDemo';
import { ProveIt } from '../components/ProveIt';
import { pogoRhythmDemo } from '../engine/demo';

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

      <ProveIt current="pogo" />

      <ChapterNav current="pogo" />
    </ChapterGate>
  );
}
