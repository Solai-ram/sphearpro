import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './auth/AuthContext';
import { SubscriptionAccessProvider } from './auth/SubscriptionAccess';
import { IdleSessionBar } from './auth/IdleSessionBar';
import { ThemeProvider } from './theme/ThemeProvider';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionAccessProvider>
              <ThemeProvider>
                <App />
                <IdleSessionBar />
              </ThemeProvider>
            </SubscriptionAccessProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);