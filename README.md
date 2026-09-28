# transithub-search (Claude Code plugin)

A Claude Code plugin that lets Claude search global ground airport transfers
through the TransitHub Partner API — **search/discovery module only**. It
never books, cancels, or amends a reservation.

## What it does

Bundles an MCP server that wraps the four `Search`-tagged endpoints of the
TransitHub Partner API (`/v1/transfers/search*`):

| Tool | Endpoint |
| --- | --- |
| `search_transfers` | `POST /v1/transfers/search` |
| `get_search_results` | `GET /v1/transfers/search/{search_id}` |
| `get_ride_option` | `GET /v1/transfers/search/{session_id}/{ride_id}` |
| `list_operators` | `GET /v1/transfers/search/operators` |

The `skills/transithub-search` skill teaches Claude when and how to use
these tools. Booking, cancellation, and amendment endpoints
(`/v1/transfers/bookings*`) are intentionally out of scope and not
implemented.

## Setup

1. Get a TransitHub Partner API key (`x-api-key`).
2. Install the plugin in Claude Code (add this repo as a plugin
   source/marketplace, then install `transithub-search`).
3. When enabling the plugin, Claude Code prompts for its configuration —
   enter your API key there (stored as the plugin's `api_key` user config,
   marked sensitive; never hardcode it in a file). Optionally override
   `api_base_url` (defaults to `https://api.transithub.io`), e.g. for a
   staging environment.

The bundled MCP server itself just reads `TRANSITHUB_API_KEY` /
`TRANSITHUB_API_BASE_URL` from its process environment (see
`mcp-server/transithub-client.js`), which the plugin manifest populates from
that user configuration — so it also works if you run `mcp-server/index.js`
standalone with those two environment variables exported yourself.

## Layout

- `.claude-plugin/plugin.json` — plugin manifest, registers the bundled MCP server.
- `mcp-server/` — Node.js MCP server exposing the TransitHub search module as tools.
  - `transithub-client.js` — thin fetch-based client for the four search endpoints.
  - `index.js` — MCP server entrypoint, defines the tools above.
- `skills/transithub-search/SKILL.md` — skill describing how/when to use the search tools.

## Notes

- Prices in the raw API are minor currency units (e.g. cents); tool output
  converts these to a human-readable amount using each response's
  `precision` field.
- `search_transfers` results are session-scoped and short-lived — see
  `metadata.expires_at` in the response.
