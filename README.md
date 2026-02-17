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

### 2. Configure your MCP client

#### Claude Desktop

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

#### Claude Code

```bash
claude mcp add keepsake -- npx -y keepsake-mcp
```

Then set `KEEPSAKE_API_KEY` in your environment.

#### Cursor

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

## Available tools (42)

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

### Quick Notes
| Tool | Description |
|------|-------------|
| `list_notes` | List notes (filter by pinned/archived) |
| `create_note` | Create a note — supports `#tag#` and `[[tag]]` syntax |
| `update_note` | Update note content |
| `delete_note` | Soft-delete (or permanent) |
| `pin_note` | Pin to top |
| `archive_note` | Archive a note |
| `restore_note` | Restore a deleted/archived note |

### Daily Journal
| Tool | Description |
|------|-------------|
| `list_days` | List journal entries by date range |
| `get_day` | Get a specific day's journal |
| `update_day` | Create or update a day's journal (upsert) |

### Tags
| Tool | Description |
|------|-------------|
| `list_tags` | List all tags |
| `get_tag_items` | Get everything linked to a tag |
| `link_tag` | Link any entity to a tag |
| `unlink_tag` | Remove a tag link |

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
