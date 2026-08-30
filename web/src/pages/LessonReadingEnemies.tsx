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
      <p className="lede">{readingEnemiesCopy.lede}</p>

      <h2>{readingEnemiesCopy.twoQuestions}</h2>
      <ul className="plain-list">
        <li>
          If you know where you are and that a bench is nearby, then train on the enemies around you
          until they are boring. Try, die, repeat.
        </li>
        <li>
          If you don’t know where you are or there isn’t a bench nearby, be more cautious. Try to
          avoid enemies rather than picking a fight. After you find the bench, go back and give them
          a piece of your mind.
        </li>
      </ul>

      <h2>{readingEnemiesCopy.threeBeats}</h2>
      <p>
        There’s a windup, attack, and recovery. Look for the windup before the enemy attacks, this
        makes it a lot easier to dodge attacks. Once you get more comfortable, you can also sneak in
        extra attacks during the windup, cooldown, and even some attacks!
      </p>
      <DemoLegend />

      <h2>{readingEnemiesCopy.duelist}</h2>
      <LessonDemo script={duelistLungeDemo} label={readingEnemiesCopy.duelistGroundDemo} />
      <p>Walk in on the ground: the crouch is the tell, the lunge covers a lot of ground.</p>
      <LessonDemo script={duelistAntiAirDemo} label={readingEnemiesCopy.duelistAirDemo} />
      <p>
        This enemy is always hunting you down and reacting to what you do. You’ll have to fake him
        out if you ever want to land a hit.
      </p>

      <h2>{readingEnemiesCopy.spitter}</h2>
      <LessonDemo script={spitterVolleyDemo} label={readingEnemiesCopy.spitterDemo} />
      <p>
        A fan of three. Weave between them. A lot of (but not all) projectiles in Hollow Knight are
        cancelled out when attacked, the timing is just A LOT HARDER in game.
      </p>

      <h2>{readingEnemiesCopy.warden}</h2>
      <LessonDemo script={wardenShieldDemo} label={readingEnemiesCopy.wardenShieldDemo} />
      <p>
        The shield covers one side at a time and follows you with a little lag. This is a purely
        defensive, reactive enemy. It punishes mistakes without pressuring you to act.
      </p>
      <LessonDemo script={wardenRiposteDemo} label={readingEnemiesCopy.wardenRiposteDemo} />
      <p>
        Attack him and he’ll attack back. Counterintuitively, the best way to beat him is to hit his
        shield, dodge the attack, then hit him again in the cooldown.
      </p>

      <p className="thesis">{readingEnemiesCopy.thesis}</p>

      <ChapterNext current="reading-enemies" />

      <ChapterNav current="reading-enemies" />
    </ChapterGate>
  );
}
