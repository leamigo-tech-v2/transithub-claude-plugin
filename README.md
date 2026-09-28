# transithub-search (Claude Code plugin)

A Claude Code plugin that lets Claude search global ground airport transfers
through the TransitHub Partner API — **search/discovery module only**. It does
not book, cancel, or manage reservations.

## Status

Scaffolding is in place; the MCP server's tool implementation is pending
confirmation of the exact TransitHub search endpoint(s) and schema from
https://api.transithub.io/api-doc/partner#/ (this session's network policy
currently blocks `api.transithub.io`, so the live spec hasn't been fetched
yet).

## Setup

Set your TransitHub Partner API key as an environment variable before running
Claude Code with this plugin — never commit it to the repo:

```
export TRANSITHUB_API_KEY="pk_live_..."
```

## Layout

- `.claude-plugin/plugin.json` — plugin manifest, registers the bundled MCP server.
- `mcp-server/` — Node.js MCP server exposing TransitHub search as a tool.
- `skills/transithub-search/` — skill describing how/when to use the search tool.
