import { Link } from 'react-router';
import { ChapterNav } from '../components/ChapterNav';
import { LessonDemo } from '../components/LessonDemo';
import {
  duelistAntiAirDemo,
  duelistLungeDemo,
  spitterVolleyDemo,
  wardenRiposteDemo,
  wardenShieldDemo,
} from '../engine/demo';
import { useMarkVisited } from '../storage/useChapterProgress';

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
  useMarkVisited('reading-enemies');
  return (
    <>
      <p className="eyebrow">Chapter 3 · Greenpath</p>
      <h1>Reading Enemies</h1>
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
        Jump in: it leaps to meet you. <em>Your approach picks its attack</em> — so you already know
        which answer is coming. Either way, the gold after is yours.
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
        Swing into the shield and it answers. That can be the plan: poke, step out of the riposte,
        take the gold. This one enemy is the whole doctrine — attacking at the wrong time is
        punished, and watching reveals the safe window.
      </p>

      <p className="thesis">
        Now go watch one for real: the <Link to="/play/dodge">Dodge Arena</Link> has an observe mode
        where your nail does no damage. When the attacks feel readable, switch it off and start
        collecting.
      </p>

      <ChapterNav current="reading-enemies" />
    </>
  );
}
