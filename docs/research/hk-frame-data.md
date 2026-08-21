# Hollow Knight — movement & combat data for the practice game

Research compiled 2026-08-21. Goal: approximate Hollow Knight's feel in a web canvas game without reverse-engineering from scratch.

## How to read confidence levels

- **decompiled** — actual value from the game's `HeroController` (serialized on the Knight prefab / decompiled C#). Extracted directly from the Knight asset bundle and decompiled `HeroController.cs` mirrored in the [KnightInSilkSong](https://github.com/MCXGK3/KnightInSilkSong) repo (a mod that ports the HK 1.5 Knight — code and prefab — into Silksong). Every value in that dump that the Hollow Knight Wiki independently documents (run speed 8.3/10/11.5, dash 20/28, cooldowns 0.6/0.4, nail 0.35/0.41/0.28/0.25, i-frames 1.3/1.75, recoil 0.2/0.08) matches exactly, which validates the rest of the set.
- **wiki (decompiled-sourced)** — number stated on hollowknight.wiki; the wiki's technical numbers come from the decompiled game.
- **community** — measured/described by players; not an exact constant.
- **estimated** — my estimate from gameplay observation or derivation; tune by feel.

**Units:** Hollow Knight uses Unity world units. Physics runs in `FixedUpdate` at the Unity default 50 Hz, so **1 "step" = 0.02 s**. Several mechanics count steps, not seconds.

