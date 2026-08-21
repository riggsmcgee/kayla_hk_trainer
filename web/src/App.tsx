// HashRouter on purpose: GitHub Pages has no SPA fallback, so path-based
// routing would 404 on refresh/deep links. Hash routes always resolve.
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import { Home } from './pages/Home';
import { Lessons } from './pages/Lessons';
import { LessonPogo } from './pages/LessonPogo';
import { LessonReadingEnemies } from './pages/LessonReadingEnemies';
import { LessonSetup } from './pages/LessonSetup';
import { PracticePogo } from './pages/PracticePogo';
import { PracticeDodge } from './pages/PracticeDodge';

export function App() {
  return (
    <HashRouter>
      <div className="shell">
        <header className="site-header">
          <NavLink to="/" className="site-title">
            Kayla&apos;s Hollow Knight Dojo
          </NavLink>
          <nav className="site-nav" aria-label="Main">
            <NavLink to="/lessons">Lessons</NavLink>
            <NavLink to="/practice/pogo">Pogo Course</NavLink>
            <NavLink to="/practice/dodge">Dodge Arena</NavLink>
          </nav>
        </header>
        <main className="site-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/lessons" element={<Lessons />} />
            <Route path="/lessons/pogo" element={<LessonPogo />} />
            <Route path="/lessons/reading-enemies" element={<LessonReadingEnemies />} />
            <Route path="/lessons/setup" element={<LessonSetup />} />
            <Route path="/practice/pogo" element={<PracticePogo />} />
            <Route path="/practice/dodge" element={<PracticeDodge />} />
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
