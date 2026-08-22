import { Link } from 'react-router';
import { ChapterNav } from '../components/ChapterNav';
import { JoyConDiagram, LeverlessDiagram } from '../components/ControllerDiagrams';
import { useMarkVisited } from '../storage/useChapterProgress';

export function LessonSetup() {
  useMarkVisited('setup');
  return (
    <>
      <p className="eyebrow">Chapter 1 · Dirtmouth</p>
      <h1>Your Setup</h1>
      <p className="lede">
        Kayla, this one decides everything after it:{' '}
        <strong>pick one controller and stay with it.</strong> Everything the dojo teaches ends up
        stored in your hands — and your hands can only save one layout.
      </p>

      <div className="controller-compare">
        <section className="controller-card" aria-labelledby="joycon-h">
          <h2 id="joycon-h">Joy-Con</h2>
          <JoyConDiagram />
          <ul className="pro-con">
            <li className="pro">Always in your hands — works handheld, docked, anywhere.</li>
            <li className="pro">
              Jump and attack under one thumb, dash under one finger: the game was built around
              this.
            </li>
            <li className="con">Tiny buttons; cramps on long sessions.</li>
            <li className="con">
              A stick tilted slightly off “down” turns a pogo into a side slash — pogo from the ↓
              button, not the stick.
            </li>
          </ul>
        </section>
        <section className="controller-card" aria-labelledby="leverless-h">
          <h2 id="leverless-h">Leverless</h2>
          <LeverlessDiagram />
          <ul className="pro-con">
            <li className="pro">
              Down is exactly down, every time — the cleanest pogo input there is.
            </li>
            <li className="pro">
              One finger per button: jump, attack, dash and ↓ can all be held at once.
            </li>
            <li className="con">
              Dock and cable only, plus a settings toggle — every extra step is a reason to grab the
              Joy-Con “just this once”.
            </li>
            <li className="con">
              Out of the box, jump (B) and attack (Y) sit under the same finger. Remap once.
            </li>
          </ul>
        </section>
      </div>

      <h2>How to choose</h2>
      <p>
        Twenty minutes on each, once. Notice which one disappears from your attention faster, and
        which one your hands reach for when a fight gets scary. That one wins.
      </p>

      <p className="thesis">
        Both can beat the whole game. Neither is faster. The only thing that matters is muscle
        memory, and it only builds on one layout — so choose tonight, and don’t touch the other
        until the credits roll.
      </p>

      <p className="muted">
        Keep the same buttons here as on the Switch, so what you build in the{' '}
        <Link to="/play/pogo">mini-games</Link> walks straight over. Soon this site will read your
        controller directly.
      </p>

      <ChapterNav current="setup" />
    </>
  );
}
