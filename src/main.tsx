import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import './styles/global.css'
import { StrictMode, Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// Theme init БЕЗ localStorage в main.tsx — чтобы сайт не падал при блокировке
// хранилища. Тема применится позже внутри React (ThemeToggle при mount).
document.documentElement.setAttribute('data-theme', 'light')

// Глобальный Error Boundary — если что-то крашит React дерево, покажем
// сообщение вместо пустого экрана.
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] React crashed:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24, fontFamily: 'system-ui, sans-serif',
          color: '#c00', background: '#fff', minHeight: '100vh'
        }}>
          <h2>Приложение не смогло запуститься</h2>
          <p><strong>Ошибка:</strong> {this.state.error.message}</p>
          <details>
            <summary>Детали</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {this.state.error.stack}
            </pre>
          </details>
          <p style={{ marginTop: 16 }}>
            Попробуй очистить данные сайта (DevTools → Application → Clear storage)
            и перезагрузить страницу.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
)
