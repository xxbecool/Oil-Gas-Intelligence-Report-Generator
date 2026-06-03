# Design Document: Oil & Gas Intelligence Report Generator

---

## 1. Project Overview

The **Oil & Gas Intelligence Report Generator** is a single-page web application that functions as an AI-powered energy intelligence agent. It is designed to produce executive-level reports that answer four key questions for decision-makers:

- **What happened?** — Curated news from 14 trusted sources
- **Why does it matter?** — AI-generated importance analysis
- **What is the market impact?** — Price, supply/demand, and policy implications
- **What should executives watch next?** — Forward-looking watchlist

The system is entirely stateless — no database, no user accounts, no persistent storage. Each report is generated on-demand, in memory, and immediately delivered as a PDF.

---

## 2. Business Goal

Deliver intelligence-grade energy briefings to:
- C-suite executives (CEO, CFO, COO)
- Board directors
- Investment managers
- Energy consultants
- Government policy advisors

The output quality should rival a brief from a professional energy analyst at a consulting firm, produced in under 60 seconds for zero per-query cost beyond API usage.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER                                │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Next.js Client (React)                    │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ReportSettings│  │GenerateButton│  │ LoadingState  │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │   │
│  └────────────────────────┬────────────────────────────────┘   │
└───────────────────────────┼─────────────────────────────────────┘
                            │ POST /api/generate-report
                            │ {maxArticles, includeAI, focus, ...}
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       VERCEL SERVERLESS                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              API Route Handler                           │  │
│  │              app/api/generate-report/route.ts            │  │
│  │                                                          │  │
│  │  ┌─────────────┐  Zod validation                        │  │
│  │  │  ZodSchema  │──────────────────────────────►         │  │
│  │  └─────────────┘                                        │  │
│  │           │                                             │  │
│  │           ▼                                             │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │              reportBuilder.ts                   │   │  │
│  │  │                                                 │   │  │
│  │  │  Stage 1: collectArticles()                     │   │  │
│  │  │  Stage 2: filterAndDeduplicate()                │   │  │
│  │  │  Stage 3: analyzeArticles()                     │   │  │
│  │  │  Stage 4: generatePDF()                         │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                    │                │            │              │
│              RSS Feeds         Gemini API    pdf-lib           │
│              (14 sources)      (AI analysis) (PDF build)       │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ application/pdf
                       Browser Download
```

---

## 4. User Flow

```
User Opens Application
         │
         ▼
   Configure Settings
   ┌─────────────────┐
   │ Max Articles    │ ← slider 5–20
   │ Focus Area      │ ← dropdown
   │ Include AI      │ ← toggle
   │ Include Sources │ ← toggle
   └─────────────────┘
         │
         ▼
  Click "Generate Report"
         │
         ▼
   Loading State
   ┌─────────────────┐
   │ 1. Collecting   │ ← RSS fetch (concurrent)
   │ 2. Validating   │ ← filter + deduplicate
   │ 3. AI Analysis  │ ← Gemini API
   │ 4. Building PDF │ ← pdf-lib
   └─────────────────┘
         │
         ├── Success → PDF auto-download
         │
         └── Error   → Error message + retry
```

---

## 5. Component Diagram

```
app/
├── page.tsx                  ← Root page, state machine (idle/loading/error/success)
│   ├── <ReportSettings />    ← Configuration form (settings)
│   ├── <GenerateButton />    ← Primary CTA, loading state indicator
│   ├── <LoadingState />      ← Stage progress display
│   └── <ErrorState />        ← Error display with retry

lib/
├── types.ts          ← Shared TypeScript interfaces
├── config.ts         ← Constants (timeouts, limits, keywords)
├── logger.ts         ← Structured logging
├── sources.ts        ← Trusted source definitions
├── scraper.ts        ← RSS collection with Promise.allSettled()
├── articleFilter.ts  ← Validation, dedup, relevance scoring
├── aiAnalyzer.ts     ← Gemini API integration + fallback
├── pdfGenerator.ts   ← pdf-lib report builder
└── reportBuilder.ts  ← Orchestrates all stages
```

---

## 6. Data Flow Diagram

```
RSS Feeds (14 sources)
        │
        ▼
  Raw Articles[]
  {title, url, source, publishedAt, summary, content, category}
        │
        ▼
  filterAndDeduplicate()
  ├── isValid(): title + url + source required
  ├── isRelevant(): keyword matching against KEYWORDS list
  └── dedup: normalizeTitle() + normalizeUrl()
        │
        ▼
  Clean Articles[]  (max N, sorted by date)
        │
    ┌───┴────────────────────────────┐
    │                                │
    ▼                                ▼
