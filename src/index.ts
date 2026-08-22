#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools, registerAllPrompts, SERVER_INSTRUCTIONS } from "./tools.js";
import type { FetchApiFn, ApiResult } from "./tools.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE =
  process.env.KEEPSAKE_API_URL || "https://app.keepsake.place/api/v1";
const API_KEY = process.env.KEEPSAKE_API_KEY || "";

if (!API_KEY) {
  console.error(
    "Error: KEEPSAKE_API_KEY environment variable is required.\n" +
      "Generate one at https://app.keepsake.place/account"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP helper bound to the static API key
// ---------------------------------------------------------------------------

const fetchApi: FetchApiFn = async (
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<ApiResult> => {
  const url = `${API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };

  const init: RequestInit = { method, headers };
  if (body && method !== "GET") {
    init.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, init);
    const json = (await res.json()) as ApiResult;
    return json;
  } catch (err) {
    return { error: { code: "NETWORK_ERROR", message: String(err) } };
  }
};

// ---------------------------------------------------------------------------
// MCP Server (stdio)
// ---------------------------------------------------------------------------

const server = new McpServer(
  {
    name: "keepsake",
    version: "1.0.0",
  },
  { instructions: SERVER_INSTRUCTIONS }
);

registerAllTools(server, fetchApi);
registerAllPrompts(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Keepsake MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
