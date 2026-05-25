# Coding Round Intel - Feature Guide

## Overview
Coding Round Intel analyzes a student's actual DSA practice history from LeetCode and HackerRank, compares it against what target companies test, and provides:
- **Coverage analysis** - What topics you need to study
- **Priority ranking** - Which gaps matter most (by company frequency)
- **Learning timeline** - How long to close each gap at your pace
- **Study plan** - AI-generated week-by-week prep (via Gemini)

---

## Getting Started

### 1. Upload Your Practice History
Three options on `/coding-intel`:

**LeetCode:**
1. Go to `leetcode.com → Profile → Downloads`
2. Download CSV of problems
3. Drag & drop or click to upload

**HackerRank:**
1. Go to `hackerrank.com → Profile → Submission History`
2. Download CSV
3. Upload same way

**Manual:**
- Grid of 15 DSA topics
- Enter number of problems solved in each
- Submit to save

### 2. Select Target Companies
- Search 25+ companies (Google, Amazon, Flipkart, Zepto, etc.)
- Click to select multiple (chips turn blue)
- Click "Analyze My Gaps"

### 3. View Results
Three sections appear:

**❌ Critical Gaps**
- Red cards = less than 60% coverage
- Shows: your count vs expected, companies needing this, weeks to close
- Sample problems + resources

**⚠️ Partial Coverage** 
- Yellow cards = 60-99% coverage
- Need more practice before ready

**✅ Covered Topics**
- Green pills = 100%+ coverage
- Collapsed by default

---

## How It Works

### CSV Parsing
- **LeetCode**: Filters by `IsAccepted=True`, extracts `TopicTags`, maps to standard topics
- **HackerRank**: Filters by `Status=Solved`, uses `Subdomain` as topic
- Both calculate **weekly pace** from solve dates (avg problems/week)

### Topic Normalization
All platforms map to 15 standard topics:
- Dynamic Programming, Trees, Graphs, Arrays, Linked Lists, Binary Search, Sorting
- Hashmaps, Strings, Recursion, Heaps, Tries, Greedy, Math/Bit Manipulation, Stack/Queue

### Coverage Formula
```
coverage = user_solved / company_expected

>= 1.0  → Covered ✅
>= 0.6  → Partial ⚠️
< 0.6   → Critical ❌
```

### Priority Ranking
Gaps are sorted by **cross-company frequency**:
- Topic needed by Google + Amazon + Microsoft = Priority 1
- Topic needed by Google + Amazon = Priority 2
- Topic needed by Google only = Priority 3

### Learning Timeline
```
weeks_to_close = problems_needed / weekly_pace
```
Example: Need 15 DP problems, solving 5/week = 3 weeks

---

## Database Schema

### `coding_profiles` Table
```sql
id              INTEGER PRIMARY KEY
user_id         UUID (FK)
source          STRING - "leetcode", "hackerrank", "manual", "combined"
topic_counts    JSON - {"topic": count, ...}
difficulty_breakdown JSON - {"topic": {"easy": X, "medium": Y, "hard": Z}, ...}
total_solved    INTEGER
weekly_pace     FLOAT - problems per week
created_at      DATETIME
updated_at      DATETIME
```

---

## API Endpoints

### Parse Upload
```
POST /api/coding-intel/parse/leetcode
POST /api/coding-intel/parse/hackerrank
Content-Type: multipart/form-data
```

### Save Profile
```
POST /api/coding-intel/profile
{
  "source": "combined",
  "topic_counts": {...},
  "difficulty_breakdown": {...},
  "total_solved": 234,
  "weekly_pace": 8.5
}
```

### Analyze Gaps
```
POST /api/coding-intel/analyze
{
  "companies": ["Google", "Amazon"],
  "profile_id": 42
}

Response: {
  "critical_gaps": [...],
  "partial_gaps": [...],
  "covered_topics": [...],
  "summary": {...}
}
```

### Generate Study Plan
```
POST /api/coding-intel/study-plan
{
  "company": "Google",
  "weeks_until_interview": 3,
  "hours_per_day": 2.0,
  "critical_gaps": [...]
}

Response: {
  "study_plan": "Week 1: Focus on DP...",
  "company": "Google",
  "weeks": 3
}
```

### Get Resources
```
GET /api/coding-intel/resources/{topic}

Response: {
  "must_solve": [
    {
      "name": "Climbing Stairs",
      "difficulty": "Easy",
      "url": "...",
      "why": "Classic intro to DP"
    }
  ],
  "youtube": {...},
  "article": {...}
}
```

---

## Company Database

### Supported Companies (25)
**Big Tech:** Google, Microsoft, Amazon, Apple, Meta

**Indian Products:** Flipkart, Swiggy, Zomato, Razorpay, CRED, Zepto, PhonePe, Groww, Meesho, Paytm, Ola

**MNC India Offices:** Adobe, Cisco, Synopsys, Qualcomm, Samsung, Intuit, Oracle, SAP, Atlassian, Walmart Global Tech

Each company has:
- Topics they test
- Expected problem count per topic
- Difficulty level
- Priority ranking

---

## Key Features

✅ **Profile Persistence** - Save once, reuse forever  
✅ **Multi-source** - Combine LeetCode + HackerRank + manual entries  
✅ **Smart Priority** - Gaps ranked by company frequency  
✅ **Pace-aware** - Study timeline based on YOUR solving speed  
✅ **Curated Resources** - 60+ hand-picked problems per topic  
✅ **AI Study Plans** - Gemini generates personalized week-by-week plans  
✅ **Topic Mastery** - 15-topic standardized framework (no confusion across platforms)

---

## Integration Points

### Dashboard
- "📊 Coding Intel" button in header (all pages)
- Link from `/dashboard` to `/coding-intel`

### Skill Gap Analyzer (Future)
- Link: "See DSA gaps for this company →"
- Opens Coding Intel with company pre-selected

### AI Mock Interviewer (Future)
- Coding Intel gaps feed into question generator
- "You're weak on DP for Google. Here's a medium DP problem."

---

## Example Workflow

1. **User**: Opens `/coding-intel`
2. **Upload**: LeetCode CSV (234 problems across 12 topics)
3. **Search**: Adds Google, Amazon, Meta
4. **Analysis**: 
   - Critical: DP (3 solved vs 20 expected for Google+Amazon+Meta)
   - Partial: Graphs (8 solved vs 15 expected)
   - Covered: Arrays (22 solved vs 20 expected)
5. **Timeline**: "Close DP gap in 2 weeks at 8 problems/week"
6. **Resources**: Click DP → shows Climbing Stairs, Coin Change, etc.
7. **Plan**: "Generate study plan" → Gemini creates week-by-week roadmap

---

## Data Files

### `company_dsa_patterns.json`
25 companies × 6-8 topics each with:
- frequency (high/medium)
- expected_problems (count)
- difficulty (easy-medium, medium, medium-hard)
- priority (1-4)

### `dsa_resources.json`
15 topics × 4-5 must-solve problems + YouTube + article for each

---

## Next Steps

1. ✅ Database migration (run locally, push)
2. ✅ Backend implemented
3. ✅ Frontend implemented
4. 🔄 Add integration with existing features
5. 🔄 Test with real LeetCode/HackerRank exports
6. 🔄 Gemini API testing (study plan generation)
7. 🔄 Edge case handling (invalid CSVs, missing data)
