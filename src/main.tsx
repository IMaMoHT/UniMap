import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'
import './index.css'

import MainPage from './Pages/MainPage/MainPage.tsx'

const ErrorFallback = () => (
  <div style={{ padding: '40px', color: '#ff4d4f', textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h2>Ой, щось пішло не так! 🗺️</h2>
    <p>Не вдалося завантажити мапу університету.</p>
    <button 
      onClick={() => window.location.reload()}
      style={{ 
        padding: '10px 20px', 
        marginTop: '15px', 
        cursor: 'pointer', 
        border: 'none', 
        borderRadius: '5px', 
        backgroundColor: '#007bff', 
        color: 'white',
        fontSize: '16px'
      }}
    >
      Оновити сторінку
    </button>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <MainPage/>
    </ErrorBoundary>
  </StrictMode>,
)