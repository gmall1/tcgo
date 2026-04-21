import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { registerSavedMechanics } from '@/lib/mechanicLibrary'

// Restore any mechanics the user saved in the Mechanic Studio so they are
// active as soon as the app boots.
try {
  registerSavedMechanics()
} catch (err) {
  console.warn('Failed to register saved mechanics', err)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
