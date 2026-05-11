import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <SubscriptionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SubscriptionProvider>
    </AuthProvider>
  </StrictMode>,
)