analyzeArticles()              (skip if includeAI=false)
  └── Gemini Prompt
      Articles → JSON Analysis
      {executiveSummary,
       topStories[],
       marketImpact,
       opecPolicyImpact,
       companyImpact,
       risks[],
       opportunities[],
       watchlist[]}
    │
    ▼
generatePDF()
  ├── Cover Page
  ├── Executive Summary
  ├── Top Stories
  ├── Market Impact
  ├── OPEC & Policy
  ├── Company Developments
  ├── Risks
  ├── Opportunities
  ├── Watchlist
  ├── Full News Brief
  └── Source References
        │
        ▼
  Uint8Array (PDF bytes)
        │
        ▼
  NextResponse (application/pdf)
        │
        ▼
  Browser Download
```

---

## 7. Source Validation Strategy

All sources are hand-curated. No unknown websites. No social media. No blogs.

**Source categories (trusted only):**
1. News Agencies: Reuters
2. Industry Publications: OilPrice, Offshore Energy, Rigzone, World Oil, NGI
3. Government & IGO: OPEC, IEA, EIA
4. National Oil Companies: Saudi Aramco, ADNOC
5. International Majors: Shell, BP, TotalEnergies

**RSS-first strategy:**
- Use RSS feeds wherever available (all 14 sources have RSS)
- cheerio used to strip HTML from article content
- `Promise.allSettled()` ensures one failing source doesn't abort the pipeline

**Relevance keywords (positive):**
oil, gas, petroleum, lng, opec, crude, barrel, brent, wti, energy, refinery, exploration, production, upstream, downstream, pipeline, offshore, drilling, reservoir, hydrocarbon, aramco, adnoc, shell, bp, totalenergies, exxon, chevron, eni, equinor, etc.

**Discard keywords (negative):**
recipe, fashion, sports, celebrity, entertainment, cryptocurrency, bitcoin, gaming, social media

---

## 8. AI Analysis Strategy

**Provider**: Google Gemini (via `@google/generative-ai` SDK)

**Model hierarchy**:
1. `gemini-2.5-flash-preview-05-20` (primary — latest, fastest)
2. `gemini-2.0-flash` (fallback — if primary times out)
3. No AI analysis (fallback — if both models fail)

**Prompt design principles**:
- Analyst persona: "senior Oil & Gas market intelligence analyst"
- Citation requirement: every major claim cites article numbers [N]
- Fact constraint: "analyze ONLY the articles provided"
- Cautious language: "may", "could", "suggests", "indicates"
- Structured JSON output: ensures consistent PDF section mapping
- Temperature: 0.3 (low — factual, consistent, not creative)

**Output format**:
```json
{
  "executiveSummary": "...",
  "topStories": [{"title": "...", "importance": "...", "references": [1, 2]}],
  "marketImpact": "...",
  "opecPolicyImpact": "...",
  "companyImpact": "...",
  "risks": ["..."],
  "opportunities": ["..."],
  "watchlist": ["..."]
}
```

**Timeout strategy**:
- AI has 45-second timeout
- Total request has 60-second Vercel limit
- On timeout: catch → try fallback → catch → return null (no AI)

---

## 9. PDF Generation Strategy

**Library**: pdf-lib (pure JavaScript, no native dependencies, Vercel-compatible)

**PDF structure**:
```
Page 1: Cover Page (dark navy, gold accents, metadata)
Page 2+: Content Pages (header + footer on each)
  ├── Executive Summary (highlighted box)
  ├── Top Stories (numbered, with source citations)
  ├── Market Impact
  ├── OPEC & Policy
  ├── Company Developments
  ├── Risks (red bullets)
  ├── Opportunities (green bullets)
  ├── Watchlist (blue arrows)
  ├── Full News Brief (all articles with metadata)
  └── Source References (grouped by source)
```

**Design system**:
- Dark Navy `#0A1F38` — headers, cover
- Gold `#BF8C1A` — accents, section markers
- Blue `#1A5AA6` — citations, links
- Standard fonts (Helvetica family) — no external font loading
- A4 page size (595 × 842 pts)
- 50pt margins

**Memory approach**: All pages held in PDFDocument object, `.save()` returns `Uint8Array`, streamed directly to response — never written to disk.

---

## 10. Error Handling Strategy

