# 🚀 Opportunity Finder — Quick Reference

## What Changed?

**Before:** 3 sources (Internshala, Remotive, DuckDuckGo)  
**After:** 7+ sources (same + RSS + Adzuna + JSearch)

---

## Sources at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│ OPPORTUNITY FINDER — DATA SOURCES                               │
├──────────────────────┬──────────┬────────────┬─────────────────┤
│ Source               │ Type     │ Free Tier  │ Setup Required  │
├──────────────────────┼──────────┼────────────┼─────────────────┤
│ 1. Internshala       │ Scrape   │ ∞          │ No              │
│ 2. Unstop (RSS)      │ Feed     │ ∞          │ No              │
│ 3. HackerEarth (RSS) │ Feed     │ ∞          │ No              │
│ 4. GitHub (JSON)     │ API      │ ∞          │ No              │
│ 5. Adzuna (API)      │ API      │ ∞          │ No              │
│ 6. JSearch (API)     │ Proxy    │ 100/mo     │ Optional ✨     │
│ 7. Remotive (API)    │ API      │ ∞          │ No              │
│ 8. DuckDuckGo        │ Search   │ ∞          │ No              │
└──────────────────────┴──────────┴────────────┴─────────────────┘
```

---

## Files Modified

```
backend/
  ├── opportunity_sources.py         ← NEW: 3 fetchers (RSS, Adzuna, JSearch)
  ├── requirements.txt               ← NEW: feedparser
  ├── API_SETUP.md                   ← NEW: Setup guide
  └── INTEGRATION_COMPLETE.md        ← NEW: Full documentation

frontend/
  └── src/app/dashboard/opportunities/page.tsx
      ├── Added sourceStats state
      ├── Display source breakdown
      └── Updated info message
```

---

## Installation

```bash
# 1. Install dependency
cd backend
pip install feedparser

# 2. OPTIONAL: Set JSearch API key (free tier)
# Edit .env:
# JSEARCH_API_KEY=your_key_from_rapidapi

# 3. Restart backend
python -m uvicorn main:app --reload
```

---

## Testing

```bash
# Terminal 1: Start backend
cd backend && python -m uvicorn main:app --reload

# Terminal 2: Test endpoint
curl "http://localhost:8000/api/opportunities/search?opportunity_type=internship_software"

# Frontend: Dashboard → Opportunities → Select filter → Search
# Should see "Data sources: internshala: X, rss_feeds: Y, adzuna: Z, ..."
```

---

## Example Response

```json
{
  "results": [
    {
      "title": "Python Developer Internship — Startxlabs",
      "snippet": "Bangalore · 3 months · ₹5000/month",
      "url": "https://internshala.com/internship/detail/...",
      "platform": "Internshala",
      "match_percent": 85,
      "trust_score": 92,
      "source": "internshala"
    },
    {
      "title": "Full Stack Developer — TechCorp",
      "snippet": "Remote · Posted 2024-05-18",
      "url": "https://adzuna.com/...",
      "platform": "Adzuna",
      "match_percent": 78,
      "trust_score": 75,
      "source": "adzuna"
    }
  ],
  "total": 47,
  "sources": {
    "internshala": 5,
    "rss_feeds": 3,
    "adzuna": 8,
    "jsearch": 2,
    "remotive": 1,
    "web_search": 6
  }
}
```

---

## Code Flow

```
User Search
    ↓
opportunity/search (main.py)
    ↓
gather_opportunity_listings()  ← Orchestrator
    ├── fetch_internshala_listings()     (async)
    ├── fetch_rss_feeds()                (async) ← NEW
    ├── fetch_adzuna_jobs()              (async) ← NEW
    ├── fetch_jsearch_jobs()             (async) ← NEW
    ├── fetch_remotive_jobs()            (async)
    └── search_job_postings_online()     (async × N queries)
    ↓
    Parallel execution (asyncio.gather)
    ↓
    Dedupe by URL
    ↓
    Return (results, source_stats)
    ↓
    Score & sort results
    ↓
    Response to frontend
    ↓
Display with source breakdown
```

---

## Key Functions

### `opportunity_sources.py`

| Function | Purpose | New? |
|----------|---------|------|
| `fetch_rss_feeds()` | Parse Unstop, HackerEarth, GitHub feeds | ✨ |
| `fetch_adzuna_jobs()` | Query Adzuna API (500K Indian jobs) | ✨ |
| `fetch_jsearch_jobs()` | Query JSearch API (LinkedIn, Indeed, etc.) | ✨ |
| `gather_opportunity_listings()` | Orchestrate all sources in parallel | ♻️ Updated |

### `main.py` (no changes needed)

- Already calls `gather_opportunity_listings()`
- Already returns `source_stats` to frontend
- Scoring & filtering unchanged

### `page.tsx` (frontend)

| Change | Effect |
|--------|--------|
| `sourceStats` state | Tracks source breakdown |
| Source badge section | Displays "internshala: 5, rss_feeds: 3, ..." |
| Info message update | Mentions multi-source aggregation |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `feedparser not found` | `pip install feedparser` |
| No RSS results | Check internet; feeds may be temporarily down |
| JSEARCH shows 0 | Get API key from RapidAPI, set in .env |
| Adzuna shows 0 | May be rate-limited; try again later |
| All sources 0 | Resume has <3 keywords; upload PDF first |

---

## Performance

| Metric | Value |
|--------|-------|
| Total sources | 7+ |
| Parallel execution | Yes (asyncio.gather) |
| Time to results | ~20-25s (parallel, worst case) |
| Deduplication | By URL |
| Failure tolerance | Each source independent |

---

## Environment Variables

```env
# Required (existing)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
DATABASE_URL=...

# Optional (existing)
GEMINI_API_KEY=...
HACKEREARTH_CLIENT_ID=...
HACKEREARTH_CLIENT_SECRET=...

# Optional NEW (recommended)
JSEARCH_API_KEY=your_free_tier_key
```

---

## Next Steps

1. ✅ Install `feedparser`
2. ⏱️ Test a search in the UI
3. 📊 Watch the source breakdown appear
4. 🔑 (Optional) Add JSEARCH_API_KEY for LinkedIn/Indeed access
5. 📝 Read `API_SETUP.md` for detailed docs

---

## Need Help?

- **Setup issues?** → See `API_SETUP.md`
- **Full details?** → See `INTEGRATION_COMPLETE.md`
- **Code questions?** → Check `opportunity_sources.py` (well-commented)
- **API limits?** → Check source table above

---

**Status: ✅ READY TO TEST**
