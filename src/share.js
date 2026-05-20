// 共有URL用のユーティリティ。販売受注簿・売上伝票発行依頼書の両方で使用。

export function encodePayload(payload) {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodePayload(value) {
  if (!value) return null
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

export async function shortenUrl(longUrl) {
  try {
    const r = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`)
    if (r.ok) {
      const t = (await r.text()).trim()
      if (/^https?:\/\//.test(t)) return t
    }
  } catch {}
  try {
    const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`)
    if (r.ok) {
      const t = (await r.text()).trim()
      if (/^https?:\/\//.test(t)) return t
    }
  } catch {}
  return longUrl
}

export function readPayloadFromHash(routeName) {
  const hash = location.hash || ''
  if (routeName && !new RegExp(`#/?${routeName}`).test(hash)) return ''
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return ''
  return new URLSearchParams(hash.slice(qIndex + 1)).get('payload') || ''
}

export async function writeClipboard(text) {
  try {
    await navigator.clipboard?.writeText(text)
    return true
  } catch {
    return false
  }
}
