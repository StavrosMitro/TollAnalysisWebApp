import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import './styles/tokens.css';
import './styles/global.css';
import './components/ui/ui.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
