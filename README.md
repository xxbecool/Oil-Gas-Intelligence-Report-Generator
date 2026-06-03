# Oil & Gas Intelligence Report Generator

A production-quality web application that generates professional AI-powered executive intelligence reports from trusted Oil & Gas industry sources.

---

## Project Overview

This application acts as an **Oil & Gas Intelligence Agent**, not a simple news scraper. It:

1. Collects articles from 14 trusted industry sources via RSS
2. Validates and filters content for relevance and quality
3. Removes duplicates using title normalization and URL comparison
4. Sends verified articles to **Google Gemini AI** for executive analysis
5. Generates a professional **PDF report** in memory
6. Returns the report for immediate download

The output resembles a report prepared by a professional energy market analyst for CEOs, Directors, Investors, and Energy Consultants.

---

## Architecture

```
Browser (Next.js Client)
    │
    ▼
POST /api/generate-report
    │
    ├── collectArticles() ────► 14 RSS feeds (concurrent)
    │
    ├── filterAndDeduplicate() ── validation + deduplication
    │
    ├── analyzeArticles() ────► Google Gemini API
    │                           (gemini-2.5-flash → gemini-2.0-flash fallback)
    │
    └── generatePDF() ────────► pdf-lib (in-memory)
                                    │
                                    ▼
                             application/pdf response
                             → Browser auto-download
```

---

## Tech Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Framework    | Next.js 15 (App Router)             |
| Language     | TypeScript (strict mode)            |
| Styling      | Tailwind CSS + shadcn/ui primitives |
| Icons        | Lucide React                        |
| AI           | Google Gemini (gemini-2.5-flash)    |
| News         | rss-parser + cheerio                |
| PDF          | pdf-lib                             |
| Validation   | Zod                                 |
| Dates        | date-fns                            |
| Hosting      | Vercel                              |

---

## Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd oil-gas-intelligence-report-generator

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

---

## Environment Variables

| Variable            | Required | Description                        |
|---------------------|----------|------------------------------------|
| `GEMINI_API_KEY`    | Yes      | Google Gemini API key              |
| `REPORT_TIMEOUT_MS` | No       | Generation timeout (default: 55000)|

---

## Gemini Setup

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key and add it to `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

The application uses:
- **Primary model**: `gemini-2.5-flash-preview-05-20`
- **Fallback model**: `gemini-2.0-flash`

If the primary model times out or fails, the fallback is used automatically. If both fail, the report is generated without AI analysis (articles only).

---

## Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Type checking:**
```bash
npm run type-check
```

---

## Deployment To Vercel

### Option 1: Vercel Dashboard (Recommended)

1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com) and import the repository
3. Add environment variables:
   - `GEMINI_API_KEY` = your key
4. Deploy

### Option 2: Vercel CLI

```bash
npm install -g vercel
vercel
# Follow prompts, then add env vars:
vercel env add GEMINI_API_KEY
vercel --prod
```

### Vercel Configuration

The `api/generate-report` route has `maxDuration = 60` set for Vercel serverless functions. This is compatible with Vercel Pro/Enterprise plans. On the Hobby plan, the limit is 10 seconds, which is insufficient — **a Pro plan is required**.

---

## Trusted Sources

| Source              | Category              | Type |
|---------------------|-----------------------|------|
| Reuters Energy      | News Agency           | RSS  |
| OilPrice.com        | Industry Publication  | RSS  |
| Offshore Energy     | Industry Publication  | RSS  |
| Rigzone             | Industry Publication  | RSS  |
| World Oil           | Industry Publication  | RSS  |
| Natural Gas Intelligence | Industry Publication | RSS |
| OPEC Newsroom       | Government & IGO      | RSS  |
| IEA News            | Government & IGO      | RSS  |
| EIA News            | Government & IGO      | RSS  |
| Saudi Aramco News   | National Oil Company  | RSS  |
| ADNOC News          | National Oil Company  | RSS  |
| Shell Newsroom      | International Major   | RSS  |
| BP Press Releases   | International Major   | RSS  |
| TotalEnergies News  | International Major   | RSS  |

---

## Troubleshooting

### "All news sources failed"
- Check your internet connection
- Some sources may be temporarily down — the app retries and skips failed sources
- Try again in a few minutes

### "AI analysis failed" / Report generated without AI
- Verify `GEMINI_API_KEY` is set correctly
- Check if you have Gemini API quota available
- Try with AI disabled to confirm the rest works

### Slow generation
- RSS fetches have 8-second timeouts per source
- AI analysis can take 10–30 seconds
- PDF generation is fast (~1 second)
- Total time is typically 15–45 seconds

### Build errors
```bash
npm run type-check  # TypeScript errors
npm run lint        # ESLint errors
```

---

## Limitations

- **No real-time data**: Articles come from RSS feeds, which may have publishing delays
- **No historical reports**: Each report is fresh; no persistence
- **Vercel Hobby plan**: 10-second function limit is too short — Pro plan required
- **Gemini rate limits**: Free tier may throttle under heavy usage
- **RSS availability**: Some sources may not publish RSS or may change feed URLs

---

## Future Enhancements

- Email delivery of reports
- Report scheduling (daily/weekly)
- Custom source configuration via UI
- Price chart embedding (WTI, Brent)
- Multi-language support
- Report history via browser local storage
- Webhook notifications when report is ready
