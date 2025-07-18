# Lead-Miner Quick Fix Plan

## 🚨 Current Issues Summary

**Critical Problem:** System returns 0-1 leads per run instead of guaranteed 5+

### Test Results:
- ❌ **Final Leads:** 0 (should be 5+)
- ❌ **Organizations Found:** Only 2 repeating (Cake4Kids, IFEA)
- ❌ **Debug Logs:** Not appearing in systemd
- ❌ **Search Diversity:** Limited to same results
- ❌ **Minimum Leads Logic:** Not triggering

## 📋 Systematic Resolution Plan

### Phase 1: Fix Logging & Visibility (HIGH PRIORITY)

**Problem:** Console.log statements not captured in systemd logs

**Solution:**
```typescript
// Add file-based logging
const fs = require('fs');
const logFile = path.join(this.persistenceDir, 'pipeline-execution.log');
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
};
```

**Implementation Steps:**
1. Create logging utility function
2. Replace all console.log with new log function
3. Add log rotation to prevent file size issues
4. Create separate debug.log for detailed debugging

### Phase 2: Expand Search Diversity (HIGH PRIORITY)

**Problem:** Only finding 2 organizations repeatedly

**Solution:**
1. Increase search result processing: 3 → 5 per query
2. Add diverse query patterns
3. Implement state rotation
4. Add event type variations

**Code Changes:**
```typescript
// Before
for (const result of searchResults.slice(0, 3)) {

// After  
for (const result of searchResults.slice(0, 5)) {
```

**New Query Patterns:**
- Healthcare: "hospital gala", "medical center auction"
- Education: "school fundraiser", "university benefit"
- Arts: "museum gala", "theater auction"
- Community: "rotary club", "chamber of commerce"

### Phase 3: Lower Quality Thresholds (HIGH PRIORITY)

**Problem:** Too few leads qualifying with 75% confidence

**Solution:**
```typescript
// src/config/index.ts
confidenceThreshold: parseFloat(process.env['CONFIDENCE_THRESHOLD'] || '0.60'), // Down from 0.75
```

**Tiered Classification:**
- High confidence: 80%+ (auto-approve)
- Medium confidence: 60-79% (include with flag)
- Low confidence: <60% (exclude)

### Phase 4: Fix Search Processing (MEDIUM PRIORITY)

**Problem:** Only processing 2 pages despite 35 queries

**Investigation Steps:**
1. Add logging after each search query
2. Check if queries are timing out
3. Verify batch processing logic
4. Remove artificial limits

**Code Fix:**
```typescript
// Remove or increase this limit
for (let i = 0; i < limitedQueries.length && scrapedContent.length < targetLeads * 10; i += batchSize) {
```

### Phase 5: Implement Robust Minimum Leads Logic (HIGH PRIORITY)

**Problem:** Additional processing not triggering when <5 leads

**Solution:**
```typescript
// Guarantee minimum leads with progressive strategy
let attempts = 0;
const maxAttempts = 3;

while (this.results.results.finalLeads.length < 5 && attempts < maxAttempts) {
  attempts++;
  console.log(`Attempt ${attempts}: Only ${this.results.results.finalLeads.length} leads, need 5+`);
  
  // Progressive strategy:
  // 1. Generate 10 more queries
  const additionalQueries = await this.generateAdditionalSearchQueries();
  
  // 2. Lower confidence threshold by 0.05
  const tempThreshold = config.precision.confidenceThreshold - (0.05 * attempts);
  
  // 3. Process with relaxed criteria
  const moreContent = await this.realSearchAndScrape(additionalQueries);
  // ... continue processing
}
```

### Phase 6: Add Search Query Diversity (MEDIUM PRIORITY)

**Problem:** Limited variety in search queries

