import { Link } from 'react-router';
import { LessonDemo } from '../components/LessonDemo';
import {
  duelistAntiAirDemo,
  duelistLungeDemo,
  spitterVolleyDemo,
  wardenRiposteDemo,
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
  return (
    <>
      <h1>Lesson: Reading Enemies</h1>
      <p className="lede">
        Here&apos;s a secret, Kayla: when you meet a new enemy, your job is not to kill it.
        First, check yourself — do I know where I am? Is there a bench nearby? Then spend a
        whole life doing nothing but dodging, until you can avoid every single attack it
        has. Only then do you look for the one safe moment to strike back. Every attack in
        this game has a safe answer — some projectiles can even be knocked out of the air —
        and hitting them more than they hit you is the entire game.
      </p>

      <h2>The bench checklist</h2>
      <p>
        Before any fight that scares you, ask two questions. <em>Do I know where I am?</em>{' '}
        If you&apos;re lost, dying costs knowledge, not just progress. <em>Is there a bench
        nearby?</em> If yes, this is the perfect place to spend a life learning — the walk
        back is short, so a death is cheap tuition. If no, maybe now isn&apos;t the moment.
        Losing on purpose near a bench is how the game wants you to study.
      </p>

      <h2>Watching a fight, in slow motion</h2>
      <p>
        Every attack below runs on the real engine at half speed, with the real hitboxes
        drawn in. Each attack has three beats: the <strong>tell</strong>, the{' '}
        <strong>attack</strong>, and the <strong>opening</strong> — watch the bar at the
        bottom of each demo tick through them.
      </p>
      <DemoLegend />

      <h2>The duelist — it answers whatever you do</h2>
      <p>
        Walk in on the ground and it lunges. The crouch is the tell; the lunge covers a
        shocking amount of ground — standing and trading will always cost you. Wait it
        out, and the gold window after the lunge is yours.
      </p>
      <LessonDemo
        script={duelistLungeDemo}
        label="Slow-motion demo: approaching the duelist on the ground provokes its lunge; the attack hitbox shows in red, the recovery window in gold"
      />
      <p>
        Now the same enemy, approached from the air — it answers upward instead. The
        lesson isn&apos;t &quot;never jump&quot;; it&apos;s that <em>your approach picks
        its attack</em>. Once you know which question you&apos;re asking, you know which
        answer is coming.
      </p>
      <LessonDemo
        script={duelistAntiAirDemo}
        label="Slow-motion demo: jumping at the duelist provokes its rising swipe instead"
      />

      <h2>The spitter — its attack is your stepping stone</h2>
      <p>
        It keeps its distance and spits a fan of three. Two answers, both good: weave
        between the shots, or <strong>slash them out of the air</strong> — they&apos;re
        green, and green means your nail wins. Then, while it&apos;s spent, close the
        distance and collect.
      </p>
      <LessonDemo
        script={spitterVolleyDemo}
        label="Slow-motion demo: the spitter winds up and fires a three-shot fan of destroyable projectiles, then recovers"
      />

      <h2>The warden — patience beats armor</h2>
      <p>
        The shield blocks everything — swinging at it just rings your nail off metal and
        provokes the counter. That&apos;s not a failure; that&apos;s the plan.{' '}
        <em>Deliberately</em> poke, step back out of the riposte, and then take the gold
        window it leaves behind. This one enemy is the whole doctrine in miniature:
        attacking at the wrong time is punished, and observation reveals the one safe
        window.
      </p>
      <LessonDemo
        script={wardenRiposteDemo}
        label="Slow-motion demo: a blocked hit provokes the warden's riposte; only its post-riposte recovery is vulnerable"
      />

      <h2>Now go watch one for real</h2>
      <p>
        The <Link to="/practice/dodge">Dodge Arena</Link> has an <strong>observe mode</strong>{' '}
        made exactly for this lesson: your nail does no damage, so there&apos;s nothing to
        do but watch, dodge, and survive — the &quot;spend a whole life just dodging&quot;
        rule, made into a game. When an enemy&apos;s attacks feel readable, switch observe
        off and start collecting your hits.
      </p>
    </>
  );
}
