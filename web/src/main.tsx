import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// The base stylesheet must load before App: the feature sheets under
// styles/ (gates, levels, arena, map states, settings) are imported by the
// components and override base rules at equal specificity, which only works
// if they come later in the cascade.
import './styles.css';
import { App } from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('index.html is missing the #root element');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
