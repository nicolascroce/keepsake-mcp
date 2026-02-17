#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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
// HTTP helper
// ---------------------------------------------------------------------------

interface ApiResult {
  data?: unknown;
  meta?: { total?: number; limit?: number; offset?: number };
  error?: { code?: string; message?: string } | string;
}

async function fetchApi(
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<ApiResult> {
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
}

/** Format an API result as text content for the MCP response. */
function toContent(result: ApiResult): { content: { type: "text"; text: string }[] } {
  if (result.error) {
    const msg =
      typeof result.error === "string"
        ? result.error
        : result.error.message || JSON.stringify(result.error);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }] };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result.data ?? result, null, 2) }],
  };
}

/** Build query string from optional params, skipping undefined values. */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "keepsake",
  version: "1.0.0",
});

// ===========================================================================
// CONTACTS
// ===========================================================================

server.registerTool(
  "list_contacts",
  {
    description:
      "List all contacts in the user's Keepsake CRM. Supports pagination, sorting, and optional last_interaction_date enrichment.",
    inputSchema: {
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
      sort: z.string().optional().describe("Sort field: last_name, first_name, created_at"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      include_last_interaction: z.boolean().optional().describe("Include last_interaction_date for each contact (default: false)"),
    },
    annotations: { title: "List contacts", readOnlyHint: true, openWorldHint: false },
  },
  async ({ limit, offset, sort, order, include_last_interaction }) => {
    return toContent(await fetchApi(`/contacts${qs({ limit, offset, sort, order, include_last_interaction })}`));
  }
);

server.registerTool(
  "get_contact",
  {
    description:
      "Get a single contact by ID, including recent entries (interactions), tags, last_interaction_date, and total_entries count.",
    inputSchema: {
      id: z.string().uuid().describe("Contact UUID"),
      entries_limit: z.number().int().optional().describe("Max entries to return (default 10, -1 for all)"),
    },
    annotations: { title: "Get contact", readOnlyHint: true, openWorldHint: false },
  },
  async ({ id, entries_limit }) => {
    return toContent(await fetchApi(`/contacts/${id}${qs({ entries_limit })}`));
  }
);

server.registerTool(
  "create_contact",
  {
    description: "Create a new contact. first_name and last_name are required.",
    inputSchema: {
      first_name: z.string().describe("First name"),
      last_name: z.string().describe("Last name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      notes: z.string().optional().describe("Notes about the contact"),
    },
    annotations: { title: "Create contact", destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    return toContent(await fetchApi("/contacts", "POST", params));
  }
);

server.registerTool(
  "update_contact",
  {
    description: "Update an existing contact. Only send the fields you want to change.",
    inputSchema: {
      id: z.string().uuid().describe("Contact UUID"),
      first_name: z.string().optional().describe("First name"),
      last_name: z.string().optional().describe("Last name"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      notes: z.string().optional().describe("Notes about the contact"),
    },
    annotations: { title: "Update contact", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/contacts/${id}`, "PATCH", body));
  }
);

server.registerTool(
  "delete_contact",
  {
    description: "Permanently delete a contact and all associated data.",
    inputSchema: {
      id: z.string().uuid().describe("Contact UUID"),
    },
    annotations: { title: "Delete contact", destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/contacts/${id}`, "DELETE"));
  }
);

server.registerTool(
  "search_contacts",
  {
    description:
      "Search contacts by name, email, company, etc. Search is accent-insensitive.",
    inputSchema: {
      q: z.string().describe("Search query"),
    },
    annotations: { title: "Search contacts", readOnlyHint: true, openWorldHint: false },
  },
  async ({ q }) => {
    return toContent(await fetchApi(`/contacts/search${qs({ q })}`));
  }
);

// ===========================================================================
// COMPANIES
// ===========================================================================

server.registerTool(
  "list_companies",
  {
    description:
      "List all companies/organizations in the user's Keepsake CRM. Supports pagination and sorting.",
    inputSchema: {
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
      sort: z.string().optional().describe("Sort field: name, created_at, updated_at"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
    },
    annotations: { title: "List companies", readOnlyHint: true, openWorldHint: false },
  },
  async ({ limit, offset, sort, order }) => {
    return toContent(await fetchApi(`/companies${qs({ limit, offset, sort, order })}`));
  }
);

server.registerTool(
  "get_company",
  {
    description:
      "Get a single company by ID, including linked contacts (with roles) and tags.",
    inputSchema: {
      id: z.string().uuid().describe("Company UUID"),
    },
    annotations: { title: "Get company", readOnlyHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/companies/${id}`));
  }
);

server.registerTool(
  "create_company",
  {
    description: "Create a new company/organization. Only 'name' is required.",
    inputSchema: {
      name: z.string().describe("Company name"),
      website: z.string().optional().describe("Website URL"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      address: z.string().optional().describe("Address"),
      notes: z.string().optional().describe("Notes about the company"),
    },
    annotations: { title: "Create company", destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    return toContent(await fetchApi("/companies", "POST", params));
  }
);

server.registerTool(
  "update_company",
  {
    description: "Update an existing company. Only send the fields you want to change.",
    inputSchema: {
      id: z.string().uuid().describe("Company UUID"),
      name: z.string().optional().describe("Company name"),
      website: z.string().optional().describe("Website URL"),
      email: z.string().optional().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      address: z.string().optional().describe("Address"),
      notes: z.string().optional().describe("Notes about the company"),
    },
    annotations: { title: "Update company", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/companies/${id}`, "PATCH", body));
  }
);

server.registerTool(
  "delete_company",
  {
    description: "Soft-delete a company. Use permanent=true for hard delete.",
    inputSchema: {
      id: z.string().uuid().describe("Company UUID"),
      permanent: z.boolean().optional().describe("Hard delete (default: false, soft delete)"),
    },
    annotations: { title: "Delete company", destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, permanent }) => {
    const query = permanent ? "?permanent=true" : "";
    return toContent(await fetchApi(`/companies/${id}${query}`, "DELETE"));
  }
);

server.registerTool(
  "search_companies",
  {
    description:
      "Search companies by name, email, website, or address. Search is accent-insensitive.",
    inputSchema: {
      q: z.string().describe("Search query"),
    },
    annotations: { title: "Search companies", readOnlyHint: true, openWorldHint: false },
  },
  async ({ q }) => {
    return toContent(await fetchApi(`/companies/search${qs({ q })}`));
  }
);

// ===========================================================================
// ENTRIES (Interactions)
// ===========================================================================

server.registerTool(
  "list_entries",
  {
    description:
      "List interaction entries (calls, emails, meetings, events, etc.). Supports filtering by type, contact, and date range.",
    inputSchema: {
      type: z
        .enum(["call", "email", "meeting", "event", "gift", "letter", "message", "other"])
        .optional()
        .describe("Filter by entry type"),
      contact_id: z.string().uuid().optional().describe("Filter by associated contact ID"),
      from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
    },
    annotations: { title: "List entries", readOnlyHint: true, openWorldHint: false },
  },
  async ({ type, contact_id, from, to, limit, offset }) => {
    return toContent(
      await fetchApi(`/entries${qs({ type, contact_id, from, to, limit, offset })}`)
    );
  }
);

server.registerTool(
  "create_entry",
  {
    description:
      "Create a new interaction entry. Content supports #tag# and [[tag]] syntax for automatic tag linking.",
    inputSchema: {
      type: z
        .enum(["call", "email", "meeting", "event", "gift", "letter", "message", "other"])
        .describe("Entry type"),
      date: z.string().describe("Date (YYYY-MM-DD)"),
      content: z.string().optional().describe("Entry content (supports #tag# and [[tag]])"),
      contact_ids: z
        .array(z.string().uuid())
        .optional()
        .describe("Array of contact UUIDs to associate"),
    },
    annotations: { title: "Create entry", destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    return toContent(await fetchApi("/entries", "POST", params));
  }
);

server.registerTool(
  "update_entry",
  {
    description: "Update an existing entry. Only send fields you want to change.",
    inputSchema: {
      id: z.string().uuid().describe("Entry UUID"),
      type: z
        .enum(["call", "email", "meeting", "event", "gift", "letter", "message", "other"])
        .optional()
        .describe("Entry type"),
      date: z.string().optional().describe("Date (YYYY-MM-DD)"),
      content: z.string().optional().describe("Entry content (supports #tag# and [[tag]])"),
      contact_ids: z
        .array(z.string().uuid())
        .optional()
        .describe("Replace associated contacts"),
    },
    annotations: { title: "Update entry", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/entries/${id}`, "PATCH", body));
  }
);

server.registerTool(
  "delete_entry",
  {
    description: "Delete an interaction entry.",
    inputSchema: {
      id: z.string().uuid().describe("Entry UUID"),
    },
    annotations: { title: "Delete entry", destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/entries/${id}`, "DELETE"));
  }
);

// ===========================================================================
// TASKS
// ===========================================================================

server.registerTool(
  "list_tasks",
  {
    description:
      "List tasks. Filter by status (pending/completed), date_type, or specific date.",
    inputSchema: {
      status: z.enum(["pending", "completed"]).optional().describe("Filter by status"),
      date_type: z
        .enum(["specific", "week", "month", "quarter", "unspecified"])
        .optional()
        .describe("Filter by date type"),
      date: z.string().optional().describe("Filter by specific date (YYYY-MM-DD)"),
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
    },
    annotations: { title: "List tasks", readOnlyHint: true, openWorldHint: false },
  },
  async ({ status, date_type, date, limit, offset }) => {
    return toContent(
      await fetchApi(`/tasks${qs({ status, date_type, date, limit, offset })}`)
    );
  }
);

server.registerTool(
  "create_task",
  {
    description:
      "Create a new task. Title supports #tag# and [[tag]] for automatic tag linking.",
    inputSchema: {
      title: z.string().describe("Task title (supports #tag# and [[tag]])"),
      description: z.string().optional().describe("Task description"),
      date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      date_type: z
        .enum(["specific", "week", "month", "quarter", "unspecified"])
        .optional()
        .describe("Date type (default: specific)"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level"),
      recurrence_type: z
        .enum(["daily", "weekly", "monthly", "yearly"])
        .optional()
        .describe("Recurrence pattern"),
      recurrence_interval: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Recurrence interval (e.g., every N days)"),
      contact_id: z.string().uuid().optional().describe("Associated contact UUID"),
    },
    annotations: { title: "Create task", destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    return toContent(await fetchApi("/tasks", "POST", params));
  }
);

server.registerTool(
  "update_task",
  {
    description: "Update an existing task. Only send fields you want to change.",
    inputSchema: {
      id: z.string().uuid().describe("Task UUID"),
      title: z.string().optional().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      date: z.string().optional().describe("Due date (YYYY-MM-DD)"),
      date_type: z
        .enum(["specific", "week", "month", "quarter", "unspecified"])
        .optional()
        .describe("Date type"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Priority level"),
    },
    annotations: { title: "Update task", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/tasks/${id}`, "PATCH", body));
  }
);

server.registerTool(
  "delete_task",
  {
    description: "Delete a task.",
    inputSchema: {
      id: z.string().uuid().describe("Task UUID"),
    },
    annotations: { title: "Delete task", destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/tasks/${id}`, "DELETE"));
  }
);

server.registerTool(
  "complete_task",
  {
    description:
      "Mark a task as completed. If the task is recurring, this automatically creates the next occurrence.",
    inputSchema: {
      id: z.string().uuid().describe("Task UUID"),
    },
    annotations: { title: "Complete task", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/tasks/${id}/complete`, "POST"));
  }
);

server.registerTool(
  "uncomplete_task",
  {
    description: "Mark a completed task as pending again.",
    inputSchema: {
      id: z.string().uuid().describe("Task UUID"),
    },
    annotations: { title: "Uncomplete task", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/tasks/${id}/uncomplete`, "POST"));
  }
);

server.registerTool(
  "snooze_task",
  {
    description: "Reschedule a task to a new date.",
    inputSchema: {
      id: z.string().uuid().describe("Task UUID"),
      date: z.string().describe("New date (YYYY-MM-DD)"),
      date_type: z
        .enum(["specific", "week", "month", "quarter", "unspecified"])
        .optional()
        .describe("New date type (default: specific)"),
    },
    annotations: { title: "Snooze task", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/tasks/${id}/snooze`, "POST", body));
  }
);

// ===========================================================================
// QUICK NOTES
// ===========================================================================

server.registerTool(
  "list_notes",
  {
    description:
      "List quick notes. Filter by pinned status or archived status.",
    inputSchema: {
      pinned: z.boolean().optional().describe("Filter pinned notes only"),
      archived: z.boolean().optional().describe("Filter archived notes"),
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
    },
    annotations: { title: "List notes", readOnlyHint: true, openWorldHint: false },
  },
  async ({ pinned, archived, limit, offset }) => {
    return toContent(
      await fetchApi(`/notes${qs({ pinned, archived, limit, offset })}`)
    );
  }
);

server.registerTool(
  "create_note",
  {
    description:
      "Create a new quick note. Content supports #tag# and [[tag]] for automatic tag linking.",
    inputSchema: {
      content: z.string().describe("Note content (supports #tag# and [[tag]])"),
      is_pinned: z.boolean().optional().describe("Pin the note (default: false)"),
      contact_ids: z
        .array(z.string().uuid())
        .optional()
        .describe("Array of contact UUIDs to associate"),
    },
    annotations: { title: "Create note", destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async (params) => {
    return toContent(await fetchApi("/notes", "POST", params));
  }
);

server.registerTool(
  "update_note",
  {
    description: "Update an existing quick note.",
    inputSchema: {
      id: z.string().uuid().describe("Note UUID"),
      content: z.string().optional().describe("Updated content"),
    },
    annotations: { title: "Update note", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/notes/${id}`, "PATCH", body));
  }
);

server.registerTool(
  "delete_note",
  {
    description: "Soft-delete a quick note. Use permanent=true for hard delete.",
    inputSchema: {
      id: z.string().uuid().describe("Note UUID"),
      permanent: z.boolean().optional().describe("Hard delete (default: false, soft delete)"),
    },
    annotations: { title: "Delete note", destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, permanent }) => {
    const query = permanent ? "?permanent=true" : "";
    return toContent(await fetchApi(`/notes/${id}${query}`, "DELETE"));
  }
);

server.registerTool(
  "pin_note",
  {
    description: "Pin a quick note so it appears at the top of the list.",
    inputSchema: {
      id: z.string().uuid().describe("Note UUID"),
    },
    annotations: { title: "Pin note", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/notes/${id}/pin`, "POST"));
  }
);

server.registerTool(
  "archive_note",
  {
    description: "Archive a quick note.",
    inputSchema: {
      id: z.string().uuid().describe("Note UUID"),
    },
    annotations: { title: "Archive note", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/notes/${id}/archive`, "POST"));
  }
);

server.registerTool(
  "restore_note",
  {
    description: "Restore a deleted or archived quick note.",
    inputSchema: {
      id: z.string().uuid().describe("Note UUID"),
    },
    annotations: { title: "Restore note", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/notes/${id}/restore`, "POST"));
  }
);

// ===========================================================================
// DAYS (Daily Summaries)
// ===========================================================================

server.registerTool(
  "list_days",
  {
    description: "List daily journal summaries. Filter by date range.",
    inputSchema: {
      from: z.string().optional().describe("Start date (YYYY-MM-DD)"),
      to: z.string().optional().describe("End date (YYYY-MM-DD)"),
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
    },
    annotations: { title: "List days", readOnlyHint: true, openWorldHint: false },
  },
  async ({ from, to, limit, offset }) => {
    return toContent(await fetchApi(`/days${qs({ from, to, limit, offset })}`));
  }
);

server.registerTool(
  "get_day",
  {
    description: "Get a specific day's journal summary by date.",
    inputSchema: {
      date: z.string().describe("Date (YYYY-MM-DD)"),
    },
    annotations: { title: "Get day", readOnlyHint: true, openWorldHint: false },
  },
  async ({ date }) => {
    return toContent(await fetchApi(`/days/${date}`));
  }
);

server.registerTool(
  "update_day",
  {
    description:
      "Create or update a daily journal summary. If a day entry already exists for this date, it will be updated (upsert).",
    inputSchema: {
      date: z.string().describe("Date (YYYY-MM-DD)"),
      note: z.string().describe("Journal content for the day"),
    },
    annotations: { title: "Update day", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async (params) => {
    return toContent(await fetchApi("/days", "POST", params));
  }
);

// ===========================================================================
// TAGS
// ===========================================================================

server.registerTool(
  "list_tags",
  {
    description: "List all tags. Tags organize contacts, entries, tasks, notes, and companies.",
    inputSchema: {
      limit: z.number().int().positive().optional().describe("Max results (default 50)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
    },
    annotations: { title: "List tags", readOnlyHint: true, openWorldHint: false },
  },
  async ({ limit, offset }) => {
    return toContent(await fetchApi(`/tags${qs({ limit, offset })}`));
  }
);

server.registerTool(
  "get_tag_items",
  {
    description:
      "Get all items linked to a specific tag: contacts, entries, tasks, notes, and companies with counts.",
    inputSchema: {
      id: z.string().uuid().describe("Tag UUID"),
    },
    annotations: { title: "Get tag items", readOnlyHint: true, openWorldHint: false },
  },
  async ({ id }) => {
    return toContent(await fetchApi(`/tags/${id}/items`));
  }
);

server.registerTool(
  "link_tag",
  {
    description: "Link an entity (contact, entry, task, note, or company) to a tag.",
    inputSchema: {
      id: z.string().uuid().describe("Tag UUID"),
      entity_type: z
        .enum(["contact", "entry", "task", "note", "company"])
        .describe("Type of entity to link"),
      entity_id: z.string().uuid().describe("UUID of the entity to link"),
    },
    annotations: { title: "Link tag", destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/tags/${id}/link`, "POST", body));
  }
);

server.registerTool(
  "unlink_tag",
  {
    description: "Remove the link between an entity and a tag.",
    inputSchema: {
      id: z.string().uuid().describe("Tag UUID"),
      entity_type: z
        .enum(["contact", "entry", "task", "note", "company"])
        .describe("Type of entity to unlink"),
      entity_id: z.string().uuid().describe("UUID of the entity to unlink"),
    },
    annotations: { title: "Unlink tag", destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  async ({ id, ...body }) => {
    return toContent(await fetchApi(`/tags/${id}/unlink`, "POST", body));
  }
);

// ===========================================================================
// CONTACT TIMELINE
// ===========================================================================

server.registerTool(
  "get_contact_timeline",
  {
    description:
      "Get a unified, chronological feed of ALL items related to a contact — entries, tasks, and notes — sorted by date (most recent first). Much more efficient than fetching entries, tasks, and notes separately.",
    inputSchema: {
      id: z.string().uuid().describe("Contact UUID"),
      type: z
        .enum(["all", "entries", "tasks", "notes"])
        .optional()
        .describe("Filter by item type (default: all)"),
      from: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
      to: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
      limit: z.number().int().positive().optional().describe("Max results (default 20)"),
      offset: z.number().int().nonnegative().optional().describe("Pagination offset"),
    },
    annotations: { title: "Get contact timeline", readOnlyHint: true, openWorldHint: false },
  },
  async ({ id, type, from, to, limit, offset }) => {
    return toContent(
      await fetchApi(`/contacts/${id}/timeline${qs({ type, from, to, limit, offset })}`)
    );
  }
);

// ===========================================================================
// SMART TASK VIEWS
// ===========================================================================

server.registerTool(
  "get_tasks_today",
  {
    description:
      "Get all tasks for today: overdue tasks + tasks due today + ASAP tasks. Each task has a 'category' field ('overdue', 'today', or 'asap'). Includes counts per category.",
    inputSchema: {},
    annotations: { title: "Get today's tasks", readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    return toContent(await fetchApi("/tasks/today"));
  }
);

server.registerTool(
  "get_tasks_overdue",
  {
    description:
      "Get only overdue tasks (pending tasks with a due date before today). Sorted by date ascending (oldest first).",
    inputSchema: {},
    annotations: { title: "Get overdue tasks", readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    return toContent(await fetchApi("/tasks/overdue"));
  }
);

// ===========================================================================
// CHANGELOG
// ===========================================================================

server.registerTool(
  "get_changelog",
  {
    description:
      "Get all items modified since a given timestamp, across all entity types. Perfect for 'heartbeat' checks to see what changed since your last visit. Returns server_time to use as 'since' for the next call.",
    inputSchema: {
      since: z.string().describe("ISO timestamp — only items modified after this time are returned (e.g. 2026-02-11T10:00:00Z)"),
      type: z
        .enum(["all", "contacts", "entries", "tasks", "notes", "days", "companies"])
        .optional()
        .describe("Filter by entity type (default: all)"),
      limit: z.number().int().positive().optional().describe("Max items per entity type (default 50, max 100)"),
    },
    annotations: { title: "Get changelog", readOnlyHint: true, openWorldHint: false },
  },
  async ({ since, type, limit }) => {
    return toContent(await fetchApi(`/changelog${qs({ since, type, limit })}`));
  }
);

// ===========================================================================
// SEARCH
// ===========================================================================

server.registerTool(
  "search",
  {
    description:
      "Search across all Keepsake data — contacts, entries, tasks, notes, and companies. Search is accent-insensitive (e.g., 'berenice' finds 'Bérénice').",
    inputSchema: {
      q: z.string().describe("Search query"),
      type: z
        .enum(["all", "contacts", "entries", "tasks", "notes", "companies"])
        .optional()
        .describe("Limit search to a specific entity type (default: all)"),
      limit: z.number().int().positive().optional().describe("Max results per type (default 10)"),
    },
    annotations: { title: "Search", readOnlyHint: true, openWorldHint: false },
  },
  async ({ q, type, limit }) => {
    return toContent(await fetchApi(`/search${qs({ q, type, limit })}`));
  }
);

// ---------------------------------------------------------------------------
// Agent instructions
// ---------------------------------------------------------------------------

server.registerTool(
  "get_agent_instructions",
  {
    description:
      "Get best practices and instructions for being an effective Keepsake AI agent. Call this at the start of each session to refresh your instructions.",
    inputSchema: {},
    annotations: { title: "Get agent instructions", readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    return toContent(await fetchApi("/agent/instructions"));
  }
);

// ===========================================================================
// Start server
// ===========================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Keepsake MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
