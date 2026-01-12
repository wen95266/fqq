import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

let rootElement = document.getElementById('root');

// Fallback: Create root element if it doesn't exist to prevent crash
if (!rootElement) {
  console.warn("Root element 'root' not found in DOM. Creating it dynamically.");
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
