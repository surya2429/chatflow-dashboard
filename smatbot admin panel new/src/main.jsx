import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AdminConsole from './pages/AdminConsole'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminConsole />
  </StrictMode>
)
