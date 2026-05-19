"""
Aggregate real job/internship postings from multiple sources (not platform homepages).
"""
from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime
from typing import List, Optional, Set
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IN,en;q=0.9",
}

INTERSHALA_SLUG_BY_SKILL = {
    "python": "python",
    "javascript": "javascript",
    "typescript": "web-development",
    "react": "web-development",
    "next.js": "web-development",
    "nextjs": "web-development",
    "fastapi": "python",
    "java": "java",
    "c++": "computer-science",
    "sql": "computer-science",
    "postgresql": "computer-science",
    "mongodb": "computer-science",
    "machine learning": "machine-learning",
    "ai": "machine-learning",
    "gemini": "machine-learning",
}

INTERSHALA_SLUG_BY_FILTER = {
    "internship_software": "computer-science",
    "internship_ai_ml": "machine-learning",
    "internship_data": "data-science",
    "internship_web": "web-development",
    "internship_mobile": "android-app-development",
    "internship_devops": "cloud-computing",
}

LOW_VALUE_SEARCH_DOMAINS = {
    "wikipedia.org",
    "geeksforgeeks.org",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "medium.com",
}

_ddg_semaphore = asyncio.Semaphore(3)


def internshala_slugs_for_search(keywords: List[str], opportunity_type: str) -> List[str]:
    slugs: Set[str] = set()
    for kw in keywords:
        slug = INTERSHALA_SLUG_BY_SKILL.get(kw.lower().strip())
        if slug:
            slugs.add(slug)
    slugs.add(INTERSHALA_SLUG_BY_FILTER.get(opportunity_type, "computer-science"))
    return list(slugs)[:3]


def is_specific_job_posting_url(url: str) -> bool:
    """True only for individual posting pages, not search/home pages."""
    low = url.lower()
    if "internshala.com" in low:
        return "/internship/detail/" in low
    if "linkedin.com" in low:
        return "/jobs/view/" in low
    if "unstop.com" in low:
        return any(x in low for x in ("/internships/", "/competition/", "/opportunity/"))
    if "hackerearth.com" in low:
        return "/challenges/" in low or "/hackathon/" in low
    if "naukri.com" in low:
        return "job-listings" in low or "-jobs-" in low
    if "wellfound.com" in low:
        return "/jobs/" in low and "/role/l/" not in low
    if "remotive.com" in low:
        return "/remote-jobs/" in low
    if "indeed.com" in low:
        return "viewjob" in low or "/rc/clk" in low
    return False


def _parse_ddg_row(row: dict) -> Optional[dict]:
    url = row.get("href", "") or row.get("link", "") or row.get("url", "")
    if not url:
        return None
    return {
        "title": row.get("title", ""),
        "snippet": row.get("body", "") or row.get("snippet", "") or row.get("description", ""),
        "url": url,
        "platform": None,
        "source": "web_search",
    }


def _run_ddg(query: str, region: str, max_results: int) -> List[dict]:
    rows: List[dict] = []

    def _consume(results):
        for row in list(results or []):
            parsed = _parse_ddg_row(row)
            if parsed:
                rows.append(parsed)

    try:
        client = DDGS()
        try:
            _consume(client.text(keywords=query, region=region, safesearch="moderate", max_results=max_results))
        except TypeError:
            _consume(client.text(query, region=region, safesearch="moderate", max_results=max_results))
        if rows:
            return rows
    except Exception as exc:
        print(f"ddgs search error: {exc}")

    try:
        from duckduckgo_search import DDGS as LegacyDDGS
        with LegacyDDGS() as ddgs:
            for row in ddgs.text(query, region=region, safesearch="moderate", max_results=max_results, backend="html"):
                parsed = _parse_ddg_row(row)
                if parsed:
                    rows.append(parsed)
    except Exception as exc:
        print(f"legacy ddg error: {exc}")
    return rows


async def search_job_postings_online(query: str, max_results: int = 8) -> List[dict]:
    loop = asyncio.get_running_loop()
    for region in ("in-en", "wt-wt"):
        async with _ddg_semaphore:
            raw = await loop.run_in_executor(
                None, lambda r=region: _run_ddg(query, r, max_results)
            )
        filtered = []
        for item in raw:
            url = item["url"]
            if any(d in url.lower() for d in LOW_VALUE_SEARCH_DOMAINS):
                continue
            if is_specific_job_posting_url(url):
                filtered.append(item)
        if filtered:
            return filtered
    return []


