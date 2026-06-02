# CXbox Config Directory

Place configuration files here to override defaults on first boot.
Files are copied to `/data/shared/` inside the container **only if
they don't already exist** (no overwrite of existing data).

## Files

| File | Purpose |
|------|---------|
| `schema.md` | AI wiki-maintenance instructions |
| `config.json` | Global app settings |
| `index.md` | Shared zone index (auto-created if missing) |
| `log.md` | Global activity log (auto-created if missing) |

## Example: config.json

```json
{
  "version": "0.1.0",
  "settings": {
    "defaultAiModel": "copilot",
    "maxFileSizeMB": 50
  }
}
```

## Example: schema.md

See the default schema at `data/shared/schema.md` after first run,
or create your own here.
