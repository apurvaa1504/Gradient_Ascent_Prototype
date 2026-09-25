import { StrictMode } from "react";
import { setupErrorLogger } from "./error-logger";
setupErrorLogger();
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import OtecApp from './features/otec/OtecApp.jsx'
import TchpPage from './TchpPage.jsx'
import ThemeToggle from './ThemeToggle.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/tchp" element={<TchpPage />} />
        <Route path="/tchp-intelligence" element={<TchpPage />} />
        <Route path="/otec" element={<OtecApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
