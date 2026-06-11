import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api';
import { store } from './store';
import { WebSocketProvider } from './components/websocket-provider';
import App from './app.tsx';

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
