import { useEffect, useState } from 'react'
import { getSignedMediaUrl } from '../lib/chantierMedia.js'

function MediaAttachment({ attachment, localPreview, isMe }) {
  const [url, setUrl] = useState(localPreview || null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (localPreview) {
      setUrl(localPreview)
      return undefined
    }
    if (!attachment?.path) return undefined
    let cancelled = false
    getSignedMediaUrl(attachment.path)
      .then((u) => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setErr(true) })
    return () => { cancelled = true }
  }, [attachment?.path, localPreview])

  const mime = attachment?.mime || ''
  const name = attachment?.name || 'Fichier'
  const linkColor = isMe ? '#fff' : 'var(--blue)'

  if (err) {
    return <span style={{ fontSize: 12, opacity: 0.85 }}>📎 {name} (indisponible)</span>
  }

  if (!url) {
    return <span style={{ fontSize: 12, opacity: 0.7 }}>Chargement…</span>
  }

  if (mime.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
        <img
          src={url}
          alt={name}
          style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block' }}
          loading="lazy"
        />
      </a>
    )
  }

  if (mime.startsWith('video/')) {
    return (
      <video
        src={url}
        controls
        playsInline
        style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block' }}
      />
    )
  }

  if (mime === 'application/pdf') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: linkColor, fontSize: 13, fontWeight: 600 }}>
        📄 {name}
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download={name} style={{ color: linkColor, fontSize: 13 }}>
      📎 {name}
    </a>
  )
}

export default function ChatMessageBody({ message, isMe }) {
  const { type, txt, attachments, localPreview } = message
  const hasMedia = type && type !== 'text' && (
    (Array.isArray(attachments) && attachments.length > 0) || localPreview
  )

  if (!hasMedia) return txt

  const atts = Array.isArray(attachments) && attachments.length
    ? attachments
    : [{ name: txt || 'Pièce jointe', mime: type === 'pdf' ? 'application/pdf' : `${type}/` }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {atts.map((a, i) => (
        <MediaAttachment
          key={a.path || i}
          attachment={a}
          localPreview={i === 0 ? localPreview : null}
          isMe={isMe}
        />
      ))}
      {txt && type !== 'pdf' && txt !== atts[0]?.name && (
        <span style={{ fontSize: 13 }}>{txt}</span>
      )}
    </div>
  )
}
