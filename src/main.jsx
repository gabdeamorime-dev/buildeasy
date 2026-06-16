import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initCapacitor } from './lib/capacitorInit.js'

initCapacitor().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
