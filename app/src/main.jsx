import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/scene.css';
import './styles/header.css';
import './styles/hero.css';
import './styles/pairs.css';
import './styles/finale.css';
import './styles/landing.css';

/* No StrictMode on purpose: its double mount would build the WebGL world twice in development. */
createRoot(document.getElementById('root')).render(<App />);
