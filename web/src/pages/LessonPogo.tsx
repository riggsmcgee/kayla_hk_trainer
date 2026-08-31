import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { LessonDemo } from '../components/LessonDemo';
import { ChapterNext } from '../components/ChapterNext';
import { lessonCopy, pogoLessonCopy } from '../copy/lessons';
import { pogoRhythmDemo } from '../engine/demo';
import { ESCAPE_WINDOW, tenthsInWords } from './lessonPogo.helpers';

export function LessonPogo() {
  const chapter = chapterById('pogo');
  return (
    <ChapterGate current="pogo">
      <p className="eyebrow">{lessonCopy.eyebrow(chapterIndex('pogo'), chapter.place)}</p>
      <h1>{chapter.title}</h1>
      <p className="lede">{pogoLessonCopy.lede}</p>

      <LessonDemo script={pogoRhythmDemo} label={pogoLessonCopy.demoLabel} />

      <h2>{pogoLessonCopy.kinder}</h2>
      <ul className="plain-list">
        <li>
          The down-slash is <strong>wider</strong> than you. You don’t always have to be perfectly
          over your target.
        </li>
        <li>
          Unlike jumping, every bounce is the same height. Once you get it into muscle memory, it
          never changes.
        </li>
        <li>
          <strong>Every bounce gives your dash back.</strong> Using that, you can stay above many
          enemies, move out of the way of aerial attacks, or just stall in the air for a few
          seconds.
        </li>
      </ul>

      <h2>{pogoLessonCopy.beat}</h2>
      <p>
        I’m not gonna lie, I definitely mash when I’m in a panic, but that’s not the way to
        practice. In this simulator, and in the actual game, practice timing your slashes so you
        don’t get caught out when your nail is on that short cooldown.
      </p>

      <h2>{pogoLessonCopy.hitThenLeave}</h2>
      <p>
        A non-obvious skill is dashing right after your pogo. This lets you get a hit in then
        immediately move out of the way of your opponent (or stay on them once you get more
        confident and want to go for more damage).
      </p>
      <ul className="plain-list">
        <li>If you mess up your timing, dashing can save you from getting hit.</li>
        <li>
          Not just for pogo, attacking then dashing back is a great way to get chip damage on an
          opponent you’re still figuring out.
        </li>
        <li>
          Practice running up, pogoing (or attacking) then immediately dashing away. Sometimes
          you’ll accidentally dash into the enemy. This is one of the reasons I prefer the box
          controller. It makes those movements WAY easier.
        </li>
      </ul>
      <p className="thesis">
        {pogoLessonCopy.thesis(
          tenthsInWords(ESCAPE_WINDOW.running),
          tenthsInWords(ESCAPE_WINDOW.dashing),
        )}
      </p>

      <h2>{pogoLessonCopy.drills}</h2>
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
