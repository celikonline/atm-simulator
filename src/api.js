// Host simülatörüne (Python / Flask) istek atan ince istemci.
// Sunucu iş kuralı hatalarında da JSON döner; yalnızca ağ hatasında throw edilir.
export async function api(path, body = {}, token) {
  const res = await fetch(path, {
    method: body === null ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === null ? undefined : JSON.stringify({ terminal: 'ATM00684', ...body }),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Host yanıtı okunamadı (HTTP ${res.status})`)
  }
}

export const money = (n) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
