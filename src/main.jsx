import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root.jsx'
import { initCapacitor } from './lib/capacitorInit.js'

initCapacitor().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <Root />
    </React.StrictMode>,
  )
})
