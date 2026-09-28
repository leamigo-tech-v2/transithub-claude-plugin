# transithub-search (Claude Code plugin)

<img src="assets/icon.png" alt="TransitHub icon" width="80" height="80" />

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
2. Add this repo as a plugin marketplace and install the plugin:

   ```
   /plugin marketplace add leamigo-tech-v2/transithub-claude-plugin
   /plugin install transithub-search@transithub-search-marketplace
   ```

3. When enabling the plugin, Claude Code prompts for its configuration —
   enter your API key there (stored as the plugin's `api_key` user config,
   marked sensitive, kept in Claude Code's credential store rather than
   plaintext settings; never hardcode it in a file). Optionally override
   `api_base_url` (defaults to `https://api.transithub.io`), e.g. for a
   staging environment.

The bundled MCP server itself just reads `TRANSITHUB_API_KEY` /
`TRANSITHUB_API_BASE_URL` from its process environment (see
`mcp-server/transithub-client.js`), which the plugin manifest populates from
that user configuration — so it also works if you run `mcp-server/index.js`
standalone with those two environment variables exported yourself.

## Layout

- `.claude-plugin/plugin.json` — plugin manifest, registers the bundled MCP server.
- `.claude-plugin/marketplace.json` — makes this repo installable directly via
  `/plugin marketplace add`.
- `mcp-server/` — Node.js MCP server exposing the TransitHub search module as tools.
  - `transithub-client.js` — thin fetch-based client for the four search endpoints.
  - `index.js` — MCP server entrypoint, defines the tools above.
- `skills/transithub-search/SKILL.md` — skill describing how/when to use the search tools.
- `evals/` — `claude plugin eval` test suite (see below).
- `assets/icon.png` — square icon (cropped from TransitHub's logo mark) for use when
  submitting the plugin to a marketplace listing. Neither `plugin.json` nor
  `marketplace.json` currently has an icon field, so this isn't wired into the
  manifest — it's just kept here for reference/reuse.

## Testing

Before any change ships, run:

```
claude plugin validate .claude-plugin/plugin.json --strict
claude plugin validate .claude-plugin/marketplace.json --strict
claude plugin eval . --trust-plugin --model sonnet --judge-model haiku --no-publish
```

`claude plugin validate` checks manifest structure (this is what a marketplace
listing's automated check enforces). `claude plugin eval` runs the plugin
against real prompts with mocked TransitHub API responses (recorded from live
API calls — see `evals/mocks/transithub/`) and grades the transcripts:

| Case | What it checks |
| --- | --- |
| `search-and-summarize` | Calls `search_transfers` and reports the mocked ride options accurately (no fabricated prices/vehicles) |
| `no-results-handling` | Treats an empty result (`status: false`) as a normal "no options found" answer, not an error |
| `list-operators` | Calls `list_operators` and reports the connected suppliers accurately |
| `booking-out-of-scope` | Refuses to fabricate a booking confirmation when asked to "book" a ride, since this plugin is search-only |

All four currently pass (score 1.0). Note: the acting model matters — Haiku
struggled to invoke the plugin's MCP tool reliably in testing, so evals (and
real usage where tool-calling reliability matters) should target Sonnet or
above.

## Notes

- Prices in the raw API are minor currency units (e.g. cents); tool output
  converts these to a human-readable amount using each response's
  `precision` field.
- `search_transfers` results are session-scoped and short-lived — see
  `metadata.expires_at` in the response.
