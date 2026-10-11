import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Settings } from './types'
import { DEFAULT_SETTINGS } from './types'
import { loadSettings, saveSettings } from './storage'

interface Ctx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, update: () => {} })

export const useSettings = () => useContext(SettingsContext)

const TITLE_BAR = {
  light: { color: '#e9e7e2', symbolColor: '#3a3d42' },
  dark: { color: '#141518', symbolColor: '#c9ccd2' },
}

function useSystemDark() {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const ref = useRef<Settings>(DEFAULT_SETTINGS)
  const systemDark = useSystemDark()

  useEffect(() => {
    loadSettings().then((s) => {
      const merged = { ...DEFAULT_SETTINGS, ...(s ?? {}) }
      ref.current = merged
      setSettings(merged)
    })
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    const next = { ...ref.current, ...patch }
    ref.current = next
    setSettings(next)
    void saveSettings(next)
  }, [])

  const theme = settings?.theme === 'system' || !settings ? (systemDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    if (settings) root.style.setProperty('--accent', settings.accent)
    window.trazo?.setTitleBar(TITLE_BAR[theme])
  }, [theme, settings])

  if (!settings) return null
  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>
}
