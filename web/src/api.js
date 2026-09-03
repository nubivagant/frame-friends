async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let body = {};
    try {
      body = await res.json();
    } catch (e) {
      /* ignore */
    }
    const err = new Error(body.error || `request_failed_${res.status}`);
    err.status = res.status;
    err.code = body.error;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me: () => request("/auth/me"),
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  requestLink: (email) => request("/auth/request-link", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request("/auth/reset", { method: "POST", body: JSON.stringify({ token, password }) }),

  state: () => request("/state"),
  archive: () => request("/archive"),
  submit: (formData) => request("/submissions", { method: "POST", body: formData }),
  rate: (scores, note) => request("/ratings", { method: "POST", body: JSON.stringify({ scores, note }) }),
  reroll: () => request("/brief/reroll", { method: "POST" }),
  updateSettings: (data) => request("/settings", { method: "PATCH", body: JSON.stringify(data) }),
  updateMe: (data) => request("/players/me", { method: "PATCH", body: JSON.stringify(data) }),

  nudge: () => request("/nudge", { method: "POST" }),
  forfeit: (matchId) => request(`/matches/${matchId}/forfeit`, { method: "POST" }),
  joinMatch: (matchId) => request(`/matches/${matchId}/join`, { method: "POST" }),
  getVapidKey: () => request("/push/vapid-public-key"),
  subscribePush: (subscription) => request("/push/subscribe", { method: "POST", body: JSON.stringify(subscription) }),
  unsubscribePush: (endpoint) => request("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) }),
};