| Failure Point        | Behavior                                            |
|----------------------|-----------------------------------------------------|
| Individual RSS feed  | Log warning, skip, continue with other sources      |
| All RSS feeds fail   | Throw error "All sources failed", return 500        |
| Zero articles after filter | Throw error "No relevant articles found"     |
| AI primary model     | Log warning, try fallback model                     |
| AI fallback model    | Log error, generate report without AI               |
| PDF generation       | Throw error, return 500 with details                |
| Zod validation fails | Return 400 with field-level errors                  |
| Network timeout      | Return 500 with timeout message                     |

**Client-side**: Fetch errors are caught and displayed in `<ErrorState />` with actionable troubleshooting info and a "Try Again" button.

---

## 11. Security Strategy

| Concern              | Mitigation                                              |
|----------------------|---------------------------------------------------------|
| API key exposure     | `GEMINI_API_KEY` server-side only, never in client     |
| Input injection      | Zod schema validation on all inputs                    |
| Content sanitization | HTML stripped from RSS content before prompt/PDF use   |
| XSS                  | Next.js React escaping; no dangerouslySetInnerHTML     |
| Rate limiting        | `maxDuration` cap; can add IP-based rate limiting      |
| SSRF                 | Only whitelisted source URLs used; no user URL input   |

---

## 12. Performance Optimization

| Optimization         | Implementation                                          |
|----------------------|---------------------------------------------------------|
| Concurrent fetching  | `Promise.allSettled()` for all RSS feeds               |
| Per-request timeout  | 8-second timeout per RSS source                        |
| Content limits       | Max 2000 chars content, 500 chars summary per article  |
| Prompt limits        | Max 15 articles sent to AI (top by recency)            |
| Article cap          | Max 20 articles in final report                        |
| Font embedding       | Standard fonts only (Helvetica) — no download needed  |
| In-memory PDF        | `Uint8Array` never touches filesystem                  |
| Streaming response   | `new NextResponse(pdfBytes)` — direct byte stream      |

---

## 13. Vercel Deployment Strategy

**Configuration**:
```typescript
// app/api/generate-report/route.ts
export const maxDuration = 60; // seconds
```

**Environment Variables** (set in Vercel dashboard):
```
GEMINI_API_KEY = <your key>
```

**Plan requirements**:
- Hobby: 10s function limit — **insufficient**
- Pro: 60s function limit — **required**
- Enterprise: 300s — supported

**Cold start mitigation**:
- No heavy initialization at module level
- RSS parser created once per module load
- PDF fonts embedded at generation time

**Edge runtime**: NOT used — requires Node.js APIs (rss-parser, pdf-lib)
**Runtime**: `nodejs` (default)

---

## 14. Scalability Considerations

| Concern              | Current State                     | At Scale                         |
|----------------------|-----------------------------------|----------------------------------|
| Concurrent users     | Each request is isolated          | Add queue/rate limiting          |
| Gemini rate limits   | ~60 RPM on free tier              | Upgrade to paid tier             |
| RSS source failures  | Graceful degradation              | Add backup source lists          |
| PDF size             | ~200–500KB typical                | No concern                       |
| Cold starts          | ~2s on Vercel                     | Acceptable for on-demand reports |
| Cost                 | ~$0.01–0.05 per report (Gemini)   | Predictable, per-use model       |

---

## 15. Risks And Limitations

| Risk                        | Severity | Mitigation                              |
|-----------------------------|----------|-----------------------------------------|
| RSS feed URL changes        | Medium   | Monitor source health; update URLs      |
| Gemini API deprecation      | Low      | Model fallback chain; easy to update    |
| News source paywall changes | Medium   | Use RSS summaries (not full content)    |
| Gemini hallucination        | Medium   | Citation requirements in prompt         |
| Vercel 60s limit            | High     | Tune timeouts; optimize prompt size     |
| RSS blocking User-Agent     | Low      | Descriptive UA string set               |
| PDF library bugs            | Low      | pdf-lib is stable and widely used       |

---

## 16. Future Roadmap

### Phase 2 (Next)
- [ ] Email delivery integration (Resend or SendGrid)
- [ ] Scheduled reports (daily/weekly) via cron jobs
- [ ] Price data overlay (EIA API for WTI/Brent)
- [ ] Report branding/white-labeling

### Phase 3
- [ ] Multi-language report generation
- [ ] Custom source list management in UI
- [ ] Browser local storage for report history
- [ ] Analytics dashboard (report count, popular focus areas)

### Phase 4
- [ ] Organization accounts with shared settings
- [ ] API endpoint for programmatic report generation
- [ ] Webhook delivery on report completion
- [ ] Custom AI persona/tone per organization
