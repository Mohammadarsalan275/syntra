/*import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App/index.css'
import App from './App/App.jsx'
  import {store} from './App/app.store.jsx'
  //import {Provider} from 'react-redux'
  import { Provider } from 'react-redux';

createRoot(document.getElementById('root')).render(
  
    <Provider store={store}>
    <App />
    </Provider>

  
)
*/


import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './App/index.css';
import App from './App/App.jsx';
import { store } from './App/app.store.jsx';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>
);

