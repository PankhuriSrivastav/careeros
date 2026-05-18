# Opportunity Finder — Free API Setup Guide

The Opportunity Finder now integrates **7+ legitimate data sources** with no scraping and no ToS violations.

## Data Sources Overview

| Source | Type | Free Tier | Auth | Coverage |
|--------|------|-----------|------|----------|
| **Internshala** | Web Scraping | ✅ Unlimited | None | India internships |
| **RSS Feeds** | RSS Parser | ✅ Unlimited | None | Unstop, HackerEarth, GitHub Jobs |
| **Adzuna** | Public API | ✅ 1000/mo | None | Indian jobs + broad market |
| **JSearch** | RapidAPI | ✅ 100/mo free tier | API Key | LinkedIn, Indeed, 500+ sites |
| **Remotive** | Public API | ✅ Unlimited | None | Remote tech jobs |
| **DuckDuckGo** | Web Search | ✅ Unlimited | None | Fallback web search |

---

## 1. RSS Feeds (FREE — No Setup Needed)

**Feeds automatically fetched:**
- `https://unstop.com/api/feeds/opportunities/rss` — Unstop internships & hackathons
- `https://www.hackerearth.com/api/v1/challenge/feed/` — HackerEarth challenges
- `https://jobs.github.com/positions.json` — GitHub Jobs (as JSON)

**Why free?** These are public feeds published by the platforms themselves.

**Install dependency:**
```bash
pip install feedparser
```

---

## 2. Adzuna API (FREE — No Setup Needed)

**Benefits:**
- Largest job aggregator in India (covers 500K+ active jobs)
- Completely free public API — no auth key required
- No rate limits for normal usage
- Covers full-time jobs, internships, fresher roles

**Example:**
```
GET https://api.adzuna.com/v1/api/jobs/in/search/1?what=python&where=India
```

**Already integrated** — just works out of the box.

---

## 3. JSearch API (OPTIONAL — Free Tier: 100 requests/month)

Provides structured access to **LinkedIn, Indeed, FlexJobs, ZipRecruiter**, and 500+ job boards without direct scraping.

### Setup (One-time)

1. **Get a free API key:**
   - Go to https://rapidapi.com/letscrape-6bRBa3QQKCUaDxqLCPunywr/api/jsearch
   - Click **Subscribe** → Select **Free Plan** (100 calls/month)
   - Copy your **X-RapidAPI-Key**

2. **Add to `.env`:**
   ```bash
   JSEARCH_API_KEY=your_api_key_here
   ```

3. **No additional npm/pip packages needed** — already using `httpx`

### Limits
- **Free tier:** 100 requests/month (~3 per day)
- **Paid:** $15-49/month for 50K-500K+ requests
- **Best for:** Weekly opportunity searches

---

## 4. Remotive API (FREE — No Setup Needed)

**Benefits:**
- Remote-first tech jobs
- Completely free public API
- No auth required
- Updated daily

**Already integrated** — just works.

---

## 5. Internshala Scraping (FREE — No Setup Needed)

**Already integrated** — scrapes individual postings directly from category pages.

---

## 6. DuckDuckGo Web Search (FREE — No Setup Needed)

**Already integrated** — fallback source using `ddgs` package.

---

## Complete `.env` Template

```env
# === Core ===
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
DATABASE_URL=postgresql://user:pass@host/db

# === AI (Optional) ===
GEMINI_API_KEY=your_gemini_key

# === APIs (Optional but Recommended) ===
JSEARCH_API_KEY=your_jsearch_key_from_rapidapi  # 100 calls/month free

# === HackerEarth Integration (Advanced — Optional) ===
HACKEREARTH_CLIENT_ID=optional
HACKEREARTH_CLIENT_SECRET=optional
```

---

## Testing the Integration

### Start the backend:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### Test an endpoint in your browser or Postman:
```
GET http://localhost:8000/api/opportunities/search?opportunity_type=internship_software
```

**Expected response includes:**
```json
{
  "results": [...],
  "sources": {
    "internshala": 3,
    "rss_feeds": 2,
    "adzuna": 4,
    "jsearch": 1,
    "remotive": 2,
    "web_search": 5
  }
}
```

---

## Why These Sources?

✅ **Legal** — All public APIs or published feeds (no ToS violations)  
✅ **Free tier** — All accessible without payment  
✅ **No scraping of LinkedIn/Indeed** — Using JSearch proxy instead  
✅ **Structured data** — Not parsing HTML, using official APIs/feeds  
✅ **High coverage** — 7 sources cover India + global + remote jobs + hackathons  
✅ **Fallback support** — DuckDuckGo as safety net if others fail  

---

## Performance Tips

1. **Parallel requests:** All sources are fetched concurrently (asyncio)
2. **Deduplication:** Results deduped by URL before returning
3. **Rate limits:** Semaphore limits concurrent DuckDuckGo to 3 requests
4. **Timeout:** 15-20s per API call; failures don't block others

---

## Common Issues

### "feedparser not installed"
```bash
pip install feedparser
```

### "JSEARCH_API_KEY not set"
- Optional. Set it in `.env` to enable JSearch.
- Without it, you'll still get results from Internshala + RSS + Adzuna + DuckDuckGo.

### No results for a search
- Try a different **opportunity_type** (e.g., `job_fresher` vs `internship_software`)
- Resume must have 3+ extracted keywords (upload PDF in Resume Analyzer)
- Some sources may be rate-limited; check backend logs

---

## Roadmap

- [ ] Lever API (premium startup jobs)
- [ ] YCombinator Jobs RSS
- [ ] Crunchbase Jobs API
- [ ] Government job portals (UPSC, SSC RSS)
- [ ] University placement portals (ISB, IIT job boards)

---

## Questions?

Check [main.py](main.py) `search_opportunities()` and [opportunity_sources.py](opportunity_sources.py) `gather_opportunity_listings()`.
