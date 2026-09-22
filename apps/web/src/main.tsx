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

// Prevent mouse wheel from incrementing/decrementing number inputs globally
document.addEventListener(
  'wheel',
  (event) => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.type === 'number') {
      active.blur();
    }
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'number') {
      target.blur();
      event.preventDefault();
      let parent: HTMLElement | null = target.parentElement;
      let scrolled = false;
      while (parent && parent !== document.body) {
        const style = window.getComputedStyle(parent);
        const overflowY = style.overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          parent.scrollHeight > parent.clientHeight
        ) {
          parent.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: 'auto' });
          scrolled = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!scrolled) {
        window.scrollBy({ top: event.deltaY, left: event.deltaX, behavior: 'auto' });
      }
    }
  },
  { passive: false }
);

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