// HashRouter on purpose: GitHub Pages has no SPA fallback, so path-based
// routing would 404 on refresh/deep links. Hash routes always resolve.
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import { Home } from './pages/Home';
import { LessonPogo } from './pages/LessonPogo';
import { LessonReadingEnemies } from './pages/LessonReadingEnemies';
import { LessonSetup } from './pages/LessonSetup';
import { PlayPogo } from './pages/PlayPogo';
import { PlayDodge } from './pages/PlayDodge';

export function App() {
  return (
    <HashRouter>
      <div className="shell">
        <header className="site-header">
          <NavLink to="/" className="site-title">
            Kayla&apos;s Hollow Knight Dojo
          </NavLink>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/" end>
              Map
            </NavLink>
            <NavLink to="/play/pogo">Pogo Course</NavLink>
            <NavLink to="/play/dodge">Dodge Arena</NavLink>
          </nav>
        </header>
        <main className="site-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lessons/setup" element={<LessonSetup />} />
            <Route path="/lessons/pogo" element={<LessonPogo />} />
            <Route path="/lessons/reading-enemies" element={<LessonReadingEnemies />} />
            <Route path="/play/pogo" element={<PlayPogo />} />
            <Route path="/play/dodge" element={<PlayDodge />} />
            {/* Old addresses keep working (playtest 1: the lessons index was
                redundant with the map; "practice" became "mini-games"). */}
            <Route path="/lessons" element={<Navigate to="/" replace />} />
            <Route path="/practice/pogo" element={<Navigate to="/play/pogo" replace />} />
            <Route path="/practice/dodge" element={<Navigate to="/play/dodge" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer className="site-footer">
          <p>Built for Kbug. Hit them more than they hit you and you beat the game.</p>
        </footer>
      </div>
    </HashRouter>
  );
}
