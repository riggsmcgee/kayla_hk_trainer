# Kayla's Hollow Knight Dojo — Project Plan

Durable record of the shared understanding reached with the user (Session 1, 2026-08-21). A future session should be able to execute from this document alone. Decisions listed here are **ratified** — do not re-decide them.

---

## 1. Vision & who it's for

Kayla ("Kbug"), the developer's cousin, is playing Hollow Knight — the first genuinely *hard* game she's ever played. This project is a gift and a teaching tool: a training website plus a scaled-down, browser-playable Hollow Knight practice game where she can drill the skills the real game demands, without the real game's punishment loop.

Tone everywhere on the site: warm, encouraging, personal — "let's learn this together," addressed to Kayla by name. It's a dojo built for one student. It should never read like generic gaming-guide content.

## 2. Training goals & teaching philosophy

Three pillars, in priority order:

1. **Pogo mastery.** Downslash bouncing is her weakest critical skill and the game gates real progress on it. The Pogo Course mode and the Pogo lesson exist to make bouncing automatic.
2. **Enemy analysis — dodge first, then punish.** The core doctrine the site teaches, in the user's own framing:
   - On meeting a new enemy, do **not** try to kill it. First run the **bench checklist**: "Do I know where I am? Is there a bench nearby?"
   - Then spend a whole life doing nothing but dodging, until you can avoid every attack the enemy has.
   - Only then find the **one safe nail strike per enemy attack**. Attacks have safe pokeable parts; some projectiles/attacks can be nullified by hitting them; bosses expose weak spots mid-attack.
   - The whole game in one sentence: **"Hit them more than they hit you and you beat the game."**
3. **Setup consistency.** Kayla alternates between a Joy-Con and a leverless controller, which sabotages muscle memory. The site preaches: pick ONE controller and stick with it. Later, gamepad support (Gamepad API) lets her practice on her actual controller so muscle memory transfers to the Switch.

## 3. Decision record

Every ratified decision with its rationale. These are settled.

| Decision | Rationale |
|---|---|
| **Vite (not Next.js)** | Static SPA with a canvas game needs no SSR, server components, or API routes; Vite is the simplest fast tool for a client-only React app deployed as static files. |
| **React + TypeScript (strict)** | React for the site chrome/routing/lessons; strict TS because the engine is exactly the kind of math-heavy code where types catch real bugs, and the shared types package keeps web/server honest. |
| **Canvas 2D, fixed-timestep 60 Hz sim + interpolated render** | Deterministic physics that feels the same on every machine; interpolation keeps rendering smooth on any refresh rate. React must NOT re-render the canvas — the game loop owns it. |
| **HashRouter** | GitHub Pages has no SPA fallback; hash routing means deep links (`/#/lessons/pogo`) work with zero server config. |
| **Feel-faithful physics anchored to decompiled constants** | `docs/research/hk-frame-data.md` holds real decompiled HeroController values (run 8.3 u/s, jump pin 16.65 u/s × 0.18 s, pogo pin 12 u/s × 0.25 s, etc.). Skills trained here only transfer to the real game if the feel matches. Effective gravity (~1900 px/s² at 40 px/unit) is the **one estimated value** and the designated tuning knob. |
| **5-enemy roster** (walker/flier/duelist/spitter/warden) | Expanded from 3 during the alignment interview: two harmless dummies to learn movement against, plus three attacker archetypes (melee-reactive, ranged, shield/counter) that each teach one branch of the dodge-then-punish doctrine. |
| **Vector-silhouette art drawn in code** | No sprite assets to produce or license; HK's own look is dark silhouettes, so code-drawn vector shapes stay on-theme, scale cleanly, and let hitboxes visibly match visuals (which matters for teaching). |
| **localStorage (versioned JSON) is the ONLY source of truth** | The site must serve Kayla forever with zero infrastructure. Versioned so future schema changes migrate cleanly. |
| **Disposable Express + better-sqlite3 backend, raw hand-written SQL, no ORM** | Exists purely as the developer's backend-learning exercise. Raw SQL because learning SQL is the point. It will be permanently shut down afterward; the code stays as a learning artifact. Nothing may ever depend on it (see §4). |
| **npm workspaces monorepo** (`web/`, `server/`, `shared/`) | One repo, shared types between web and server without publishing a package, and a clean boundary to enforce "web never imports server." |
| **Vitest** | Native Vite integration, fast, one test runner across all workspaces. |
| **GitHub Pages, public repo** (`kayla-hk-trainer`) | Free static hosting Kayla can reach from any browser; public because there's nothing secret and Pages is simplest that way. Deployed by GitHub Actions. *(Refinement, Session 4: the actual repo is `riggsmcgee/kayla_hk_trainer` — underscores — so the workflow derives `VITE_BASE` from the repo name instead of hardcoding it.)* |
| **Site name: "Kayla's Hollow Knight Dojo"** | It's *her* dojo — the name keeps the site personal and frames practice (not walkthroughs) as the point. |