**Query Categories to Add:**
```javascript
const queryCategories = {
  healthcare: [
    '"hospital foundation" "travel auction"',
    '"medical center" "gala" "vacation package"',
    '"children\'s hospital" "benefit dinner"'
  ],
  education: [
    '"school auction" "travel package"',
    '"PTA fundraiser" "vacation raffle"',
    '"university alumni" "charity auction"'
  ],
  arts: [
    '"museum gala" "travel auction"',
    '"symphony" "benefit" "vacation"',
    '"theater company" "fundraiser auction"'
  ],
  seasonal: [
    '"spring gala" "auction" 2025',
    '"fall fundraiser" "travel package"',
    '"holiday benefit" "vacation auction"'
  ],
  geographic: [
    // Rotate through all 50 states
    '"Texas nonprofit" "auction"',
    '"California charity" "gala"',
    '"New York foundation" "benefit"'
  ]
};
```

### Phase 7: Improve Deduplication Logic (LOW PRIORITY)

**Problem:** Overly aggressive deduplication

**Solution:**
1. Allow same org with different event dates
2. Add similarity scoring instead of binary
3. Log deduplication decisions

**Code Update:**
```typescript
// More nuanced deduplication
const isDuplicate = (lead1, lead2) => {
  // Same org + same date = duplicate
  if (lead1.orgName === lead2.orgName && 
      lead1.eventDate === lead2.eventDate) {
    return true;
  }
  
  // Same org but different date = not duplicate
  return false;
};
```

## 🚀 Quick Wins Implementation Order

### Day 1 - Immediate Fixes:
1. [ ] Lower confidence threshold to 60%
2. [ ] Increase results per query from 3 to 5
3. [ ] Add file-based logging
4. [ ] Remove/increase targetLeads * 4 limit

### Day 2 - Core Fixes:
1. [ ] Implement minimum leads guarantee loop
2. [ ] Add query diversity templates
3. [ ] Fix search processing bottleneck
4. [ ] Test with fresh data

### Day 3 - Polish:
1. [ ] Fine-tune deduplication
2. [ ] Add performance metrics
3. [ ] Create monitoring dashboard
4. [ ] Document configuration options

## 📊 Success Metrics

1. **Minimum 5 qualified leads per run** (required)
2. **Lead diversity:** 3+ different organizations
3. **Execution time:** <2 minutes
4. **Success rate:** 90%+ achieve target
5. **Geographic spread:** Multiple states

## 🧪 Testing Plan

### Test 1: Basic Functionality
- Clear all data
- Run pipeline
- Verify 5+ leads returned

### Test 2: Diversity Check
- Run 3 consecutive times
- Verify different organizations each run
- Check geographic distribution

### Test 3: Performance
- Measure execution time
- Monitor resource usage
- Check for memory leaks

### Test 4: Edge Cases
- Test with poor internet
- Test with rate limiting
- Test with no results scenario

## 🔧 Configuration Changes

### Environment Variables:
```bash
CONFIDENCE_THRESHOLD=0.60
MAX_SEARCH_RESULTS=5
MIN_LEADS_PER_RUN=5
MAX_SEARCH_ATTEMPTS=3
ENABLE_DEBUG_LOGGING=true
```

### Pipeline Config:
```typescript
{
  maxLeads: 100,  // Increased from 10
  maxSearchQueries: 50,  // Increased from 25
  minLeadsRequired: 5,  // New parameter
  confidenceThreshold: 0.60,  // Lowered from 0.75
  searchResultsPerQuery: 5,  // Increased from 3
  enableProgressiveSearch: true  // New feature
}
```

## 📝 Notes

- Current system finds quality leads but quantity is insufficient
- Main bottleneck appears to be overly strict filtering
- Search diversity needs significant improvement
- Logging issues make debugging difficult
- Deduplication might be too aggressive

## ✅ Definition of Done

- [ ] Consistently returns 5+ leads per run
- [ ] Leads come from diverse organizations
- [ ] Execution completes in <2 minutes
- [ ] All changes documented
- [ ] Tests pass 90%+ of the time
- [ ] Logging provides clear debugging info 