# AI-Powered QA Regression System (Prototype)

This repository contains a TypeScript prototype that ingests documentation, generates Playwright-friendly test cases with Grok via OpenRouter, and simulates execution. Detailed usage guides are available in two languages:

- English: [docs/usage-en.md](docs/usage-en.md)
- Русский: [docs/usage-ru.md](docs/usage-ru.md)

## Quick Start

1. Copy environment template and set your OpenRouter key:
   ```bash
   cp .env.example .env
   # edit .env and set OPENROUTER_API_KEY
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure Postgres with `pgvector` and set `POSTGRES_URL` in `.env`.
4. (Optional) Set `NOTION_API_KEY` and `NOTION_PAGE_ID` to pull docs from Notion; otherwise an embedded sample is used.
5. Run the demo to ingest docs and generate test cases with Grok:
   ```bash
   npm run demo
   ```
6. Run the simulated pipeline (LLM mapping + console runner with stub UI map):
   ```bash
   npm run run-simulated
   ```
7. Ingest a specific Notion page and generate tests (requires `NOTION_API_KEY`):
   ```bash
   npm run notion-ingest -- <notion_page_id> [featureKey]
   ```

## What This Prototype Shows

- Markdown ingestion and chunking.
- Deterministic embeddings for similarity search (for demo purposes).
- LLM-based test case generation with strict JSON parsing.
- UI map scaffolding and step-to-UI mapping prompt.
- Console runner that illustrates how steps translate to actions (ready to swap in Playwright).

For full workflow details, how to extend with Playwright, and troubleshooting, read the language-specific docs linked above.