## 4. Architecture

### Monorepo layout

```
kayla-hk-trainer/            root: kayla-hk-dojo (private), workspaces ["web","server","shared"]
├── web/                     @dojo/web — Vite + React + TS SPA (the real product)
│   └── src/
│       ├── engine/          canvas game: constants.ts, types.ts, loop.ts (fixed timestep)
│       ├── storage/         local.ts — versioned-JSON localStorage (injectable Storage backend)
│       ├── sync/            adapter.ts — optional mirror to the practice server
│       └── ...              routes/pages/components
├── server/                  @dojo/server — DISPOSABLE Express + better-sqlite3 practice backend
│   ├── db/migrations/       raw SQL, applied at startup, tracked in schema_migrations
│   └── data/dojo.db         gitignored
├── shared/                  @dojo/shared — types ONLY (no runtime deps); imported by web and server
└── docs/                    research + skills log (do not modify casually)
```

Root also carries ESLint 9 flat config + Prettier, Node 22 LTS.

### Local-first data flow (the hard constraint)

**The web app must work 100% with the server absent or deleted.** localStorage is the only source of truth; the server is a write-behind mirror at best.

```
game / UI  ──►  storage/local.ts (versioned JSON, source of truth)
                     │
                     ▼ (fire-and-forget)
              sync/adapter.ts ── short-timeout GET /health ping at startup
                     ├── reachable  → HTTP adapter mirrors PracticeRuns to POST /api/runs
                     └── unreachable → no-op adapter; SILENT — no errors, no UI, no retry spam
```

