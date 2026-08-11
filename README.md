# keepsake-mcp

MCP server for [Keepsake](https://keepsake.place) — the personal CRM that helps you nurture your relationships.

Connect your AI assistant (Claude, Cursor, or any MCP-compatible client) to your Keepsake data: contacts, interactions, tasks, notes, daily journal, companies, and tags.

## Why

Your AI assistant becomes a personal relationship manager. Ask it to:

- "Who did I last talk to at Acme Corp?"
- "Add a note that I ran into Sarah at the conference"
- "What tasks are overdue?"
- "Show me everything related to the #house-project tag"
- "Create a follow-up task for my meeting with John next week"

## Quick start

### 1. Get your API key

Sign up at [keepsake.place](https://keepsake.place), then go to **Account > API Keys** to generate one.

### 2. Choose your connection method

#### Option A: Remote (HTTP) — recommended

No installation required. Works with Claude iOS, Claude web, Claude Desktop Connectors, and any MCP client that supports Streamable HTTP.

**Endpoint:** `https://app.keepsake.place/api/mcp`

**Authentication:** Pass your API key as a Bearer token in the `Authorization` header.

**Claude Desktop (Connectors):**

Add a remote MCP server in Claude Desktop settings with:
- URL: `https://app.keepsake.place/api/mcp`
- Authentication: Bearer token with your `ksk_` API key

**Any MCP client (Streamable HTTP):**

```json
{
  "mcpServers": {
    "keepsake": {
      "type": "streamable-http",
      "url": "https://app.keepsake.place/api/mcp",
      "headers": {
        "Authorization": "Bearer ksk_YOUR_API_KEY"
      }
    }
  }
}
```

#### Option B: Local (stdio)

Runs locally via `npx`. Useful for Claude Code, Cursor, and local development.

**Claude Desktop:**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "keepsake": {
      "command": "npx",
      "args": ["-y", "keepsake-mcp"],
      "env": {
        "KEEPSAKE_API_KEY": "ksk_YOUR_API_KEY"
      }
    }
  }
}
```

**Claude Code:**

```bash
claude mcp add keepsake -- npx -y keepsake-mcp
```

Then set `KEEPSAKE_API_KEY` in your environment.

**Cursor:**

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "keepsake": {
      "command": "npx",
      "args": ["-y", "keepsake-mcp"],
      "env": {
        "KEEPSAKE_API_KEY": "ksk_YOUR_API_KEY"
      }
    }
  }
}
```

## Available tools (67)

### Contacts
| Tool | Description |
|------|-------------|
| `list_contacts` | List all contacts with pagination and sorting |
| `get_contact` | Get a contact with recent interactions, tags, and stats |
| `create_contact` | Create a new contact |
| `update_contact` | Update contact fields |
| `delete_contact` | Permanently delete a contact |
| `search_contacts` | Accent-insensitive search by name, email, company |
| `get_contact_timeline` | Unified chronological feed of all items for a contact |

### Companies
| Tool | Description |
|------|-------------|
| `list_companies` | List all companies |
| `get_company` | Get company with linked contacts and tags |
| `create_company` | Create a new company |
| `update_company` | Update company fields |
| `delete_company` | Soft-delete (or permanent delete) a company |
| `search_companies` | Accent-insensitive company search |

### Entries (Interactions)
| Tool | Description |
|------|-------------|
| `list_entries` | List interactions (calls, emails, meetings, etc.) |
| `create_entry` | Log a new interaction — supports `#tag#` and `[[tag]]` syntax |
| `update_entry` | Update an interaction |
| `delete_entry` | Delete an interaction |

### Tasks
| Tool | Description |
|------|-------------|
| `list_tasks` | List tasks with status/date filters |
| `create_task` | Create a task — supports `#tag#` and `[[tag]]` syntax |
| `update_task` | Update task fields |
| `delete_task` | Delete a task |
| `complete_task` | Mark as completed (auto-creates next occurrence for recurring tasks) |
| `uncomplete_task` | Mark as pending again |
| `snooze_task` | Reschedule to a new date |
| `get_tasks_today` | Today's tasks: overdue + due today + ASAP |
| `get_tasks_overdue` | Only overdue tasks |

### QuickNotes
| Tool | Description |
|------|-------------|
| `list_notes` | List notes (filter by pinned/archived) |
| `get_note` | Get one note by ID with its tags, contacts, tasks and linked notes |
| `create_note` | Create a note — supports `#tag#` and `[[tag]]` syntax |
| `update_note` | Update note content |
| `delete_note` | Soft-delete (or permanent) |
| `pin_note` | Pin to top |
| `archive_note` | Archive a note |
| `restore_note` | Restore a deleted/archived note |

