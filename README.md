# Carter's RSS Reader

A simple RSS reader that aggregates multiple RSS/Atom feeds into a single feed and displays them in a clean web interface.

## Environment Variables

This application requires the following environment variables to be configured:

### `FEEDS`
**Required** - A comma-separated list of RSS/Atom feed URLs to aggregate.

**Example:**
```
FEEDS=https://example.com/feed.xml,https://another-site.com/rss,https://blog.example.org/atom.xml
# or, with whitespace
FEEDS='https://example.com/feed.xml,
https://another-site.com/rss,
https://blog.example.org/atom.xml'
```

### `YAZZY_URL`
**Optional** - Base URL for the Yazzy service. When provided, adds "Open in Yazzy" links to feed items.

**Example:**
```
YAZZY_URL=https://yazzy.example.com
```

### `RECENT_FEED_CUTOFF_TIME`
**Optional** - Time in milliseconds to determine how far back to show "recent" feed items. Defaults to 6 hours (21,600,000 milliseconds) if not specified.

**Examples:**
```
RECENT_FEED_CUTOFF_TIME=21600000    # 6 hours (default)
RECENT_FEED_CUTOFF_TIME=43200000    # 12 hours
RECENT_FEED_CUTOFF_TIME=86400000    # 24 hours
RECENT_FEED_CUTOFF_TIME=3600000     # 1 hour
```

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build for production
bun run build
```