- The adapter choice is made once via a short-timeout `/health` ping; absence of the server must be completely silent.
- **Refinement (Session 3, 2026-08-21):** the ping runs lazily on the first run-record, and **only in dev builds** — a production build always gets the no-op adapter without fetching. Rationale: browsers log network noise to the console for any failed fetch, so a deployed site pinging localhost could never be truly silent; and the practice server only ever exists on the developer's machine anyway.
- **web/ may never import from server/** — enforced socially and by review. Rationale: the server is scheduled for deletion; any dependency on it converts a learning artifact into a load-bearing wall. `@dojo/shared` is the only shared code, and it is types-only so it can never smuggle in runtime coupling.

### Shared types (written in Session 1)

```ts
type PracticeMode = 'pogo' | 'dodge';
type EnemyId = 'walker' | 'flier' | 'duelist' | 'spitter' | 'warden';
interface PracticeRun {
  id: string; mode: PracticeMode; enemyId?: EnemyId; observeMode?: boolean;
  hitsLanded: number; durationMs: number; startedAt: string; // ISO
}
interface SettingsV1 {
  version: 1; reduceShake: boolean; reduceFlashing: boolean;
  inputBindings?: Record<string, string>;
}
```

### Server spec (practice project)

Express on port 4000, CORS for local dev. Routes: `GET /health`, `GET /api/runs`, `POST /api/runs` (PracticeRun records). Migrations: `server/db/migrations/001_init.sql`, applied at startup by a tiny runner tracked via a `schema_migrations` table. SQLite file at `server/data/dojo.db` (gitignored). One Vitest smoke test on a `":memory:"` database proving migrate + insert + select. After the user's backend practice ends: server shut down permanently, code kept.

## 5. Game design spec

### Player kit — deliberately minimal

Jump + basic dash + minimum nail (side/up/down slashes, pogo on downslash). **No double jump, no shade cloak, no spells.** Kayla is early-game; the trainer drills fundamentals with the kit she actually has. Physics per the constants table in `docs/research/hk-frame-data.md` (§ "Recommended starting values": 48 px Knight, 1 unit = 40 px, pinned-velocity jump and pogo, instant accel, gravity ≈ 1900 px/s² as the tuning knob).

### Mode 1: Pogo Course

Cross a spike/bounce-target obstacle course by chaining downslash pogos. Checkpointed so a miss costs seconds, not the run. Teaches pillar 1.

### Mode 2: Dodge Arena

One enemy at a time in a small arena. The run ends on the **first hit taken** — the mode mechanically enforces "don't get hit" as the objective. Score = nail hits landed. Teaches "hit them more than they hit you" with the emphasis on *than they hit you*.

**Observe mode** (toggle): the nail does no damage; score = survival time. This is the "spend a whole life just dodging" doctrine made into a mode — kill the incentive to attack, learn the patterns first.

### Enemy roster (canonical ids in @dojo/shared)

Each enemy exists to teach one thing. The three attackers get full **telegraph → active → recovery → punish-window** state machines (M4).

| Id | Model | Behavior | Teaches |
|---|---|---|---|
| `walker` | Crawlid | Ground pacer, turns at edges, contact damage only. No attacks. | Spacing, first pogo target, safe nail timing on a moving target. |
| `flier` | Vengefly | Drifting/bobbing dummy, contact damage only. | Aerial spacing, up-slash and pogo on an airborne target. |
| `duelist` | Mantis | Reactive melee: **lunge slash** if you approach on the ground; **rising anti-air swipe** if you jump in. Punishable in recovery. | Reading which attack *you* provoked; patience; punishing recovery instead of trading. |
| `spitter` | Aspid | Ranged: wind-up, then a 3-shot fan. **Projectiles can be nail-poked to destroy them.** Punish by closing distance during recovery. | Projectile nullification (attacks are pokeable); using the enemy's commitment window to close. |
| `warden` | shield/counter | Blocks frontal and aerial hits; blocking triggers a telegraphed riposte; **only vulnerable in post-counter recovery**. | The full doctrine: attacking at the wrong time is punished; observation reveals the one safe window. |

## 6. Lessons spec

Three lessons at `/lessons/*`, each mapping to a pillar:

1. **Pogo** — mechanics of the downslash bounce (pinned 0.25 s rise, generous 108 px-wide down-hitbox, ~2 bounces/sec rhythm), then drills feeding into the Pogo Course.
2. **Reading Enemies** — the dodge-first philosophy and the bench checklist, then per-enemy attack anatomy.
3. **Your Setup** — controller consistency: why alternating controllers erases muscle memory, pick one and stick with it.

**Engine-powered demo canvases:** lesson pages embed small inline canvases running the *same engine and hitbox data as the game*, playing slow-motion scripted replays of enemy attacks with overlays — **red = hurtbox, green = poke window (safe strike / destroyable projectile), gold = punish window**. Because demos are driven by the real hitbox data, they can never drift out of sync with the game they teach. Routes/pages stubbed in M0; demos land in M5.

## 7. Milestone roadmap

- **M0 — Skeleton (Session 2, DONE):** monorepo (`web`/`server`/`shared`), tooling (ESLint 9 flat + Prettier, Vitest, strict TS), routes stubbed with HashRouter, engine constants/types/loop skeleton, versioned localStorage module, sync adapter with silent no-op fallback, server skeleton (health/runs routes, migration runner, :memory: smoke test), HK-ish dark palette CSS custom properties, GitHub Actions Pages deploy workflow, smoke tests.
- **M1 — Engine core (Session 3, DONE):** fixed-timestep loop live, keyboard input, run/jump/dash movement to the decompiled constants (pinned jump, instant accel, dash with vy lock). Built TDD (`tdd` skill).
- **M2 — Nail combat + pogo; Pogo Course playable (Session 3, DONE):** slash cadence/hitboxes, pogo pin + resets, course tiles, checkpoints. Course 1 is proven beatable by a scripted-bot integration test running the shipped physics.
- **M3 — Dodge Arena + walker/flier (Session 3, DONE):** arena flow (end on first hit), scoring, PracticeRun records into localStorage.
- **M4 — duelist/spitter/warden state machines + observe mode (Session 3, DONE):** telegraph→active→recovery→punish-window machines; pokeable projectiles; counter logic; observe mode toggle.
- **M5 — Lessons + demos (Session 3, DONE):** three lesson pages written in the warm tone; engine-powered slow-mo demo canvases with red/green/gold overlays and a tell→attack→punish phase bar.
- **M6 — Art & juice pass + accessibility (Session 3, juice+accessibility DONE; art direction OPEN):** hit-stop/shake/squash-stretch via the `game-feel` skill's models; reduce-shake and reduce-flashing toggles wired to SettingsV1 on both practice pages. The `frontend-design` art-direction pass is deliberately left for a session with the user — visual taste calls deserve their input.
- **M7 — Gamepad support + binding UI:** Gamepad API, rebindable inputs stored in SettingsV1; test with Switch Pro and the leverless controller. (Needs the user's physical controllers.)
- **M8 — Backend practice + ship:** sync adapter live against the Express server; GitHub repo + Pages deploy; audits (`vercel-react-best-practices`, `web-design-guidelines`, browser E2E); then the backend shutdown checklist (confirm site fully functional with server gone, stop server, keep code). (Repo creation/push is outward-facing — waits for the user.)

## 8. Later / on the radar — explicitly NOT planned

- **Boss finale.** A capstone boss that combines the roster's mechanics is on the user's mind, but it is deliberately unplanned. Do not design or stub it without a new conversation with the user.

## 9. Pointers

- `docs/research/hk-frame-data.md` — decompiled physics/combat constants, canvas-scale conversion (48 px Knight, 1 u = 40 px), and the recommended `PHYS`/`ENEMIES` starting values. **Read before touching engine constants.** Gravity is the only estimated value; everything else is exact — tune gravity, not the rest.
- `docs/skills-log.md` — the skills experiment: every skill invocation on this project gets logged there with a verdict. Keep logging.
