import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ThermalSettingsEnhancer from './components/ThermalSettingsEnhancer.jsx';
import SimpleStampSettingsEnhancer from './components/SimpleStampSettingsEnhancer.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { ConfirmProvider } from './context/ConfirmContext.jsx';
import ToastContainer from './components/Toast.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <ConfirmProvider>
            <App />
            <ThermalSettingsEnhancer />
            <SimpleStampSettingsEnhancer />
            <ToastContainer />
          </ConfirmProvider>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>
);