### Note comments (marginalia)

Material kept *alongside* a note without entering its text — an idea, a reference, an excerpt pasted to rewrite a passage later. Anchored to a passage by quoting it, or to the whole note. Never published, and temporary by design: anything worth keeping becomes a note or a linked task.

| Tool | Description |
|------|-------------|
| `list_note_comments` | List the marginalia attached to a note |
| `create_note_comment` | Attach a marginalia to a passage (pass `quote`) or to the whole note |
| `update_note_comment` | Edit the content of a marginalia |
| `delete_note_comment` | Permanently delete a marginalia |

### Daily Journal
| Tool | Description |
|------|-------------|
| `list_days` | List journal entries by date range |
| `get_day` | Get a specific day's journal |
| `update_day` | Create or update a day's journal (upsert) |

### Tags
| Tool | Description |
|------|-------------|
| `list_tags` | List tags (lightweight — ordering arrays omitted), with optional name search (`q`) |
| `get_tag` | Get a tag by ID with all properties, including `tasks_order` (section markers `h:<header_id>`) |
| `create_tag` | Create a new tag |
| `update_tag` | Update a tag (name, description, color, icon, view mode, favorite) |
| `delete_tag` | Permanently delete a tag and all its links |
| `get_tag_items` | Get items linked to a tag — filter by `types`/`status`, `summary` mode, task `sections` included |
| `link_tag` | Link any entity to a tag |
| `unlink_tag` | Remove a tag link |

### Task Headers (Sections)
| Tool | Description |
|------|-------------|
| `list_task_headers` | List all task headers (section separators) |
| `get_task_header` | Get a task header by ID |
| `create_task_header` | Create a task header (section) |
| `update_task_header` | Update a task header (name, description, collapsed) |
| `delete_task_header` | Permanently delete a task header |

### Contact Links
| Tool | Description |
|------|-------------|
| `link_note_contact` | Link a contact to a note |
| `unlink_note_contact` | Remove a contact link from a note |
| `link_entry_contact` | Link a contact to an entry |
| `unlink_entry_contact` | Remove a contact link from an entry |
| `link_task_contact` | Link a contact to a task |
| `unlink_task_contact` | Remove a contact link from a task |
| `link_task_note` | Link a note to a task (non-destructive, the note survives) |
| `unlink_task_note` | Remove a note link from a task |
| `link_notes` | Link two notes together (symmetric, non-destructive) |
| `unlink_notes` | Remove the manual link between two notes |

### Utilities
| Tool | Description |
|------|-------------|
| `search` | Global search across all data types |
| `get_changelog` | Items modified since a timestamp (for sync) |
| `get_agent_instructions` | Best practices for AI agents |

## Tool annotations

All tools include MCP safety annotations:

- **Read-only tools** (`list_*`, `get_*`, `search_*`): marked `readOnlyHint: true`
- **Create tools**: marked `destructiveHint: false`
- **Update tools**: marked `destructiveHint: false, idempotentHint: true`
- **Delete tools**: marked `destructiveHint: true, idempotentHint: true`

## Activity tracking

Every write operation (create, update, delete) performed through the API is recorded in an **Activity Feed** visible to the user inside Keepsake. Each action shows the entity type, a content preview, and which API key was used.

This means your user can see everything you do. Be transparent and precise. If you make a mistake, let the user know so they can verify in the activity feed.

Call `get_agent_instructions` at the start of each session for the full best practices guide.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KEEPSAKE_API_KEY` | Yes | Your API key (starts with `ksk_`) |
| `KEEPSAKE_API_URL` | No | Custom API URL (default: `https://app.keepsake.place/api/v1`) |

## Rate limits

60 requests per minute per API key. Rate limit headers are included in responses.

## API documentation

Full REST API docs: [keepsake.place/api](https://keepsake.place/en/api)

## Privacy

Keepsake MCP server only communicates with the Keepsake API (`app.keepsake.place`). It does not send data to any third-party service. Your data stays between your MCP client and your Keepsake account.

All API calls are authenticated with your personal API key and scoped to your account via Row Level Security. No other user's data is accessible.

See our privacy policy at [keepsake.place/privacy](https://keepsake.place/en/privacy).

## License

MIT
