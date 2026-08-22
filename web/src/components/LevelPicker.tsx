/**
 * The Bounce Bog's level chips (playtest 2, note 3): one per level, number
 * + name, a check once cleared, a lock while the level before it isn't.
 * Clear-to-unlock, always skippable: pressing a locked chip opens a small
 * gate right under the row — "Clear level N−1 first", the obvious button
 * back to that level, and a quiet "Skip this level". Nothing ever traps her.
 *
 * Pure view: progress comes in, choices go out. The page owns the store.
 */
import { useState } from 'react';
import type { ProgressV1 } from '@dojo/shared';
import { POGO_COURSES } from '../engine/course';
import { COURSE_LEVEL_COUNT } from '../engine/roster';
import { levelLocked } from '../storage/progress';
import { blurOnPointerClick } from './focus';
import '../styles/gates.css';
import '../styles/levels.css';

interface LevelPickerProps {
  progress: ProgressV1;
  /** 1-based selected level. */
  selected: number;
  onSelect: (level: number) => void;
  /** She chose to skip this level's lock; the page marks it and refreshes progress. */
  onSkip: (level: number) => void;
}

const LEVELS = Array.from({ length: COURSE_LEVEL_COUNT }, (_, i) => i + 1);

function levelName(level: number): string {
  return POGO_COURSES[level - 1]?.name ?? `Level ${level}`;
}

function CheckMark() {
  return (
    <svg className="level-mark level-mark-check" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  );
}

function Lock() {
  return (
    <svg className="level-mark level-mark-lock" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7 V5 a2.5 2.5 0 0 1 5 0 V7" />
    </svg>
  );
}

export function LevelPicker({ progress, selected, onSelect, onSkip }: LevelPickerProps) {
  // The locked level she last pressed; the gate shows while it stays locked.
  const [asked, setAsked] = useState<number | null>(null);
  const gateLevel = asked !== null && levelLocked(asked, progress) ? asked : null;

  const pick = (level: number): void => {
    if (levelLocked(level, progress)) {
      setAsked(level);
      return;
    }
    setAsked(null);
    onSelect(level);
  };

  return (
    <div className="level-picker">
      <div className="btn-row" role="group" aria-label="Choose a level">
        {LEVELS.map((level) => {
          const cleared = progress.courseLevelsCleared.includes(level);
          const locked = levelLocked(level, progress);
          const active = level === selected;
          const cls = [
            'chip',
            'level-chip',
            active ? 'chip-active' : '',
            locked ? 'level-locked' : '',
            cleared ? 'level-cleared' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              className={cls}
              onClick={(e) => {
                blurOnPointerClick(e);
                pick(level);
              }}
            >
              <span className="level-num">{level}</span>
              <span className="level-name">{levelName(level)}</span>
              {cleared && <CheckMark />}
              {locked && <Lock />}
              {cleared && <span className="sr-only">, cleared</span>}
              {locked && <span className="sr-only">, locked</span>}
            </button>
          );
        })}
      </div>

      {gateLevel !== null && (
        <div className="level-gate" role="status">
          <p className="level-gate-rule">Clear level {gateLevel - 1} first.</p>
          <div className="gate-actions">
            <button type="button" className="button" onClick={() => pick(gateLevel - 1)}>
              Play level {gateLevel - 1}
            </button>
            <button type="button" className="text-button" onClick={() => onSkip(gateLevel)}>
              Skip this level
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
