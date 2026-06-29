import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import AppFullMigration from './AppFullMigration.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppFullMigration />
  </StrictMode>,
)
