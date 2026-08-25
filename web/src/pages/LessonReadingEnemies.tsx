import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { LessonDemo } from '../components/LessonDemo';
import { ChapterNext } from '../components/ChapterNext';
import {
  duelistAntiAirDemo,
  duelistLungeDemo,
  spitterVolleyDemo,
  wardenRiposteDemo,
  wardenShieldDemo,
} from '../engine/demo';

function DemoLegend() {
  return (
    <ul className="demo-legend" aria-label="Overlay color legend">
      <li className="legend-red">red — where it hurts</li>
      <li className="legend-green">green — your nail beats this</li>
      <li className="legend-gold">gold — the punish window</li>
    </ul>
  );
}

export function LessonReadingEnemies() {
  const chapter = chapterById('reading-enemies');
  return (
    <ChapterGate current="reading-enemies">
      <p className="eyebrow">
        Chapter {chapterIndex('reading-enemies')} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
      <p className="lede">
        Here’s the secret, Kayla: when you meet a new enemy, your job is <em>not</em> to kill it.
        Spend a whole life just dodging. When you can avoid everything it has, find the one safe
        moment to hit back.
      </p>

      <h2>Before the fight: two questions</h2>
      <ul className="plain-list">
        <li>
          <strong>Do I know where I am?</strong> If you’re lost, dying costs knowledge.
        </li>
        <li>
          <strong>Is there a bench nearby?</strong> If yes, this is the place to spend a life
          learning — the walk back is cheap.
        </li>
      </ul>

      <h2>Every attack has three beats</h2>
      <p>
        The <strong>tell</strong>, the <strong>attack</strong>, the <strong>opening</strong>. The
        demos below run on the real engine at half speed with the real hitboxes drawn in; the bar at
        the bottom ticks through the beats.
      </p>
      <DemoLegend />

      <h2>The duelist answers whatever you do</h2>
      <LessonDemo
        script={duelistLungeDemo}
        label="Slow-motion demo: approaching the duelist on the ground provokes its lunge; the attack hitbox shows in red, the recovery window in gold"
      />
      <p>Walk in on the ground: the crouch is the tell, the lunge covers a lot of ground.</p>
      <LessonDemo
        script={duelistAntiAirDemo}
        label="Slow-motion demo: jumping at the duelist provokes its rising swipe, which clips the jumper"
      />
      <p>
        Jump in: it leaps to meet you, and the swipe reaches high.{' '}
        <em>Your approach picks its attack</em> — so you can tell which answer is coming. Either
        way, the gold after is yours.
      </p>

      <h2>The spitter’s attack is your stepping stone</h2>
      <LessonDemo
        script={spitterVolleyDemo}
        label="Slow-motion demo: the spitter winds up and fires a three-shot fan of destroyable projectiles, then recovers"
      />
      <p>
        A fan of three. Weave between them, or <strong>slash them out of the air</strong> — green
        means your nail wins. Then close in while it’s spent.
      </p>

      <h2>The warden: hit where the shield isn’t</h2>
      <LessonDemo
        script={wardenShieldDemo}
        label="Slow-motion demo: hanging above the warden makes it raise its shield overhead, leaving the front open; standing in front too long draws a shield bash"
      />
      <p>
        The shield covers one side at a time and follows you with a little lag. Go over it and the
        front opens; stand in front too long and it comes for you.
      </p>
      <LessonDemo
        script={wardenRiposteDemo}
        label="Slow-motion demo: a blocked hit provokes the warden's riposte; its post-riposte recovery is wide open"
      />
      <p>
        Swing into the shield and it answers. That can be the plan: poke, step out of the answer,
        take the gold. This one enemy is the whole doctrine — attacking at the wrong time is
        punished, and watching reveals the safe window. It has more than one answer, and where you
        hit it from decides which one you get.
      </p>

      <p className="thesis">
        Now prove it in the arena, Kayla: survive a minute against each one and land your hits.
        Watch, dodge, then take it apart.
      </p>

      <ChapterNext current="reading-enemies" />

      <ChapterNav current="reading-enemies" />
    </ChapterGate>
  );
}
