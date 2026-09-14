// api.js — talks to the LUHID backend now hosted on Render.com.
//
// Since the frontend (e.g. GitHub Pages) and backend (Render) are on
// different domains, we call a full URL instead of a relative "/api" path.
// Replace API_BASE below with your actual Render service URL.

const API_BASE = 'https://pashu-swasthya.onrender.com/api';

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

const Api = {
  createAnimal: (payload) => apiRequest('/animals', { method: 'POST', body: JSON.stringify(payload) }),
  getAnimal: (tagCode, role) => apiRequest(`/animals/${encodeURIComponent(tagCode)}?role=${role}`),
  addLog: (tagCode, payload) => apiRequest(`/animals/${encodeURIComponent(tagCode)}/logs`, { method: 'POST', body: JSON.stringify(payload) }),
  triage: (payload) => apiRequest('/triage', { method: 'POST', body: JSON.stringify(payload) }),
  rescueAlert: (tagCode, payload) => apiRequest(`/animals/${encodeURIComponent(tagCode)}/rescue`, { method: 'POST', body: JSON.stringify(payload) })
};
