import React from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import { queryClient } from './api';
import App from './app.tsx';
import { WebSocketProvider } from './components/websocket-provider';
import { store } from './store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
);