Key source files (all in the KnightInSilkSong repo unless noted):
- `Knight/HeroController.cs` — decompiled hero logic (Jump/Bounce/Recoil/CancelJump verified by reading the code)
- `KIS/Resources/knight` — Unity asset bundle containing the serialized HeroController constants and hitbox colliders (extracted with UnityPy)
- [hk-modding/api `Patches/HeroController.cs`](https://github.com/hk-modding/api/blob/master/Assembly-CSharp/Patches/HeroController.cs) — official modding API patch (input-queue constants)
- [HollowKnight.DebugMod `SaveStates/SaveState.cs`](https://github.com/TheMulhima/HollowKnight.DebugMod/blob/master/Source/SaveStates/SaveState.cs) — hard-codes the Knight's `gravityScale = 0.79f`

---

## 1. Movement

| Value | Number | Source | Confidence |
|---|---|---|---|
| Run speed (`RUN_SPEED`) | **8.3 u/s** (instant accel — no ramp-up; velocity set directly) | [KnightInSilkSong prefab dump](https://github.com/MCXGK3/KnightInSilkSong); [wiki: Sprintmaster](https://hollowknight.wiki/w/Sprintmaster) | decompiled |
| Run speed w/ Sprintmaster / +Dashmaster | 10.0 / 11.5 u/s | same | decompiled |
| Walk speed (`WALK_SPEED`, rarely used) | 6.0 u/s | prefab dump | decompiled |
| Jump velocity (`JUMP_SPEED`) | **16.65 u/s**, re-applied every physics step while ascending | prefab dump + `Jump()` in decompiled `HeroController.cs` | decompiled |
| Jump hold (variable height) | vy is pinned at 16.65 for up to **9 steps (0.18 s)** while the button is held (`JUMP_STEPS = 9`); minimum **4 steps (0.08 s)** (`JUMP_STEPS_MIN = 4`). On release after the minimum, **vy is set to 0 instantly** (`JumpReleased()`), then gravity takes over — this is why short hops feel so crisp. | decompiled `HeroController.cs` (`Jump()`, `JumpReleased()`, `CancelJump()`) | decompiled |
| Double jump (`DOUBLE_JUMP_STEPS`, Monarch Wings) | vy = 16.65 × 1.1 = **18.3 u/s**, pinned up to 9 steps | decompiled `DoubleJump()` | decompiled |
| Gravity scale (`DEFAULT_GRAVITY`) | **0.79** (Rigidbody2D gravityScale) | prefab dump; [DebugMod SaveState.cs](https://github.com/TheMulhima/HollowKnight.DebugMod/blob/master/Source/SaveStates/SaveState.cs) (`rb2d.gravityScale = 0.79f`) | decompiled |
| Effective gravity | **≈ 47.4 u/s²** (0.79 × project gravity; project `Physics2D.gravity` is not in any code file — the widely used working figure is −60 u/s². Yields apex ≈ 0.53 s and full-jump height ≈ 5.9 u, both consistent with gameplay.) | derived | **estimated** (the one soft number — tune to taste) |
| Full jump height | ≈ 3.0 u (pinned phase) + ≈ 2.9 u (ballistic) ≈ **5.9 u** | computed from decompiled constants + estimated gravity | derived |
| Min (tap) jump height | ≈ **1.3 u** (4 pinned steps, then vy = 0) | computed | derived |
| Max fall speed (`MAX_FALL_VELOCITY`) | **20 u/s** (hard cap) | prefab dump | decompiled |
| Hard-landing threshold (`BIG_FALL_TIME`) | falling > **1.1 s** triggers hard landing (0.8 s recovery, `HARD_LANDING_TIME`) | prefab dump | decompiled |
| Coyote time (`LEDGE_BUFFER_STEPS`) | **2 steps = 0.04 s** — famously almost none | decompiled `HeroController.cs` (`LEDGE_BUFFER_STEPS = 2`) | decompiled |
| Jump input buffer (`JUMP_QUEUE_STEPS`) | **2 steps = 0.04 s** (double-jump buffer is 10 steps = 0.2 s) | [hk-modding/api patch](https://github.com/hk-modding/api/blob/master/Assembly-CSharp/Patches/HeroController.cs) | decompiled |
| Dash speed (`DASH_SPEED`) | **20 u/s** (28 with Sharp Shadow) | prefab dump; [wiki: Sharp Shadow](https://hollowknight.wiki/w/Sharp_Shadow) | decompiled |
| Dash duration (`DASH_TIME`) | **0.25 s** → dash distance ≈ **5 u**. Vertical velocity locked to 0 during dash. | prefab dump | decompiled |
| Dash cooldown (`DASH_COOLDOWN`) | **0.6 s** (0.4 s with Dashmaster); air dash restored on landing, wall-grab, or pogo | prefab dump; [wiki: Mothwing Cloak](https://hollowknight.wiki/w/Mothwing_Cloak) | decompiled |
| Dash input buffer (`DASH_QUEUE_STEPS`) | 10 steps = 0.2 s | prefab dump | decompiled |
| Wall slide speed (`WALLSLIDE_SPEED`) | **−8 u/s** (constant, no acceleration) | prefab dump | decompiled |
| Wall jump kickoff (`WJ_KICKOFF_SPEED`) | 16 u/s horizontal, locked 5–10 steps (`WJLOCK_STEPS_SHORT/LONG`) | prefab dump | decompiled |

**Feel notes (community consensus):** no horizontal acceleration or friction curves — the Knight moves at exactly 8.3 u/s or 0. Air control is full (same 8.3 u/s in the air). Facing flips instantly.

## 2. Nail combat

| Value | Number | Source | Confidence |
|---|---|---|---|
| Swing duration (`ATTACK_DURATION`) | **0.35 s** (0.28 s with Quick Slash) | prefab dump; [wiki: Quick Slash](https://hollowknight.wiki/w/Quick_Slash) | decompiled |
| Swing cooldown (`ATTACK_COOLDOWN_TIME`) | **0.41 s** start-to-start (0.25 s with Quick Slash). A new swing needs **both** timers expired → effective cadence 0.41 s base, ≈ 0.28 s with Quick Slash (~2.4 → ~3.7 swings/s). Turning around or dashing cancels the duration timer early (~39 % faster max). | prefab dump; wiki: Quick Slash | decompiled |
| Swing startup | Slash hitbox appears near-instantly, ~2–4 frames (~0.03–0.07 s) of anticipation inside the 0.35 s animation | community observation (FSM-driven, not a named constant) | community/estimated |
| Attack input buffer (`ATTACK_QUEUE_STEPS`) | 5 steps = 0.1 s | hk-modding/api patch | decompiled |
| Attack recovery (`ATTACK_RECOVERY_TIME`) | 0.1 s | prefab dump | decompiled |
| Side slash hitbox | polygon ≈ **2.0 u reach × 1.6 u tall** from the Knight's center ("Slash" bbox x −2.04…0.01, y −0.64…0.97; AltSlash reaches ≈ 2.65 u) | collider extracted from Knight prefab bundle | decompiled (geometry approximated by bbox) |
| Up slash hitbox | ≈ **2.4 u wide**, reaches ≈ 2 u above the head (bbox −1.29…1.15 × −0.89…1.46, offset above Knight) | same | decompiled (bbox) |
| Down slash hitbox | ≈ **2.7 u wide**, reaches ≈ 1.7 u below (bbox −1.38…1.28 × −1.65…0.64, offset below Knight) | same | decompiled (bbox) |
| Nail range charms | Longnail +15 %, Mark of Pride +25 %, both +40 % | [wiki: Mark of Pride](https://hollowknight.wiki/w/Mark_of_Pride) | wiki (decompiled-sourced) |
| Nail damage | Old Nail **5** → 9 → 13 → 17 → 21 (Pure Nail) | [wiki: Nail](https://hollowknight.wiki/w/Nail) | wiki |
| Nail hits a wall/enemy sideways | Knight recoils back at `RECOIL_HOR_VELOCITY` = **3.75 u/s** for `RECOIL_HOR_TIME` 0.1 s | prefab dump + decompiled code | decompiled |
| Direction variants | Side/up/down share the same duration & cooldown constants; only the hitbox and recoil direction differ | decompiled code | decompiled |

## 3. Pogo (down-slash bounce)

| Value | Number | Source | Confidence |
|---|---|---|---|
| Bounce velocity (`BOUNCE_VELOCITY`) | **12 u/s**, re-pinned every physics step | prefab dump + decompiled `FixedUpdate` | decompiled |
| Bounce duration (`BOUNCE_TIME`) | **0.25 s**, then vy is set to **0** (same crisp cutoff as jump release) → pogo rise ≈ **3 u** (~half a full jump) | decompiled code (`bounceTimer` block) | decompiled |
| Resets | `Bounce()` sets `doubleJumped = false` and `airDashed = false` — **every pogo refreshes double jump and air dash** | decompiled `Bounce()` | decompiled |
| Interruptible | Jumping/dashing/double-jumping cancels the bounce early | decompiled code | decompiled |
| Timing window feel | Any down-slash that connects while airborne triggers the bounce; with the 0.41 s swing cadence a rhythm of roughly 2 pogos/sec is sustainable. The generous down-slash width (~2.7 u) is what makes pogos forgiving. | derived + community | derived |
| Bouncy-mushroom bounce (`SHROOM_BOUNCE_VELOCITY`) | 25 u/s (not pinned — ballistic) | prefab dump | decompiled |

## 4. Damage / defense

| Value | Number | Source | Confidence |
|---|---|---|---|
| Invulnerability after hit (`INVUL_TIME`) | **1.3 s** (1.75 s with Stalwart Shell) | prefab dump; [wiki: Stalwart Shell](https://hollowknight.wiki/w/Stalwart_Shell) | decompiled |
| Knockback on hit (`RECOIL_VELOCITY`) | velocity = (±**15**, **7.5**) u/s away from the hit | decompiled `StartRecoil()` | decompiled |
| Knockback duration (`RECOIL_DURATION`) | **0.2 s** (0.08 s with Stalwart Shell) | prefab dump; wiki: Stalwart Shell | decompiled |
| Hit-stop (freeze frame) on damage | game freezes ≈ **0.25 s** on taking damage (`DAMAGE_FREEZE_WAIT` 0.25, ramp down 0.001 / up 0.05) | prefab dump | decompiled |
| Focus (heal) channel | **0.891 s per mask**, +0.25 s startup → first mask lands at ≈ **1.141 s**; 33 SOUL per mask; interrupted by any hit (SOUL spent is lost); can't move while focusing | [wiki: Focus](https://hollowknight.wiki/w/Focus) | wiki (decompiled-sourced) |
| Focus w/ Quick Focus | 0.597 s per mask | wiki: Focus | wiki |
| Contact damage (standard early enemies) | 1 mask | wiki enemy pages | wiki |

## 5. Enemy archetypes for the practice game

Nail-hit counts assume the starting **Old Nail (5 dmg)**.

| Enemy | HP (nail hits) | Pattern | Telegraph & rough timing | Source |
|---|---|---|---|---|
| **Crawlid** | 8 (2 hits) | Ground patroller. Walks back and forth, turns at ledges/walls, never targets you. Speed ≈ 2 u/s. | None — it's the tutorial target. | [wiki: Crawlid](https://hollowknight.wiki/w/Crawlid); speed estimated |
| **Vengefly** | 8 (2 hits) | Flyer. Hovers/bobs in a small area; when you enter range it **squawks, then homes straight at you** (≈ 3.5–4 u/s); gives up after 10 s of chasing. | Squawk + rear-back ≈ 0.4–0.6 s before the charge. | [wiki: Vengefly](https://hollowknight.wiki/w/Vengefly) (chase time 10 s is wiki; speeds estimated) |
| **Aspid Hunter** | 15 (3 hits) | Ranged flyer. Keeps its distance, then spits a **fan of 3 projectiles** (spread ≈ 30–40°, projectile speed ≈ 8–10 u/s). Vulnerable window right after spitting. | Rears back / opens mouth ≈ 0.5 s before firing; volley roughly every 2–3 s. | [wiki: Aspid Hunter](https://hollowknight.wiki/w/Aspid_Hunter) (HP + "window after it spits" are wiki; counts/speeds community-known + estimated) |
| **Mantis Warrior** | 20 (4 hits) | Duelist. Quick **lunge-dash slash** with long reach (lunge ≈ 4 u at ≈ 15 u/s, ≈ 0.3 s); short-range **upward slash** anti-air; leaps between perches. Weak to pogo from above. | Brief crouch/stance shift ≈ 0.3–0.4 s before the lunge. | [wiki: Mantis Warrior](https://hollowknight.wiki/w/Mantis_Warrior) (HP + patterns wiki; timings estimated) |

All four deal **1 mask** per hit (contact or projectile) — standard for non-boss enemies.

## 6. Unit context (scaling to canvas)

| Value | Number | Source | Confidence |
|---|---|---|---|
| Knight hurtbox (`HeroBox`) | **0.455 u wide × 1.17 u tall** | BoxCollider2D extracted from Knight prefab bundle | decompiled |
| Knight visual height | ≈ **1.2–1.3 u** (sprite slightly larger than hurtbox) | derived from collider + sprite | derived |
| Camera view | half-width clamp **14.6 u**, half-height clamp **8.3 u** → visible world ≈ **29.2 × 16.6 u** (16:9) | decompiled `CameraController.cs` scene-edge clamps ([mirror](https://github.com/jcx515250418qq/Silksong_HealthBar), Team Cherry camera code; same constants pattern as HK1) | decompiled (mirrored from the Silksong port — treat as ≈) |
| Screen proportion | the Knight is ≈ 7 % of screen height; a full jump covers ≈ ⅓ of screen height; a dash ≈ ⅙ of screen width | derived | derived |
| Physics tick | 50 Hz `FixedUpdate` (0.02 s steps) | Unity default; step-counting code confirms | decompiled |

---

## Recommended starting values — 60 fps canvas clone, Knight ≈ 48 px tall

Scale: Knight ≈ 1.2 u tall → **1 unit = 40 px**. For authentic framing the camera should show ≈ 29.2 × 16.6 u → a **1168 × 664** logical canvas (or show less of the world on a smaller canvas — for a trainer, tighter framing is fine).

```js
const UNIT = 40;            // px per Hollow Knight world unit
const PHYS = {
  // movement
  runSpeed:        332,     // 8.3 u/s — instant accel/decel, full air control
  jumpVelocity:    666,     // 16.65 u/s, PINNED while held (see jumpHold)
  jumpHoldMax:     0.18,    // s — hold vy at jumpVelocity up to this long
  jumpHoldMin:     0.08,    // s — always pin at least this long
  jumpCutoff:      true,    // on release after min hold: vy = 0 instantly
  doubleJumpVelocity: 733,  // 18.3 u/s, same pin behavior (~0.18 s)
  gravity:         1900,    // ≈ 47.4 u/s² — THE tuning knob; try 1700–2100
  maxFallSpeed:    800,     // 20 u/s hard cap
  coyoteTime:      0.04,    // s (HK has almost none; 0.06–0.08 is kinder for a trainer)
  jumpBuffer:      0.05,    // s (HK: 0.04)
  // dash
  dashSpeed:       800,     // 20 u/s
  dashDuration:    0.25,    // s → 200 px dash; vy locked to 0 during dash
  dashCooldown:    0.6,     // s; air dash restored on landing or pogo
  // nail
  nailCadence:     0.41,    // s between swing starts (0.28 with "Quick Slash" powerup)
  nailSwingTime:   0.35,    // s animation (0.28 w/ Quick Slash)
  nailStartup:     0.05,    // s before hitbox is active
  nailReachSide:   80,      // px from center (~2 u), hitbox ~80×64 px
  nailReachUp:     80,      // px above head, ~96 px wide
  nailReachDown:   70,      // px below feet, ~108 px wide (generous = forgiving pogos)
  nailDamage:      5,       // Old Nail
  attackBuffer:    0.10,    // s input buffer
  // pogo
  pogoVelocity:    480,     // 12 u/s, PINNED for pogoTime then vy = 0
  pogoTime:        0.25,    // s → 120 px rise (~half a jump)
  pogoResets:      ['doubleJump', 'dash'],
  // damage/defense
  iFrames:         1.3,     // s invulnerability after a hit
  knockback:       { x: 600, y: 300 },  // px/s away from hit, for 0.2 s
  knockbackTime:   0.2,
  hitFreeze:       0.15,    // s hit-stop (HK ≈ 0.25 s; shorter feels better at 60 fps)
  focusTime:       0.9,     // s channel per heal, +0.25 s startup, interrupted by damage
};
// enemies (speeds in px/s)
const ENEMIES = {
  crawlid:  { hp: 2, speed: 80,  damage: 1 },                                // HP in nail hits
  vengefly: { hp: 2, speed: 150, damage: 1, telegraph: 0.5, chaseTimeout: 10 },
  aspid:    { hp: 3, damage: 1, telegraph: 0.5, volleyEvery: 2.5,
              shots: 3, spreadDeg: 35, projSpeed: 340 },
  mantis:   { hp: 4, damage: 1, telegraph: 0.35, lungeSpeed: 600, lungeTime: 0.3 },
};
```

Implementation notes for the feel:
1. **No acceleration curves.** Set horizontal velocity directly to ±runSpeed or 0. This is the single biggest "HK feel" factor.
2. **Pin, don't impulse, the jump.** Hold vy at `jumpVelocity` while the button is held (up to `jumpHoldMax`), then let gravity act; zero vy on release. Don't use a one-shot impulse with low gravity — it will feel floaty.
3. **Pogo is a pinned 0.25 s ascent, then vy = 0** — not a bouncy impulse. Refresh dash + double jump on every successful pogo.
4. Gravity is the only estimated core value (≈ 1900 px/s² at this scale). If jumps feel wrong, adjust gravity first — everything else above is exact.

## Source index

- KnightInSilkSong (decompiled HK HeroController + Knight prefab bundle): https://github.com/MCXGK3/KnightInSilkSong
- hk-modding API HeroController patch (queue/buffer constants): https://github.com/hk-modding/api/blob/master/Assembly-CSharp/Patches/HeroController.cs
- DebugMod (gravityScale 0.79): https://github.com/TheMulhima/HollowKnight.DebugMod/blob/master/Source/SaveStates/SaveState.cs
- Team Cherry CameraController mirror (camera clamps 14.6 / 8.3): https://github.com/jcx515250418qq/Silksong_HealthBar
- Hollow Knight Wiki: [Sprintmaster](https://hollowknight.wiki/w/Sprintmaster) · [Sharp Shadow](https://hollowknight.wiki/w/Sharp_Shadow) · [Mothwing Cloak](https://hollowknight.wiki/w/Mothwing_Cloak) · [Quick Slash](https://hollowknight.wiki/w/Quick_Slash) · [Stalwart Shell](https://hollowknight.wiki/w/Stalwart_Shell) · [Focus](https://hollowknight.wiki/w/Focus) · [Nail](https://hollowknight.wiki/w/Nail) · [Mark of Pride](https://hollowknight.wiki/w/Mark_of_Pride) · [Crawlid](https://hollowknight.wiki/w/Crawlid) · [Vengefly](https://hollowknight.wiki/w/Vengefly) · [Aspid Hunter](https://hollowknight.wiki/w/Aspid_Hunter) · [Mantis Warrior](https://hollowknight.wiki/w/Mantis_Warrior)
