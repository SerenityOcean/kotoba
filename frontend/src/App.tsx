import { useEffect, useState } from 'react'

export default function App() {
  const [message, setMessage] = useState('加载中…')

  useEffect(() => {
    fetch('/api/ping')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('后端连不上'))
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>kotoba</h1>
      <p>{message}</p>
    </div>
  )
}