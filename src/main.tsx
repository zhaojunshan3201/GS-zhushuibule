import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AetheraLandingPage from './components/AetheraLandingPage.tsx';
import {isAetheraLandingLocation} from './shared/aetheraLanding.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAetheraLandingLocation(window.location.pathname, window.location.search) ? <AetheraLandingPage /> : <App />}
  </StrictMode>,
);
