// Клієнт REST API сервера ARGUS. Токен береться зі сховища стану через getToken.
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let tokenGetter = () => null;
let unauthorizedHandler = () => {};
export const configureApi = ({ getToken, onUnauthorized }) => {
  tokenGetter = getToken;
  unauthorizedHandler = onUnauthorized ?? (() => {});
};

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', 'Немає зв’язку із сервером');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* порожня відповідь */
  }
  if (!res.ok) {
    if (res.status === 401 && token) unauthorizedHandler();
    throw new ApiError(res.status, data?.error ?? 'http', data?.message ?? `Помилка сервера (${res.status})`);
  }
  return data;
}

export const api = {
  officers: () => request('GET', '/api/officers'),
  login: (officerId) => request('POST', '/api/login', { officerId }),
  tracks: () => request('GET', '/api/tracks'),
  events: () => request('GET', '/api/events'),
  sources: () => request('GET', '/api/sources'),
  zones: () => request('GET', '/api/zones'),
  shift: () => request('GET', '/api/shift'),
  resolveEvent: (id, action, comment) => request('POST', `/api/events/${id}/${action}`, { comment }),
  handover: (notes) => request('POST', '/api/shift/handover', { notes }),
  accept: (reportId, reviewedEventIds) => request('POST', '/api/shift/accept', { reportId, reviewedEventIds }),
  setChaos: (mode) => request('POST', '/api/_chaos', { mode }),
};
