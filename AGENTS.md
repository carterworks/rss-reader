# Repository Guidelines

## Project Structure & Module Organization
Astro routes live in `src/pages`; share UI fragments through `src/components` and keep cross-cutting feed helpers in `src/lib`. Global styling and Tailwind layer tokens sit in `src/styles`. Everything is prerendered—Astro emits static assets into `dist/`, backed by icons, manifests, and feeds stored in `public/` and `public/icon/`.

## Build, Test, and Development Commands
Run `bun install` after syncing branches to match dependencies with `bun.lock`. `bun run dev` serves the site on port 4321 for manual QA. Use `bun run build` to produce the static bundle, then `bun run preview` to sanity-check production output. `bun run check` runs Biome formatting and linting; fix any findings before committing.

## Coding Style & Naming Conventions
Let Biome govern formatting—avoid manual tweaks and rely on `bun run check`. Use tab indentation to align with the existing tree. Name components with PascalCase (e.g., `FeedItem.astro`), utilities with camelCase (`fetchFeedData.ts`), and environment variables in uppercase snake case (`FEEDS`). Author accessible, semantic HTML, keeping Tailwind classes inline; promote repeated patterns into tokens under `src/styles`.

## Dependency & Platform Guidance
Every dependency is long-term debt and an extra attack surface. Prefer hand-written solutions unless the problem is deeply complex, riddled with edge cases, and the library is mature and battle-tested. Favor Bun’s built-in APIs and modern browser primitives—the platform you already ship on is the best default. Keep server-side rendering as the source of truth: progressive enhancement should layer optional client code, never gate core content, and keep JavaScript off the critical path.

## Testing Guidelines
There is no automated harness today. Smoke-test with `bun run dev`, supplying a realistic `FEEDS` list to confirm recent items and Yazzy link behavior. Before merging, run `bun run preview`, watch for feed parsing warnings, and note manual test steps in the PR description.

## Commit & Pull Request Guidelines
Follow the existing history with short, imperative commit subjects like `Add mise.toml`. Group related changes together and avoid drive-by edits. Pull requests must summarize the change, list the exact environment variables used (`FEEDS`, `RECENT_FEED_CUTOFF_TIME`, `YAZZY_URL`), include screenshots or GIFs for UI updates, and link related issues or follow-ups.

## Security & Configuration Tips
Store private feed URLs in `.env`, not in version control. Vet new feeds and icons in a private branch, then land assets in `public/icon/` to keep the favicon map consistent and avoid build-time 404s.
