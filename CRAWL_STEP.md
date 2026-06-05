# Crawl Step

The Crawl step is the first step in the Energize Website Builder flow. It is used when a client already has a live website and we need raw source content before running the Claude.ai cleanup Project.

## Flow

1. Choose `Existing website` in the Crawl step.
2. Enter the client site URL and start the Firecrawl crawl.
3. The app polls Firecrawl every 3 seconds and shows crawl progress.
4. When the crawl completes, the app separates pages into `Keep` and `Skipped`.
5. Review the page list, uncheck pages that should not be included, and optionally move skipped pages back into keep.
6. Export the combined markdown file.
7. Upload the exported file to the Claude.ai cleanup Project.
8. Bring the cleaned structured markdown back into the app and upload it in the Content step.

For brand new websites, choose `New website` and continue without crawling.

## Output Format

The exported file is named:

```text
{domain}-content-raw.md
```

Each page is separated by a source marker:

```markdown
# SOURCE_URL: https://example.com/

[page markdown]

---

# SOURCE_URL: https://example.com/about/

[page markdown]
```

The cleanup Project uses these `SOURCE_URL` blocks to build the page inventory and map source pages to schema page types.

## Environment

Local and Vercel environments need:

```text
FIRECRAWL_API_KEY
```

The key is used only in server route handlers. It is never sent to the browser.

## Notes

- Results are transient and stored in memory during the local session.
- Firecrawl already extracts main markdown content, so the app does not clean the markdown again.
- Blog, archive, policy, feed, WordPress system, query, and file URLs are skipped by default.
- The user can still upload a hand-prepared structured markdown file directly in the Content step.
