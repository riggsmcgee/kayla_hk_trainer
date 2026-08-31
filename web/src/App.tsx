// HashRouter on purpose: GitHub Pages has no SPA fallback, so path-based
// routing would 404 on refresh/deep links. Hash routes always resolve.
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import { SETUP_FLOOR_ROUTE, chapterById } from './chapters';
import { MAIN_ID } from './components/focus';
import { DevUnlock } from './components/DevUnlock';
import { ScrollToTop } from './components/ScrollToTop';
import { siteChromeCopy } from './copy/nav';
import { Home } from './pages/Home';
import { LessonPogo } from './pages/LessonPogo';
import { LessonReadingEnemies } from './pages/LessonReadingEnemies';
import { LessonSetup } from './pages/LessonSetup';
import { SetupFloor } from './pages/SetupFloor';
import { PlayPogo } from './pages/PlayPogo';
import { PlayDodge } from './pages/PlayDodge';
import { PlayWell } from './pages/PlayWell';
import { Settings } from './pages/Settings';
import { TheEnd } from './pages/TheEnd';

export function App() {
  return (
    <HashRouter>
      {/* Above .shell so its layout effect commits before the page's own —
          notably PracticeCanvas, which then takes the focus back on a
          mini-game page. That ordering is deliberate; see ScrollToTop. */}
      <ScrollToTop />
      {/* Listens on the window for the ten keys that open the dev drawer, and
          says so when they land. Outside .shell because it is fixed to the
          viewport and belongs to no page — the sequence works on all of them. */}
      <DevUnlock />
      <div className="shell">
        <header className="site-header">
          <NavLink to="/" className="site-title">
            {siteChromeCopy.title}
          </NavLink>
          <nav className="site-nav" aria-label={siteChromeCopy.navLabel}>
            <NavLink to="/" end>
              {siteChromeCopy.navMap}
            </NavLink>
            <NavLink to={chapterById('pogo-course').route}>{siteChromeCopy.navPogoCourse}</NavLink>
            <NavLink to={chapterById('dodge-arena').route}>{siteChromeCopy.navDodgeArena}</NavLink>
            <NavLink to="/settings">{siteChromeCopy.navSettings}</NavLink>
          </nav>
        </header>
        <main className="site-main" id={MAIN_ID} tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path={chapterById('setup').route} element={<LessonSetup />} />
            {/* Chapter 1's proof, and not a stop of its own — see SETUP_FLOOR_ROUTE. */}
            <Route path={SETUP_FLOOR_ROUTE} element={<SetupFloor />} />
            <Route path={chapterById('pogo').route} element={<LessonPogo />} />
            <Route path={chapterById('reading-enemies').route} element={<LessonReadingEnemies />} />
            <Route path={chapterById('pogo-course').route} element={<PlayPogo />} />
            <Route path={chapterById('dodge-arena').route} element={<PlayDodge />} />
            <Route path={chapterById('finale').route} element={<PlayWell />} />
            <Route path="/settings" element={<Settings />} />
            {/* NOT a stop on the road, so deliberately not in chapters.ts: she
                arrives here from the celebration, not from the map. */}
            <Route path="/the-end" element={<TheEnd />} />
            {/* Old addresses keep working (playtest 1: the lessons index was
                redundant with the map; "practice" became "mini-games"). */}
            <Route path="/lessons" element={<Navigate to="/" replace />} />
            <Route path="/practice/pogo" element={<Navigate to="/play/pogo" replace />} />
            <Route path="/practice/dodge" element={<Navigate to="/play/dodge" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="site-footer">
          <p>{siteChromeCopy.footer}</p>
        </footer>
      </div>
    </HashRouter>
  );
}
