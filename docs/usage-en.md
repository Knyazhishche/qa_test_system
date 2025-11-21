# Usage Guide (English)

## Overview

This prototype converts product documentation into structured UI test cases using Grok (via OpenRouter), stores everything in a Postgres+pgvector backend, and simulates execution with a console-based runner. It ingests content from Notion (or an embedded sample if you don't provide a Notion page), chunks it, generates test cases, optionally maps steps to UI elements, and prints runnable actions.

## Prerequisites

- Node.js 18+ and npm.
- OpenRouter API key with access to `x-ai/grok-4.1-fast`.
- Postgres with `pgvector` extension available (for persistence and similarity search).
- Optional: Notion page ID if you want to ingest your own documentation.

## Setup

1) Copy the environment template and set your keys:
```bash
cp .env.example .env
```
- Set `OPENROUTER_API_KEY` in `.env`.
- Set `POSTGRES_URL` to your database (requires `pgvector` installed).
- Optional: `NOTION_API_KEY` + `NOTION_PAGE_ID` to pull docs from Notion.
- Optional overrides: `OPENROUTER_BASE_URL`, `OPENROUTER_GROK_MODEL`, `OPENROUTER_REASONING`, `EMBEDDING_DIMENSIONS`.

2) Install dependencies:
```bash
npm install
```

3) (Optional) Type-check/build:
```bash
npm run build
```

## Running the built-in flows

### Demo: ingest (Notion or embedded) + generate test cases
Prefers Notion if you set `NOTION_PAGE_ID`; otherwise uses an embedded sample. Stores docs and test cases in Postgres.
```bash
npm run demo
```
What happens:
- Ingests Notion page content (or embedded sample) and chunks it.
- Computes deterministic embeddings (demo-grade) and stores chunks in Postgres+pgvector.
- Calls Grok via OpenRouter with a strict JSON prompt to generate test cases.
- Persists cases and steps in Postgres and prints a summary.

### Simulated pipeline: generate + UI mapping + console runner
Runs end-to-end with a stub UI map and console driver.
```bash
npm run run-simulated
```
What happens:
- Ingests Notion (if configured) or embedded sample and generates test cases with Grok.
- Seeds a sample UI map for `/login`.
- Optionally maps steps to UI elements via Grok (JSON contract enforced).
- Executes steps with a console `PageDriver` (swap with Playwright to drive a real browser).

## Key environment variables

- `OPENROUTER_API_KEY` (required): your OpenRouter key.
- `OPENROUTER_GROK_MODEL` (optional): defaults to `x-ai/grok-4.1-fast`.
- `OPENROUTER_BASE_URL` (optional): defaults to `https://openrouter.ai/api/v1`.
- `OPENROUTER_REASONING` (optional): `true`/`false`; toggles the reasoning flag in requests.
- `NOTION_API_KEY` (optional but required for Notion ingestion): your Notion integration secret.
- `NOTION_PAGE_ID` (optional): page to ingest; if absent, an embedded sample doc is used.
- `NOTION_API_BASE_URL` (optional): defaults to `https://api.notion.com/v1`.
- `NOTION_API_VERSION` (optional): defaults to `2022-06-28`.
- `POSTGRES_URL` (required): connection string for Postgres with `pgvector`.
- `POSTGRES_SCHEMA` (optional): schema name, defaults to `public`.
- `EMBEDDING_DIMENSIONS` (optional): defaults to `64` and must match the pgvector column.

## Ingesting documentation from Notion

1) Set `NOTION_API_KEY` in `.env` (create a Notion integration and share the page/database with it).  
2) Run the Notion ingest command with a page ID:
```bash
npm run notion-ingest -- <notion_page_id> [featureKey]
```
Example:
```bash
npm run notion-ingest -- 0123456789abcdef0123456789abcdef my/feature-key
```
What happens:
- Pulls the page blocks via Notion API and flattens them to markdown-ish text.
- Chunks the content and stores it as a Notion source.
- Generates test cases with Grok for the provided `featureKey` (default `notion/feature`).

## Examples

- Minimal `.env` (replace values):
```bash
POSTGRES_URL=postgres://user:pass@localhost:5432/qa_test_system
OPENROUTER_API_KEY=sk-...
NOTION_API_KEY=secret_...
NOTION_PAGE_ID=0123456789abcdef0123456789abcdef
```

- Generate tests for a specific Notion page and feature key:
```bash
npm run notion-ingest -- 0123456789abcdef0123456789abcdef auth/login
```

- Demo without Notion (uses embedded sample):
```bash
unset NOTION_PAGE_ID
npm run demo
```

- Simulated run with mapping and console output:
```bash
npm run run-simulated
```

## File map (essentials)

- `src/index.ts`: CLI entry with `demo` and `run-simulated` commands.
- `src/llm/openRouterClient.ts`: thin client for OpenRouter chat completions.
- `src/prompts/*.ts`: prompt builders for test generation and action mapping.
- `src/services/ingestionService.ts`: markdown ingestion + chunking + embeddings.
- `src/services/testCaseGenerator.ts`: Grok-backed test case generation with Zod validation.
- `src/services/actionMapper.ts`: maps human steps to UI elements/actions via Grok.
- `src/services/runner.ts`: console runner (drop-in replace `PageDriver` with Playwright).
- `src/storage/inMemoryStore.ts`: in-memory persistence and similarity search.

## Extending toward a real runner

1) Replace `ConsolePageDriver` with a Playwright-based driver (headless/headed).
2) Persist data in Postgres + pgvector instead of the in-memory store.
3) Generate UI maps by scanning live pages with Playwright; store elements per route.
4) Harden prompts and add rate limiting/retries around LLM calls.
5) Add reporting (screenshots, traces) and an API/CLI to trigger runs from CI.

## Troubleshooting

- Missing key: ensure `OPENROUTER_API_KEY` is set and exported to the environment used by `npm` scripts.
- JSON parse errors: Grok must return strict JSON; rerun with smaller chunks or simplify documentation if needed.
- No test cases generated: ensure the source content (Notion or embedded sample) covers your feature; adjust the query in `src/index.ts` if necessary.
