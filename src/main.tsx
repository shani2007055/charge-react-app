import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom' // ייבוא ספרית הניתוב
import { Provider } from 'react-redux' // <-- 1. ייבוא ה-Provider של Redux
import { store } from './store/store' // <-- 2. ייבוא הסטור המרכזי שיצרנו
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 3. עטיפת האפליקציה ב-Provider וחיבור ל-store */}
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)