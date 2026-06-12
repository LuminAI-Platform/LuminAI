import React from 'react'
import ReactDOM from 'react-dom/client'
import { getAppTitle } from './appText.js'

function App() {
  return <div>{getAppTitle()}</div>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
