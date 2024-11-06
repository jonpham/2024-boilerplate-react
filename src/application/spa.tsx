import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from '../pages/Root';
import './style/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
