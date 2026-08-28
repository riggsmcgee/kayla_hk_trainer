import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { LessonDemo } from '../components/LessonDemo';
import { ChapterNext } from '../components/ChapterNext';
import { lessonCopy, readingEnemiesCopy } from '../copy/lessons';
import {
  duelistAntiAirDemo,
  duelistLungeDemo,
  spitterVolleyDemo,
  wardenRiposteDemo,
  wardenShieldDemo,
} from '../engine/demo';

function DemoLegend() {
  return (
    <ul className="demo-legend" aria-label={readingEnemiesCopy.legendLabel}>
      <li className="legend-red">{readingEnemiesCopy.legendRed}</li>
      <li className="legend-green">{readingEnemiesCopy.legendGreen}</li>
      <li className="legend-gold">{readingEnemiesCopy.legendGold}</li>
    </ul>
  );
}

export function LessonReadingEnemies() {
  const chapter = chapterById('reading-enemies');
  return (
    <ChapterGate current="reading-enemies">
      <p className="eyebrow">
        {lessonCopy.eyebrow(chapterIndex('reading-enemies'), chapter.place)}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">
        {readingEnemiesCopy.ledeLead}
        <em>{readingEnemiesCopy.ledeEm}</em>
        {readingEnemiesCopy.ledeTail}
      </p>

      <h2>{readingEnemiesCopy.twoQuestions}</h2>
      <ul className="plain-list">
        <li>
          <strong>Do I know where I am?</strong> If you’re lost, dying costs knowledge.
        </li>
        <li>
          <strong>Is there a bench nearby?</strong> If yes, this is the place to spend a life
          learning — the walk back is cheap.
        </li>
      </ul>

      <h2>{readingEnemiesCopy.threeBeats}</h2>
      <p>
        The <strong>tell</strong>, the <strong>attack</strong>, the <strong>opening</strong>. The
        demos below run on the real engine at half speed with the real hitboxes drawn in; the bar at
        the bottom ticks through the beats.
      </p>
      <DemoLegend />

      <h2>{readingEnemiesCopy.duelist}</h2>
      <LessonDemo script={duelistLungeDemo} label={readingEnemiesCopy.duelistGroundDemo} />
      <p>Walk in on the ground: the crouch is the tell, the lunge covers a lot of ground.</p>
      <LessonDemo script={duelistAntiAirDemo} label={readingEnemiesCopy.duelistAirDemo} />
      <p>
        Jump in: it leaps to meet you, and the swipe reaches high.{' '}
        <em>Your approach picks its attack</em> — so you can tell which answer is coming. Either
        way, the gold after is yours.
      </p>

      <h2>{readingEnemiesCopy.spitter}</h2>
      <LessonDemo script={spitterVolleyDemo} label={readingEnemiesCopy.spitterDemo} />
      <p>
        A fan of three. Weave between them, or <strong>slash them out of the air</strong> — green
        means your nail wins. Then close in while it’s spent.
      </p>

      <h2>{readingEnemiesCopy.warden}</h2>
      <LessonDemo script={wardenShieldDemo} label={readingEnemiesCopy.wardenShieldDemo} />
      <p>
        The shield covers one side at a time and follows you with a little lag. Go over it and the
        front opens; stand in front too long and it comes for you.
      </p>
      <LessonDemo script={wardenRiposteDemo} label={readingEnemiesCopy.wardenRiposteDemo} />
      <p>
        Swing into the shield and it answers. That can be the plan: poke, step out of the answer,
        take the gold. This one enemy is the whole doctrine — attacking at the wrong time is
        punished, and watching reveals the safe window. It has more than one answer, and where you
        hit it from decides which one you get.
      </p>

      <p className="thesis">{readingEnemiesCopy.thesis}</p>

      <ChapterNext current="reading-enemies" />

      <ChapterNav current="reading-enemies" />
    </ChapterGate>
  );
}
