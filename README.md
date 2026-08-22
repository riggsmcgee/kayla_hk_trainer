# Kayla's Hollow Knight Dojo

A training website for Kayla (hi, Kbug!) with a scaled-down, browser-based
Hollow Knight game. Hollow Knight is the first genuinely hard game she's
played, so this dojo focuses on the fundamentals that carry the whole game:
pogo bouncing, reading enemies before fighting them, and sticking with one
controller until it's muscle memory. The home page is a map of her own little
Hallownest — one road of six stops, in order: Your Setup, the Pogo lesson, the
Pogo Course, Reading Enemies, the Dodge Arena, and The Bottom of the Well at the
end — each lighting up as she clears it, never locking her out. A Settings page
holds the keyboard remap and comfort toggles. Hit them more than they hit you
and you beat the game.

## Quickstart

```sh
npm install
npm run dev          # start the website (this is all you need)
npm run dev:server   # optional: start the practice API too
```

`npm run dev:server` is optional because the server is optional — see below.

## The backend is disposable

The Express + SQLite server in `server/` exists purely as a backend practice
project. **The website works 100% without it.** All of Kayla's data (settings,
practice runs) lives in versioned JSON in `localStorage`, in her browser, and
nowhere else. When the server is running, the site mirrors runs to it as an
optional extra; when it isn't, the sync layer silently does nothing. One day
the server will be shut down permanently and kept only as a learning artifact
— and the site won't notice.

Consequence: nothing in `web/` imports from `server/`, ever.

## Monorepo map

| Path      | Package        | What it is                                              |
| --------- | -------------- | ------------------------------------------------------- |
| `web/`    | `@dojo/web`    | The site: Vite + React + TypeScript, canvas game engine |
| `server/` | `@dojo/server` | Disposable practice API: Express + better-sqlite3       |
| `shared/` | `@dojo/shared` | Types shared by both (types only, no runtime code)      |

## Where to read more

- [`PLAN.md`](PLAN.md) — the project plan and what's coming next
- [`docs/feedback/`](docs/feedback/) — Kayla's cousin's playtest notes and what they changed
- [`docs/research/`](docs/research/) — Hollow Knight frame data and physics
  research the engine constants are anchored to
- [`docs/skills-log.md`](docs/skills-log.md) — log of agent skills used while
  building this
