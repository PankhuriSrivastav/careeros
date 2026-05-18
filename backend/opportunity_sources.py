"""
Aggregate real job/internship postings from multiple sources (not platform homepages).
"""
from __future__ import annotations

import asyncio
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
    """Free public API — remote tech jobs filtered by resume keywords."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://remotive.com/api/remote-jobs")
        if resp.status_code != 200:
            return []
        jobs = resp.json().get("jobs", [])
    except Exception as exc:
        print(f"Remotive API error: {exc}")
        return []

    kw_lower = [k.lower() for k in keywords]
    results: List[dict] = []

    for job in jobs:
        blob = f"{job.get('title', '')} {job.get('tags', [])} {job.get('description', '')[:500]}".lower()
        if not any(k in blob for k in kw_lower):
            continue
        results.append({
            "title": f"{job.get('title', 'Role')} — {job.get('company_name', 'Company')}",
            "snippet": f"Remote · {job.get('job_type', 'Full-time')} · Posted {job.get('publication_date', '')[:10]}",
            "url": job.get("url", ""),
            "platform": "Remotive",
            "source": "remotive",
        })
        if len(results) >= max_jobs:
            break

    return results


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
    Collect real postings from Internshala scraping, web search, and job APIs.
  Returns (listings, stats).
    """
    tasks = []
    slugs = internshala_slugs_for_search(keywords, opportunity_type)

    internship_types = {
        "all", "internship", "internship_software", "internship_ai_ml",
        "internship_data", "internship_web", "internship_mobile", "internship_devops",
    }

    if opportunity_type in internship_types or opportunity_type == "all":
        if opportunity_type != "hackathon":
            for slug in slugs:
                tasks.append(("internshala", fetch_internshala_listings(slug)))

    if opportunity_type in {"all", "job", "job_fresher"} | internship_types:
        tasks.append(("remotive", fetch_remotive_jobs(keywords)))

    search_queries = build_detail_search_queries(keywords, opportunity_type)
    for q in search_queries:
        tasks.append(("web_search", search_job_postings_online(q)))

    results: List[dict] = []
    stats = {"internshala": 0, "remotive": 0, "web_search": 0}

    if not tasks:
        return [], stats

    gathered = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)

    for (source_name, _), batch in zip(tasks, gathered):
        if isinstance(batch, Exception):
            print(f"Source {source_name} failed: {batch}")
            continue
        stats[source_name] = stats.get(source_name, 0) + len(batch)
        results.extend(batch)

    return _dedupe_by_url(results), stats
