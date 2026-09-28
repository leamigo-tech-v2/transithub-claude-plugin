#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { transithub, TransitHubError } from "./transithub-client.js";

const server = new McpServer({
  name: "transithub-search",
  version: "0.1.0",
});

const locationSchema = z.object({
  address: z.string().describe("Human-readable pickup or drop-off address"),
  latitude: z.number().describe("Latitude in decimal degrees"),
  longitude: z.number().describe("Longitude in decimal degrees"),
});

function money(amountMinorUnits, currency, precision) {
  if (amountMinorUnits === undefined || amountMinorUnits === null) return undefined;
  const value = amountMinorUnits / 10 ** (precision ?? 2);
  return `${value.toFixed(precision ?? 2)} ${currency ?? ""}`.trim();
}

function summarizeRide(ride, index) {
  const price = money(
    ride.supplier_total?.payable_to_supplier,
    ride.supplier_total?.supplier_currency,
    ride.supplier_total?.precision
  );
  const fee = money(ride.platform_fee?.amount, ride.platform_fee?.currency, ride.platform_fee?.precision);
  const flags = ride.flags || {};
  const flagList = Object.entries(flags)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
    .join(", ");
  return [
    `${index + 1}. ${ride.provider?.name ?? "Unknown provider"} — ${ride.vehicle?.name ?? "Unknown vehicle"}`,
    `   price: ${price ?? "n/a"}${fee ? ` (+ platform fee ${fee})` : ""}`,
    `   booking_token: ${ride.booking_token}`,
    flagList ? `   flags: ${flagList}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function summarizeSearchResponse(result) {
  if (!result?.status) {
    return "No transfer options were found for this route/date.";
  }
  const lines = [
    `search_id: ${result.metadata?.search_id}`,
    `total_rides: ${result.metadata?.total_rides} (has_all_results: ${result.metadata?.has_all_results}, requires_polling: ${result.metadata?.requires_polling})`,
    `results expire at: ${result.metadata?.expires_at}`,
    "",
    ...(result.results || []).map(summarizeRide),
  ];
  return lines.join("\n");
}

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function jsonAndSummary(summary, data) {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: "Full raw response:\n" + JSON.stringify(data, null, 2) },
    ],
    structuredContent: data,
  };
}

function errorResult(err) {
  if (err instanceof TransitHubError) {
    return {
      isError: true,
      content: [{ type: "text", text: `TransitHub API error (HTTP ${err.status}): ${err.message}` }],
    };
  }
  return { isError: true, content: [{ type: "text", text: err.message || String(err) }] };
}

server.registerTool(
  "search_transfers",
  {
    title: "Search ground airport transfers",
    description:
      "Search available ground transfer (airport transfer / point-to-point ride) options worldwide via TransitHub. Returns a list of ride options with vehicle, provider, and price, plus a search_id you can use with get_search_results, and booking_token / ride ids you can use with get_ride_option. Search results only — this tool does not create a booking.",
    inputSchema: {
      pickup: locationSchema.describe("Pickup location"),
      destination: locationSchema.describe("Destination (drop-off) location"),
      passengers: z.number().int().min(1).describe("Number of passengers"),
      pickup_date: z.string().describe("Pickup date, YYYY-MM-DD"),
      pickup_time: z.string().describe("Pickup time, 24-hour HH:mm"),
      journey_type: z.enum(["oneway", "return"]).describe("Type of journey"),
      return_date: z.string().optional().describe("Return date YYYY-MM-DD (required if journey_type is return)"),
      return_time: z.string().optional().describe("Return time HH:mm (required if journey_type is return)"),
      language: z.string().optional().describe("BCP-47 language code for localized content, e.g. en, fr"),
    },
  },
  async ({ pickup, destination, passengers, pickup_date, pickup_time, journey_type, return_date, return_time, language }) => {
    if (journey_type === "return" && (!return_date || !return_time)) {
      return textResult("return_date and return_time are required when journey_type is 'return'.");
    }
    try {
      const result = await transithub.searchTransfers(
        { pickup, destination, passengers, pickup_date, pickup_time, journey_type, return_date, return_time },
        { language }
      );
      return jsonAndSummary(summarizeSearchResponse(result), result);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_search_results",
  {
    title: "Get full search results by search_id",
    description:
      "Fetch the full (possibly updated) results for a previous search_transfers call, using the search_id from its metadata. Use this to poll when requires_polling was true or has_all_results was false.",
    inputSchema: {
      search_id: z.string().describe("The search_id returned in a previous search_transfers response's metadata"),
    },
  },
  async ({ search_id }) => {
    try {
      const result = await transithub.getSearchResults(search_id);
      return jsonAndSummary(summarizeSearchResponse(result), result);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "get_ride_option",
  {
    title: "Get ride option details (prebooking quote)",
    description:
      "Look up the details of one specific ride option from a search, by session/search id and ride id. Returns a frozen prebooking snapshot (price, availability, expiry) that can be used to proceed to booking outside of this plugin. This does not create a booking.",
    inputSchema: {
      session_id: z.string().describe("The search_id (session id) the ride option belongs to"),
      ride_id: z.string().describe("The ride option's booking_token, as returned in the search results"),
      pickup_time: z
        .string()
        .optional()
        .describe("Optional override pickup time HH:mm; defaults to the originally searched pickup_time"),
    },
  },
  async ({ session_id, ride_id, pickup_time }) => {
    try {
      const result = await transithub.getRideOption(session_id, ride_id, { pickupTime: pickup_time });
      const ride = result.ride;
      const summary = [
        `prebooking_id: ${result.prebooking_id}`,
        `ride_available: ${result.ride_available}, price_changed: ${result.price_changed}`,
        `expires_at: ${result.expires_at}`,
        ride ? summarizeRide(ride, 0) : undefined,
      ]
        .filter(Boolean)
        .join("\n");
      return jsonAndSummary(summary, result);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  "list_operators",
  {
    title: "List connected transfer operators",
    description:
      "List every ground transfer operator (supplier) this TransitHub partner account is connected to, independent of any live search. Useful for partner-side configuration, e.g. building an allow/deny list.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await transithub.listOperators();
      const lines = (result.data || []).map(
        (op) => `- [${op.id}] ${op.name} (${op.country_name}, ${op.country_code}) — ${op.status}`
      );
      return jsonAndSummary(lines.join("\n") || "No operators found.", result);
    } catch (err) {
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