def build_detail_search_queries(keywords: List[str], opportunity_type: str) -> List[str]:
    kw = " ".join(keywords[:3]) if keywords else "software developer"
    year = datetime.utcnow().year
    queries: List[str] = []

    internship_types = {
        "all", "internship", "internship_software", "internship_ai_ml",
        "internship_data", "internship_web", "internship_mobile", "internship_devops",
    }
    if opportunity_type in internship_types:
        queries.extend([
            f"site:internshala.com/internship/detail {kw} India",
            f"site:linkedin.com/jobs/view {kw} internship India",
            f"site:unstop.com {kw} internship apply {year}",
        ])

    if opportunity_type in {"all", "hackathon"}:
        queries.extend([
            f"site:unstop.com hackathon {kw} {year}",
            f"site:hackerearth.com/challenges {kw}",
        ])

    if opportunity_type in {"all", "job", "job_fresher"}:
        queries.extend([
            f"site:naukri.com {kw} fresher job-listings",
            f"site:linkedin.com/jobs/view {kw} fresher India",
        ])

    return queries[:6]


def _clean_company_name(name: str) -> str:
    return re.sub(r"\s*Actively hiring\s*$", "", name, flags=re.I).strip()


async def fetch_internshala_listings(slug: str, max_listings: int = 15) -> List[dict]:
    """Scrape individual internship postings from an Internshala category page."""
    url = f"https://internshala.com/internships/{slug}-internship/"
    try:
        async with httpx.AsyncClient(
            timeout=20.0, headers=HTTP_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)
        if resp.status_code != 200:
            return []
    except Exception as exc:
        print(f"Internshala fetch failed ({slug}): {exc}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    listings: List[dict] = []

    for meta in soup.select(".internship_meta"):
        link = meta.select_one('a[href*="/internship/detail/"]')
        if not link:
            continue

        role = " ".join(link.get_text().split())
        company_el = meta.select_one(".company_name a, .company_name")
        company = _clean_company_name(company_el.get_text(strip=True) if company_el else "Company")

        stipend_el = meta.select_one(".stipend")
        location_el = meta.select_one(".location, .locations")

        stipend = " ".join(stipend_el.get_text().split()) if stipend_el else ""
        location = " ".join(location_el.get_text().split()) if location_el else ""

        href = link.get("href", "")
        full_url = urljoin("https://internshala.com", href)

        snippet_parts = [p for p in [stipend, location] if p]
        listings.append({
            "title": f"{role} — {company}",
            "snippet": " · ".join(snippet_parts) if snippet_parts else f"Internship on Internshala ({slug})",
            "url": full_url,
            "platform": "Internshala",
            "source": "internshala",
        })

        if len(listings) >= max_listings:
            break

    return listings


async def fetch_remotive_jobs(keywords: List[str], max_jobs: int = 8) -> List[dict]:
    """Free public API — remote tech jobs (all, matching happens in scoring phase)."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://remotive.com/api/remote-jobs")
        if resp.status_code != 200:
            return []
        jobs = resp.json().get("jobs", [])
    except Exception as exc:
        print(f"Remotive API error: {exc}")
        return []

    results: List[dict] = []

    for job in jobs:
        results.append({
            "title": f"{job.get('title', 'Role')} — {job.get('company_name', 'Company')}",
            "snippet": f"Remote · {job.get('job_type', 'Full-time')} · Posted {job.get('publication_date', '')[:10]} · {job.get('description', '')[:150]}",
            "url": job.get("url", ""),
            "platform": "Remotive",
            "source": "remotive",
            "publication_date": job.get("publication_date", "")[:10],  # Remotive date
        })
        if len(results) >= max_jobs:
            break

    return results


async def fetch_rss_feeds(keywords: List[str], max_items_per_feed: int = 5) -> List[dict]:
    """
    Fetch from free public RSS feeds (Unstop, HackerEarth, GitHub).
    No auth required — completely free and legal.
    Returns ALL opportunities; keyword matching happens in scoring phase.
    """
    results: List[dict] = []
    
    rss_urls = [
        "https://unstop.com/api/feeds/opportunities/rss",
        "https://www.hackerearth.com/api/v1/challenge/feed/",
        "https://jobs.github.com/positions.json",  # GitHub Jobs RSS as JSON
    ]

    try:
        import feedparser
    except ImportError:
        print("⚠️ feedparser not installed. Install with: pip install feedparser")
        return results

    async with httpx.AsyncClient(timeout=20.0, headers=HTTP_HEADERS) as client:
        for feed_url in rss_urls:
            try:
                if "github.com" in feed_url:
                    # GitHub Jobs uses JSON, not RSS
                    resp = await client.get(feed_url)
                    if resp.status_code == 200:
                        jobs = resp.json()
                        for job in jobs[:max_items_per_feed]:
                            results.append({
                                "title": f"{job.get('title', 'Role')} — {job.get('company', 'Company')}",
                                "snippet": f"{job.get('location', 'Remote')} · Posted {job.get('created_at', '')[:10]}",
                                "url": job.get("url", ""),
                                "platform": "GitHub Jobs",
                                "source": "rss_github",
                                "posted_date": job.get("created_at", "")[:10],  # GitHub ISO date
                            })
                else:
                    resp = await client.get(feed_url)
                    if resp.status_code == 200:
                        feed = feedparser.parse(resp.text)
                        for entry in feed.entries[:max_items_per_feed]:
                            title = entry.get("title", "")
                            summary = entry.get("summary", "")
                            platform = "Unstop" if "unstop" in feed_url else "HackerEarth"
                            results.append({
                                "title": title,
                                "snippet": summary[:200],
                                "url": entry.get("link", ""),
                                "platform": platform,
                                "source": f"rss_{platform.lower()}",
                                "posted_date": entry.get("published", "")[:10],  # RSS published date
                            })
            except Exception as e:
                print(f"RSS feed error ({feed_url}): {e}")
                continue

    return results


async def fetch_adzuna_jobs(keywords: List[str], max_jobs: int = 10) -> List[dict]:
    """
    Adzuna API — Free tier covers Indian job market + internships.
    Requires ADZUNA_APP_ID and ADZUNA_APP_KEY environment variables.
    Get free credentials at: https://developer.adzuna.com/
    """
    results: List[dict] = []
    
    # Adzuna API endpoint for India
    adzuna_url = "https://api.adzuna.com/v1/api/jobs/in/search/1"
    
    # Get API credentials from environment
    app_id = os.getenv("ADZUNA_APP_ID", "")
    app_key = os.getenv("ADZUNA_APP_KEY", "")
    
    if not app_id or not app_key:
        print("⚠️ ADZUNA_APP_ID or ADZUNA_APP_KEY not set. Get free credentials at https://developer.adzuna.com/")
        return results
    
    kw = " ".join(keywords[:2]) if keywords else "developer"
    
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "what": kw,
        "where": "India",
        "results_per_page": max_jobs,
        "sort_by": "date",
        "content-type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(adzuna_url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                for job in data.get("results", [])[:max_jobs]:
                    results.append({
                        "title": f"{job.get('title', 'Role')} — {job.get('company', {}).get('display_name', 'Company')}",
                        "snippet": job.get("description", "")[:300],
                        "url": job.get("redirect_url", ""),
                        "platform": "Adzuna",
                        "source": "adzuna",
                        "posted_date": job.get("created", "")[:10],  # Adzuna returns ISO date
                    })
            else:
                print(f"Adzuna API error: status {resp.status_code}")
    except Exception as e:
        print(f"Adzuna API error: {e}")

    return results


async def fetch_jsearch_jobs(keywords: List[str], max_jobs: int = 8) -> List[dict]:
    """
    JSearch API — Free tier for LinkedIn/Indeed/other job listings.
    Provides access to major job boards without direct scraping.
    """
    results: List[dict] = []
    
    # JSearch free endpoint (RapidAPI)
    jsearch_url = "https://jsearch.p.rapidapi.com/search"
    
    # Note: Free tier has limits. For production, set JSEARCH_API_KEY in .env
    api_key = os.getenv("JSEARCH_API_KEY", "")
    
    if not api_key:
        print("⚠️ JSEARCH_API_KEY not set. Skipping JSearch. Set in .env to enable free tier searches.")
        return results

    kw = " ".join(keywords[:2]) if keywords else "software developer"
    
    headers = {
        "X-RapidAPI-Key": api_key,
        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
    }

    params = {
        "query": f"{kw} India",
        "page": 1,
        "num_pages": 1,
        "date_posted": "week",  # Last week
    }

    try:
        async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
            resp = await client.get(jsearch_url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                for job in data.get("data", [])[:max_jobs]:
                    results.append({
                        "title": f"{job.get('job_title', 'Role')} — {job.get('employer_name', 'Company')}",
                        "snippet": job.get("job_description", "")[:300],
                        "url": job.get("job_apply_link", "") or job.get("job_apply_url", ""),
                        "platform": job.get("job_publisher", "Job Board"),
                        "source": "jsearch",
                        "posted_date": job.get("job_posted_at_datetime_utc", "")[:10],  # JSearch ISO date
                    })
            else:
                print(f"JSearch API error: status {resp.status_code}")
    except Exception as e:
        print(f"JSearch API error: {e}")

    return results


def _extract_posting_date(item: dict) -> Optional[datetime]:
    """
    Extract posting date from item metadata.
    Supports: publication_date, created_at, posted_date, publication_time
    """
    from datetime import datetime
    
    date_fields = [
        "publication_date", "created_at", "posted_date", 
        "publication_time", "post_date", "date_posted"
    ]
    
    for field in date_fields:
        date_str = item.get(field, "")
        if not date_str:
            continue
        
        # Clean date string (take only first 10 chars if it has timestamp)
        date_str = str(date_str)[:10]
        
        try:
            # Try YYYY-MM-DD format
            return datetime.strptime(date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            pass
    
    # If no valid date found, assume recent (don't filter)
    return None


def _dedupe_by_url(items: List[dict]) -> List[dict]:
    seen: Set[str] = set()
    out: List[dict] = []
    for item in items:
        url = item.get("url", "")
        if url and url not in seen:
            seen.add(url)
            out.append(item)
    return out


async def gather_opportunity_listings(
    keywords: List[str],
    opportunity_type: str,
) -> tuple[List[dict], dict]:
    """
    Collect real postings from multiple sources:
    - Internshala scraping
    - RSS feeds (Unstop, HackerEarth, GitHub Jobs)
    - Adzuna API (Indian jobs)
    - JSearch API (broad job listings)
    - Remotive API (remote jobs)
    - Web search (DuckDuckGo)
    
    Returns (listings, stats).
    """
    tasks = []
    slugs = internshala_slugs_for_search(keywords, opportunity_type)

    internship_types = {
        "all", "internship", "internship_software", "internship_ai_ml",
        "internship_data", "internship_web", "internship_mobile", "internship_devops",
    }

    # Internshala (scrape)
    if opportunity_type in internship_types or opportunity_type == "all":
        if opportunity_type != "hackathon":
            for slug in slugs:
                tasks.append(("internshala", fetch_internshala_listings(slug)))

    # RSS feeds (free, no auth)
    if opportunity_type in {"all"} | internship_types:
        tasks.append(("rss_feeds", fetch_rss_feeds(keywords)))

    # Adzuna (free tier, Indian jobs)
    if opportunity_type in {"all", "job", "job_fresher"} | internship_types:
        tasks.append(("adzuna", fetch_adzuna_jobs(keywords)))

    # JSearch (free tier with API key)
    if opportunity_type in {"all", "job", "job_fresher"} | internship_types:
        tasks.append(("jsearch", fetch_jsearch_jobs(keywords)))

    # Remotive (free API, remote jobs)
    if opportunity_type in {"all", "job", "job_fresher"} | internship_types:
        tasks.append(("remotive", fetch_remotive_jobs(keywords)))

    # REMOVED: Web search (DuckDuckGo) - Adzuna provides live, structured Indian job market

    results: List[dict] = []
    stats = {
        "internshala": 0,
        "rss_feeds": 0,
        "adzuna": 0,
        "jsearch": 0,
        "remotive": 0,
    }

    if not tasks:
        return [], stats

    gathered = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

    for (source_name, _), batch in zip(tasks, gathered):
        if isinstance(batch, Exception):
            print(f"Source {source_name} failed: {batch}")
            continue
        stats[source_name] = stats.get(source_name, 0) + len(batch)
        results.extend(batch)

    # Filter: Remove listings older than 14 days
    from datetime import datetime, timedelta
    two_weeks_ago = datetime.utcnow() - timedelta(days=14)
    filtered_results = []
    
    for item in results:
        # Try to extract posting date
        posted_date = _extract_posting_date(item)
        
        # If we can parse the date and it's older than 14 days, skip it
        if posted_date and posted_date < two_weeks_ago:
            continue
        
        filtered_results.append(item)
    
    return _dedupe_by_url(filtered_results), stats
