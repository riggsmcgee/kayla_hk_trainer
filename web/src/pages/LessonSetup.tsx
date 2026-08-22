import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ControllerChoice } from '@dojo/shared';
import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { JoyConDiagram, LeverlessDiagram } from '../components/ControllerDiagrams';
import { progressStore, useProgress } from '../storage/useChapterProgress';

const CONTROLLER_NAME: Record<ControllerChoice, string> = {
  joycon: 'Joy-Con',
  leverless: 'Leverless',
};

/**
 * The chapter's finish (playtest 2, note 5): one question, answered once.
 * The answer is recorded and shown back; it changes nothing else — it
 * proves she has committed to one layout.
 */
function ControllerQuestion({
  controller,
  onChoose,
}: {
  controller: ControllerChoice | undefined;
  onChoose: (choice: ControllerChoice) => void;
}) {
  const [changing, setChanging] = useState(false);
  const choose = (choice: ControllerChoice) => {
    setChanging(false);
    onChoose(choice);
  };

  const answered = controller !== undefined && !changing;

  // A choice swaps the two buttons for the answer, and "change" swaps them
  // back, so keyboard focus follows the swap instead of dropping to the page.
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const shownAnswered = useRef(answered);
  useEffect(() => {
    if (shownAnswered.current === answered) return; // first render: leave the page's focus alone
    shownAnswered.current = answered;
    (answered ? changeRef : firstChoiceRef).current?.focus();
  }, [answered]);

  if (answered) {
    return (
      <section className="controller-question" aria-labelledby="controller-q">
        <h2 id="controller-q">Which controller will you use?</h2>
        <p className="controller-answer">
          <span>
            <strong>{CONTROLLER_NAME[controller]}</strong> it is. Stick with it.
          </span>
          <button
            ref={changeRef}
            type="button"
            className="text-button"
            onClick={() => setChanging(true)}
          >
            change
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="controller-question" aria-labelledby="controller-q">
      <h2 id="controller-q">Which controller will you use?</h2>
      <div className="choice-row">
        <button
          ref={firstChoiceRef}
          type="button"
          className="button choice-button"
          onClick={() => choose('joycon')}
        >
          Joy-Con
        </button>
        <button type="button" className="button choice-button" onClick={() => choose('leverless')}>
          Leverless
        </button>
      </div>
    </section>
  );
}

export function LessonSetup() {
  const chapter = chapterById('setup');
  const { progress, refresh } = useProgress();
  const controller = progress.controller;
  const choose = (choice: ControllerChoice) => {
    progressStore.setController(choice);
    refresh();
  };

  return (
    <ChapterGate current="setup">
      <p className="eyebrow">
        Chapter {chapterIndex('setup')} · {chapter.place}
      </p>
      <h1>{chapter.title}</h1>
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
            <li className="tip">
              The stick is yours. If pogos keep coming out as side-slashes, the ↓ button is a more
              reliable down.
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

      <p>
        Hollow Knight has more in it — focus, spells, healing. The dojo skips all of it on purpose.
        The few moves here carry the whole game.
      </p>

      <p className="muted">
        Keep the same buttons here as on the Switch, so what you build in the mini-games walks
        straight over. Buttons not doing what they should? Change them in{' '}
        <Link to="/settings">Settings</Link>.
      </p>

      <ControllerQuestion controller={controller} onChoose={choose} />

      <ChapterNav current="setup" />
    </ChapterGate>
  );
}
