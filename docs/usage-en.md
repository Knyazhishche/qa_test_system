# Usage Guide (English)

## Overview

This prototype converts product documentation into structured UI test cases using Grok (via OpenRouter) and simulates execution with a console-based runner. It ingests `docs.md`, chunks it, generates test cases, optionally maps steps to UI elements, and prints runnable actions.

## Prerequisites

- Node.js 18+ and npm.
- OpenRouter API key with access to `x-ai/grok-4.1-fast`.
- Local file: `docs.md` (already present for the demo).

## Setup

1) Copy the environment template and set your key:
```bash
cp .env.example .env
```
- Set `OPENROUTER_API_KEY` in `.env`.
- Optional overrides: `OPENROUTER_BASE_URL`, `OPENROUTER_GROK_MODEL`, `OPENROUTER_REASONING`.

2) Install dependencies:
```bash
npm install
```

3) (Optional) Type-check/build:
```bash
npm run build
```

## Running the built-in flows

### Demo: ingest + generate test cases
Generates test cases from the most relevant chunks of `docs.md` using Grok.
```bash
npm run demo
```
What happens:
- Reads and chunks `docs.md`.
- Computes deterministic embeddings (demo-grade) and picks relevant chunks.
- Calls Grok via OpenRouter with a strict JSON prompt to generate test cases.
- Persists cases and steps in the in-memory store and prints a summary.

### Simulated pipeline: generate + UI mapping + console runner
Runs end-to-end with a stub UI map and console driver.
```bash
npm run run-simulated
```
What happens:
- Ingests `docs.md` and generates test cases with Grok.
- Seeds a sample UI map for `/login`.
- Optionally maps steps to UI elements via Grok (JSON contract enforced).
- Executes steps with a console `PageDriver` (swap with Playwright to drive a real browser).

## Key environment variables

- `OPENROUTER_API_KEY` (required): your OpenRouter key.
- `OPENROUTER_GROK_MODEL` (optional): defaults to `x-ai/grok-4.1-fast`.
- `OPENROUTER_BASE_URL` (optional): defaults to `https://openrouter.ai/api/v1`.
- `OPENROUTER_REASONING` (optional): `true`/`false`; toggles the reasoning flag in requests.
- `NOTION_API_KEY` (optional but required for Notion ingestion): your Notion integration secret.
- `NOTION_API_BASE_URL` (optional): defaults to `https://api.notion.com/v1`.
- `NOTION_API_VERSION` (optional): defaults to `2022-06-28`.

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
- No test cases generated: check that relevant text exists in `docs.md` and the embedding similarity picked a chunk; adjust the query in `src/index.ts` if necessary.
