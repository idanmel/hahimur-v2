import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'
import App from './App.tsx'
import ResultsPage from './pages/results/ResultsPage.tsx'
import * as results from './results.ts'
import FormsPage from './pages/forms/FormsPage.tsx'
import HomePage from './pages/home/HomePage.tsx'

const { pathname } = window.location

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {pathname === '/results' ? <ResultsPage results={results} /> :
     pathname === '/forms' ? <FormsPage /> :
     pathname === '/form' ? <App /> :
     <HomePage />}
  </StrictMode>,
)
