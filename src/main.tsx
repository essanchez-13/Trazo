import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles.css'
import './styles-tabs.css'
import './styles-covers.css'
import { App } from './App'
import { SettingsProvider } from './settings'

if (window.trazo) document.documentElement.classList.add('desktop')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
)
