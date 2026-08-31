/**
 * Send every navigation to the top of the page (playtest 3, note 8: following
 * a link left her halfway down the new page, because the browser keeps the
 * scroll position across a client-side route change).
 *
 * react-router's <ScrollRestoration /> is NOT an option here: App.tsx uses
 * the declarative <HashRouter> + <Routes>, and in react-router 8 that hook
 * opens with an invariant on the data-router context, so it throws. This is
 * the four-line version of the same idea.
 */
import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { MAIN_ID } from './focus';

export function ScrollToTop(): null {
  // pathname, not the whole location: `key` changes on a replace, and App.tsx
  // has three <Navigate replace> redirects that would otherwise count twice.
  const { pathname } = useLocation();
  const firstRender = useRef(true);

  useLayoutEffect(() => {
    // The page scrolls on the window — .shell is min-height:100vh with no
    // overflow container — so this is the right element. Never 'smooth':
    // an animated scroll on arrival reads as the page still loading.
    window.scrollTo(0, 0);

    // Focus moves on a navigation only. A fresh deep-link or a reload should
    // leave focus at the document start, where a screen reader expects it.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    document.getElementById(MAIN_ID)?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
