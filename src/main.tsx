import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'
import App from './App.tsx'
import ResultsLoader from './ResultsLoader.tsx'
import AllPredictionsPage from './AllPredictionsPage.tsx'

const { pathname } = window.location

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pathname === '/results' ? <ResultsLoader /> :
     pathname === '/forms' ? <AllPredictionsPage /> :
     <App />}
  </StrictMode>,
)
