# Changes: Closed Opportunities Filtering & Registration Deadlines

## ✅ What's Fixed

### 1. **Closed Opportunities — Now Filtered Out**
Backend now detects and **excludes** listings with indicators like:
- "closed", "registration closed", "applications ended", "positions filled"
- "deadline passed", "expired", "not accepting applications"

**Result:** You'll never see closed opportunities in search results.

---

### 2. **Registration Deadline — Now Displayed**
Deadlines are extracted from listing text and shown with each result:
- Format: `📅 Closes: May 31` or `📅 Closes: 31 May`
- Orange badge for quick visibility
- Appears below platform/source tags

---

### 3. **More Results Displayed**
- **Before:** API showed 68 total but only 20 in UI
- **Now:** Shows up to **50 results** (all available after filtering)
- If backend finds 68, you'll see up to 50 (best matches sorted first)

---

## Backend Changes (`main.py`)

### New Helper Functions

```python
def is_opportunity_closed(title: str, snippet: str) -> bool:
    """Detects if listing is closed (looks for 'closed', 'ended', 'expired', etc.)"""
    # Returns True if opportunity is marked as closed

def extract_registration_deadline(title: str, snippet: str) -> Optional[str]:
    """Extracts deadline date from listing text"""
    # Returns: "May 31", "31 May", "31/5", etc. or None
```

### Updated Function

```python
def score_opportunity_results(...):
    # Now skips closed opportunities: if is_opportunity_closed(...): continue
    # Now extracts deadline: registration_deadline = extract_registration_deadline(...)
    # Returns deadline in each result
```

### Updated Endpoint

```python
@app.get("/api/opportunities/search")
    # Changed: "results": scored_results[:20] → scored_results[:50]
```

---

## Frontend Changes (`page.tsx`)

### Updated Interface

```typescript
interface SearchResult {
  ...existing fields...
  registration_deadline?: string | null;  // NEW
}
```

### Updated Display

```tsx
{result.registration_deadline && (
  <span className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full font-medium">
    📅 Closes: {result.registration_deadline}
  </span>
)}
```

---

## Example

### Before:
```
Python Developer Internship — Company X
3-month internship in Bangalore · via internshala
🟢 85% match  🟦 High Trust (92)

[Apply / View] [Track]
```

### After:
```
Python Developer Internship — Company X
3-month internship in Bangalore · via internshala  📅 Closes: May 31
🟢 85% match  🟦 High Trust (92)

[Apply / View] [Track]
```

---

## What Happens Now

1. **User searches** → Backend aggregates from 7+ sources
2. **Backend filters** → Removes closed opportunities
3. **Backend extracts** → Pulls registration deadlines
4. **Frontend receives** → Up to 50 results with deadline info
5. **User sees** → Deadline badge on each active opportunity

---

## If Deadline Not Found

- Field is `null` or omitted
- No deadline badge shown
- Result still displays normally

---

## Next Steps

1. **Test locally:** Search in dashboard → see up to 50 results
2. **Look for deadlines:** Should see orange `📅 Closes: ...` badges
3. **Verify filtering:** Shouldn't see any "closed" or "expired" listings

---

## Technical Details

### Deadline Regex Patterns
Extracts patterns like:
- "Deadline: May 31"
- "Closes by: June 15"
- "Apply by: 31 May"
- "Registration closes: 20 May"
- "May 15 (bare date)"

### Closed Detection
Matches these keywords (case-insensitive):
- closed, registration closed, applications closed, registration ended, applications ended
- hiring complete, positions filled, no longer accepting, deadline passed, expired
- ended, closed on, registration deadline passed, unfortunately closed, not accepting applications
