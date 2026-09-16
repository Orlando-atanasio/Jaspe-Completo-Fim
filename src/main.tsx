import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// BUGFIX: initNativeShell (splash/status-bar/back-button) foi movido para
// dentro de App.tsx (useEffect). Chamá-lo aqui, fora da árvore React e sem
// passar onBack, fazia o botão "Voltar" do Android sempre minimizar o app
// inteiro — nunca fechava drawer/editor/modais abertos. Ver App.tsx.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
