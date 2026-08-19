import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import './styles/index.css'

const rootElement = document.getElementById('root')
if (rootElement === null) {
  throw new Error('Root element #root is missing')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
