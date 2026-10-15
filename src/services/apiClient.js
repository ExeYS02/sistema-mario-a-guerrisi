export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

export async function apiFetchAuth(path, clienteId, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Cliente-Id': clienteId,
    ...(options.headers || {})
  };
  return apiFetch(path, { ...options, headers });
}