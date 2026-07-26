import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './styles/tokens.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter: GitHub Pages has no SPA rewrite, so deep links and refreshes
        would 404 under BrowserRouter. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
