import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ControllerChoice } from '@dojo/shared';
import { chapterById, chapterIndex } from '../chapters';
import { ChapterGate } from '../components/ChapterGate';
import { ChapterNav } from '../components/ChapterNav';
import { ChapterNext } from '../components/ChapterNext';
import { JoyConDiagram, LeverlessDiagram } from '../components/ControllerDiagrams';
import { progressStore, useProgress } from '../storage/useChapterProgress';
import { useGamepadBindings } from '../storage/useGamepadBindings';
import { PracticeCanvas } from '../components/PracticeCanvas';
import { SETUP_CHECKS, SETUP_CHECK_LABELS } from '../engine/setupChecks';
import { createSetupSandbox } from '../engine/setupSandboxSession';
import type { SetupCheck } from '@dojo/shared';
import '../styles/setup.css';
import { buttonName, gamepadDefaultsFor } from '../engine/gamepad';

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

  // Named by POSITION, from the same helper Settings uses, so this line tells
  // the truth after a remap instead of repeating the preset back at her.
  const [padBindings] = useGamepadBindings();
  // An action can be unbound, which is a legal state the capture allows. The
  // sentence has to survive it rather than printing "undefined" at her.
  const firstButton = (buttons: readonly number[]): string =>
    buttons.length > 0 ? buttonName(buttons[0]!) : 'nothing yet';
  const jump = firstButton(padBindings.jump);
  const attack = firstButton(padBindings.attack);
  const dash = firstButton(padBindings.dash);

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
        {/* PRESET, THEN OFFER. The preset has already happened by the time
            this renders; this is the offer, and it is a real one — the preset
            is a guess about which index each button reports on, and only her
            board can settle that. */}
        <p className="fine-print settings-note">
          Your buttons are set up for it already: <strong>jump {jump}</strong>,{' '}
          <strong>attack {attack}</strong>, <strong>dash {dash}</strong>.{' '}
          {controller === 'leverless'
            ? 'Attack is off jump’s finger, so you can hold both.'
            : 'The shape Hollow Knight ships in.'}{' '}
          If your board presses back differently, teach it yours in{' '}
          <Link to="/settings">Settings</Link> — four buttons, once.
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

/**
 * A bare floor, her Knight, and a list of the seven things the kit can do.
 *
 * Playtest 8, note 5. The sandbox has no pass and no fail — "just a bare
 * floor" — and the checklist is what makes it worth her time twice over: it
 * PROVES the buttons work and reading it is how she learns what she is
 * supposed to be able to do.
 *
 * The last item is the one that pays. `nailDir` is 'down' only in the air, so
 * ticking "slash down" is proof of the compound mid-air press the pogo needs,
 * without the floor needing anything to bounce off.
 */
function ControllerSandbox() {
  const { progress } = useProgress();

  /**
   * The sheet lives in a ref, not in state, and the factory below has no
   * dependencies — both for the same reason. `PracticeCanvas` rebuilds its
   * session whenever `createSession` changes identity, so a factory that
   * closed over changing state would restart the Knight on every tick.
   */
  const doneRef = useRef<Set<SetupCheck>>(new Set(progress.setupChecks ?? []));
  const [ticked, setTicked] = useState<readonly SetupCheck[]>(() => [...doneRef.current]);

  const createSession = useCallback(
    () =>
      createSetupSandbox({
        alreadyDone: doneRef.current,
        onEarned: (earned) => {
          for (const check of earned) doneRef.current.add(check);
          progressStore.markSetupChecks(earned);
          setTicked([...doneRef.current]);
        },
      }),
    [],
  );

  const remaining = SETUP_CHECKS.filter((check) => !ticked.includes(check)).length;

  return (
    <section className="setup-sandbox" aria-labelledby="sandbox-h">
      <h2 id="sandbox-h">Try it out</h2>
      <p>
        A floor and nothing else — nothing to fight, nothing to fall off, no clock. Move around
        until your controller feels like yours. The list is the whole kit: everything the dojo will
        ever ask you to do is one of these seven.
      </p>
      <PracticeCanvas
        label="A practice floor with your Knight on it, and nothing else"
        createSession={createSession}
      />
      <ul className="setup-checklist">
        {SETUP_CHECKS.map((check) => {
          const done = ticked.includes(check);
          return (
            <li key={check} className={done ? 'is-done' : undefined}>
              <span aria-hidden="true">{done ? '✔' : '·'}</span>
              <span>{SETUP_CHECK_LABELS[check]}</span>
              <span className="sr-only">{done ? ' — done' : ' — not yet'}</span>
            </li>
          );
        })}
      </ul>
      {/* aria-live so the count is announced as she works, without a screen
          reader user having to go hunting through the list for what changed. */}
      <p className="fine-print" role="status">
        {remaining === 0
          ? 'That is all seven. Your controller does everything the dojo needs.'
          : `${remaining} still to try.`}
      </p>
    </section>
  );
}

export function LessonSetup() {
  const chapter = chapterById('setup');
  const { progress, refresh } = useProgress();
  const controller = progress.controller;
  const [, setPadBindings] = useGamepadBindings();

  /**
   * Picking a controller now DOES something (playtest 8, note 5).
   *
   * For eight sessions `progress.controller` was written here and read in two
   * places — to print the answer back and to tick the chapter — while a single
   * set of pad defaults served both boards, and the leverless diagram's own
   * description told her that jump and attack shared a finger. The choice
   * configures the layout now.
   *
   * It applies only when the choice CHANGES. Re-confirming the same board must
   * not wipe a remap she made afterwards; telling us she has moved to a
   * different board is a good reason to lay that board out from scratch.
   */
  const choose = (choice: ControllerChoice) => {
    if (choice !== controller) setPadBindings(gamepadDefaultsFor(choice));
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

      {/* Only after she has committed to a board: the sandbox exists to prove
          THAT controller, and offering it before the choice would be asking
          her to test hardware she has not picked yet. */}
      {controller !== undefined && <ControllerSandbox />}

      <ChapterNext current="setup" />
      <ChapterNav current="setup" />
    </ChapterGate>
  );
}
