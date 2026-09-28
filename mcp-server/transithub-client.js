const DEFAULT_BASE_URL = "https://api.transithub.io";

class TransitHubError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "TransitHubError";
    this.status = status;
    this.body = body;
  }
}

function getConfig() {
  const apiKey = process.env.TRANSITHUB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "TRANSITHUB_API_KEY is not set. Export it before starting Claude Code, e.g. `export TRANSITHUB_API_KEY=pk_live_...`."
    );
  }
  const baseUrl = (process.env.TRANSITHUB_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function request(method, path, { query, body, language } = {}) {
  const { apiKey, baseUrl } = getConfig();
  const url = new URL(baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const headers = { "x-api-key": apiKey };
  if (language) headers["language"] = language;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!res.ok) {
    throw new TransitHubError(
      `TransitHub API request failed: ${method} ${path} -> ${res.status}`,
      res.status,
      parsed
    );
  }

  return parsed;
}

export const transithub = {
  searchTransfers(searchRequest, { language } = {}) {
    return request("POST", "/v1/transfers/search", { body: searchRequest, language });
  },
  getSearchResults(searchId) {
    return request("GET", `/v1/transfers/search/${encodeURIComponent(searchId)}`);
  },
  getRideOption(sessionId, rideId, { pickupTime } = {}) {
    return request(
      "GET",
      `/v1/transfers/search/${encodeURIComponent(sessionId)}/${encodeURIComponent(rideId)}`,
      { query: { pickup_time: pickupTime } }
    );
  },
  listOperators() {
    return request("GET", "/v1/transfers/search/operators");
  },
};

export { TransitHubError };
