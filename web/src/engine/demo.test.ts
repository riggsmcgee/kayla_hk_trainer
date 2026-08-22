/**
 * Lesson-demo choreography tests. The demos run the real enemy machines, so
 * a tuning change can silently break the story a demo tells (a stray lunge
 * wearing the anti-air captions, a ghost ending up inside a warden that
 * moved). These pin the beats each script must hit within one cycle.
 */
import { describe, expect, it } from 'vitest';
import { FIXED_DT } from './constants';
import { duelistAntiAirDemo, wardenRiposteDemo, wardenShieldDemo } from './demo';
import type { DemoActors, DemoScript } from './demo';
import { stepEnemy } from './enemies';

interface Beat {
  t: number;
  kind: string;
  phase: string;
  shield: string;
  hurt: boolean;
  block: boolean;
  ghostX: number;
  enemyX: number;
}

/** Run one full cycle of a script on the real machines; return every step's state. */
function runCycle(script: DemoScript): Beat[] {
  const actors: DemoActors = script.setup();
  const beats: Beat[] = [];
  let lastHurt = 0;
  let lastBlock = 0;
  for (let t = 0; t < script.cycle; t += FIXED_DT) {
    script.drive(actors, t);
    const e = actors.enemy!;
    const g = actors.ghost!;
    stepEnemy(e, actors.world, FIXED_DT, {
      position: g.feet,
      grounded: g.feet.y >= script.view.floorY - 1,
    });
    beats.push({
      t,
      kind: String(e.attackKind),
      phase: e.phase,
      shield: e.shieldDir,
      hurt: e.hurtFlashTimer > lastHurt,
      block: e.blockFlashTimer > lastBlock,
      ghostX: g.feet.x,
      enemyX: e.position.x,
    });
    lastHurt = e.hurtFlashTimer;
    lastBlock = e.blockFlashTimer;
  }
  return beats;
}

describe('duelistAntiAirDemo', () => {
  it('provokes exactly one attack per cycle — the rising swipe — and it clips the ghost', () => {
    const script = duelistAntiAirDemo;
    const actors = script.setup();
    const kinds = new Set<string>();
    let clipped = false;
    for (let t = 0; t < script.cycle; t += FIXED_DT) {
      script.drive(actors, t);
      const e = actors.enemy!;
      const g = actors.ghost!;
      stepEnemy(e, actors.world, FIXED_DT, {
        position: g.feet,
        grounded: g.feet.y >= script.view.floorY - 1,
      });
      if (e.attackKind) kinds.add(e.attackKind);
      if ((g.hurt ?? 0) > 0 && e.attackKind === 'antiair') clipped = true;
    }
    expect([...kinds]).toEqual(['antiair']);
    expect(clipped).toBe(true);
  });
});

describe('wardenRiposteDemo', () => {
  it('blocked poke → riposte → one landed punish, and no bash sneaks into the cycle', () => {
    const beats = runCycle(wardenRiposteDemo);
    const kinds = new Set(beats.map((b) => b.kind).filter((k) => k !== 'null'));
    expect([...kinds]).toEqual(['riposte']);
    expect(beats.filter((b) => b.block).length).toBe(1);
    expect(beats.filter((b) => b.hurt).length).toBe(1);
    // The punish is dealt from in front of the warden, never from inside it.
    const punish = beats.find((b) => b.hurt)!;
    expect(punish.enemyX - punish.ghostX).toBeGreaterThan(40);
  });
});

describe('wardenShieldDemo', () => {
  it('shield goes up, the drop-and-strike lands, the bash fires, the punish lands', () => {
    const beats = runCycle(wardenShieldDemo);
    expect(beats.some((b) => b.shield === 'up')).toBe(true);
    expect(beats.filter((b) => b.block).length).toBe(0);
    expect(beats.filter((b) => b.hurt).length).toBe(2);
    expect(beats.some((b) => b.kind === 'bash' && b.phase === 'active')).toBe(true);
    for (const b of beats.filter((x) => x.hurt)) {
      expect(b.enemyX - b.ghostX).toBeGreaterThan(40); // struck from in front
    }
    // The ghost is never swallowed by the warden's body.
    expect(beats.every((b) => Math.abs(b.enemyX - b.ghostX) > 24 || b.t < 2.3)).toBe(true);
  });
});
