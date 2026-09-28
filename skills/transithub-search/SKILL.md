---
name: transithub-search
description: Search global ground airport transfers (private cars, shuttles, chauffeur rides between airports, hotels, and addresses) via the TransitHub Partner API. Use this whenever the user wants to find, compare, or price a ground transfer / airport pickup or drop-off, look up an earlier search's results, inspect one specific ride option/quote, or list which transfer operators are connected to their TransitHub account. This skill covers search and discovery only — it never creates, amends, or cancels a booking.
---

# TransitHub transfer search

This skill wraps the **search module** of the TransitHub Partner API
(`/v1/transfers/search*`). It is intentionally scoped to search and
discovery — quoting and comparing ground transfer options — and does not
touch booking, cancellation, or amendment endpoints.

## Tools

The `transithub` MCP server exposes:

- **search_transfers** — search for available ground transfer options between
  a pickup and destination location, for a given date/time, passenger count,
  and journey type (`oneway` or `return`). Returns ride options (provider,
  vehicle, price, booking_token, flags like free cancellation / instant
  confirmation) plus a `search_id`.
- **get_search_results** — re-fetch the full results of a previous search by
  its `search_id`. Use this if the initial search response indicated
  `requires_polling: true` or `has_all_results: false`, meaning more supplier
  results may still be arriving.
- **get_ride_option** — get a frozen quote ("prebooking") snapshot for one
  specific ride option, by `session_id` (the search_id) and `ride_id`.
  Useful right before handing off to a booking flow, to confirm the ride is
  still available and the price hasn't changed.
- **list_operators** — list every transfer operator (supplier) the partner
  account is connected to, independent of any specific search.

## Usage notes

- Pickup and destination need an address string plus latitude/longitude.
  If the user only gives place names (e.g. "JFK Airport" or a hotel name),
  geocode/resolve them to coordinates first, or ask the user for
  coordinates if they're not confidently known.
- `pickup_date` is `YYYY-MM-DD`, `pickup_time`/`return_time` are 24-hour
  `HH:mm`.
- `return_date` and `return_time` are required when `journey_type` is
  `return`.
- Prices in raw API responses are in minor currency units (e.g. cents); the
  tool's summary already converts these to a human-readable amount using the
  response's `precision` field.
- `booking_token` / `ride_id` values from a search are short-lived — check
  `metadata.expires_at` (or `expires_at` on a prebooking) before assuming a
  quote is still valid.
- Never fabricate prices, availability, or operator names — only report
  what the tool actually returns. If a search returns `status: false`, tell
  the user no options were found rather than guessing alternatives.
- This skill cannot book, cancel, or amend a transfer. If the user asks to
  actually book a ride, tell them that's outside what this plugin supports.
