# Lead-Miner System Full Testing Plan

## **Executive Summary**
Comprehensive testing plan to diagnose and fix the lead-miner system that should be generating 50 leads/day from nonprofit travel auction events across the country. SerpAPI is showing usage, indicating search functionality works, but no leads are appearing in Google Sheets.

## **Phase 1: Component Isolation Testing (30 min)**

### **1.1 API Connectivity Tests**
- **OpenAI API**: Test classification and embedding generation
- **SerpAPI**: Verify search results are being returned
- **Google Sheets**: Confirm write permissions and connection
- **ProPublica Nonprofit API**: Test nonprofit verification

### **1.2 Search Agent Deep Dive**
- Test individual search queries manually
- Verify search result parsing
- Check geographic filtering logic
- Validate query generation strategy

### **1.3 Scraper Agent Analysis**
- Test URL scraping functionality
- Check content extraction quality
- Verify rate limiting compliance
- Analyze scraped content structure

## **Phase 2: Pipeline Flow Analysis (45 min)**

### **2.1 Data Flow Verification**
- Trace data from search → scrape → classify → verify → sheets
- Check for data loss between pipeline stages
- Verify JSON structure integrity
- Monitor memory usage and performance

### **2.2 Classification Agent Testing**
- Test business model classification logic
- Verify confidence scoring accuracy
- Check travel/auction keyword detection
- Validate nonprofit vs B2B filtering

### **2.3 Nonprofit Verification Testing**
- Test EIN extraction from scraped content
- Verify IRS/ProPublica API calls
- Check verification result processing
- Validate confidence thresholds

## **Phase 3: Configuration & Filtering Analysis (30 min)**

### **3.1 Search Query Strategy**
- Review current search terms for effectiveness
- Test query variations manually in Google
- Optimize for higher result volume
- Validate geographic targeting

### **3.2 Filter Threshold Analysis**
- Review confidence thresholds (currently 0.85)
- Test with relaxed thresholds temporarily
- Analyze classification rejection rates
- Optimize for 50 leads/day target

### **3.3 Geographic & Temporal Settings**
- Verify state targeting configuration
- Check date range filtering logic
- Test month/quarter restrictions
- Validate event date parsing

## **Phase 4: End-to-End Integration Testing (45 min)**

### **4.1 Minimal Viable Test**
- Run pipeline with single state (CA)
- Use relaxed confidence threshold (0.7)
- Limit to 5 search queries
- Monitor complete execution

### **4.2 Incremental Scaling**
- Gradually increase search scope
- Add more states progressively
- Increase query limits
- Monitor performance impact

### **4.3 Production Configuration**
- Test full 50-state configuration
- Verify 50 queries/day limit
- Confirm 50 leads/day capacity
- Validate cost monitoring

## **Phase 5: Output & Monitoring Verification (30 min)**

### **5.1 Google Sheets Integration**
- Test lead writing functionality
- Verify data formatting
- Check sheet permissions
- Validate real-time updates

### **5.2 Quality Assurance**
- Manual verification of sample leads
- Check for duplicate detection
- Validate nonprofit authenticity
- Confirm travel auction relevance

### **5.3 Performance Monitoring**
- Cost tracking accuracy
- API rate limit compliance
- Error handling effectiveness
- Execution time optimization

## **Testing Tools & Commands**

### **Individual Component Tests**
```bash
# Test Search Agent
node -e "require('./dist/agents/search-agent').SearchAgent.prototype.executeSearch({query: 'nonprofit travel auction California'})"

# Test Classification
node -e "require('./dist/agents/classifier-agent').ClassifierAgent.prototype.classifyContent(testContent)"

# Test Nonprofit Verification
node -e "require('./dist/agents/nonprofit-verifier').NonprofitVerifier.prototype.verifyByName('American Red Cross')"

# Test Sheets Connection
node -e "require('./dist/utils/sheets').sheetsManager.writeHelloWorld()"
```

### **Pipeline Flow Tests**
```bash
# Minimal test run
timeout 60 node dist/production-app.js --once

# Debug mode with verbose logging
DEBUG=* timeout 120 node dist/production-app.js --once

# Single state test
SEARCH_STATES=CA timeout 90 node dist/production-app.js --once
```

### **Configuration Tests**
```bash
# Test with relaxed thresholds
CONFIDENCE_THRESHOLD=0.6 MAX_LEADS_PER_DAY=10 timeout 60 node dist/production-app.js --once

# Geographic targeting test
TARGET_STATES=CA,NY,TX timeout 90 node dist/production-app.js --once
```

## **Success Criteria**

### **Phase 1 Success**
- [ ] All APIs respond successfully
- [ ] Search returns >0 results
- [ ] Scraper extracts content
- [ ] Classification processes content

### **Phase 2 Success**
- [ ] Data flows through all pipeline stages
- [ ] No data loss between components
- [ ] Classification identifies relevant content
- [ ] Nonprofit verification works

### **Phase 3 Success**
- [ ] Search queries return relevant results
- [ ] Filters allow appropriate content through
- [ ] Geographic targeting works
- [ ] Confidence thresholds are optimal

### **Phase 4 Success**
- [ ] End-to-end pipeline completes
- [ ] Generates >0 qualified leads
- [ ] Scales to full configuration
- [ ] Meets performance requirements

### **Phase 5 Success**
- [ ] Leads written to Google Sheets
- [ ] Data quality meets standards
- [ ] No duplicates or false positives
- [ ] System ready for production

## **Expected Issues & Solutions**

### **High Probability Issues**
1. **No Search Results**: Queries too specific → Broaden search terms
2. **Classification Rejecting All**: Threshold too high → Lower to 0.6-0.7
3. **Scraping Failures**: Rate limits → Add delays, respect robots.txt
4. **Verification Failures**: API limits → Implement fallback logic

### **Medium Probability Issues**
1. **Geographic Filtering**: State detection logic → Test with known locations
2. **Date Parsing**: Event date extraction → Validate regex patterns
3. **Content Quality**: Insufficient text → Improve scraping selectors
4. **API Rate Limits**: Too many requests → Implement exponential backoff

### **Low Probability Issues**
1. **Memory Leaks**: Large dataset processing → Monitor memory usage
2. **Authentication**: API key expiration → Refresh credentials
3. **Network Issues**: Connectivity problems → Add retry logic
4. **Database Corruption**: Data integrity → Implement validation

## **Rollback Plan**
If issues arise during testing:
1. **Immediate**: Stop current pipeline execution
2. **Revert**: Return to last known working configuration
3. **Isolate**: Test individual components separately
4. **Debug**: Use verbose logging to identify root cause
5. **Fix**: Apply targeted solution and retest

## **Timeline**
- **Total Duration**: 3 hours
- **Phase 1**: 30 minutes (API & Component Tests)
- **Phase 2**: 45 minutes (Pipeline Analysis)
- **Phase 3**: 30 minutes (Configuration Review)
- **Phase 4**: 45 minutes (Integration Testing)
- **Phase 5**: 30 minutes (Output Verification)

## **Next Steps After Testing**
1. Document all findings in test results
2. Implement identified fixes
3. Deploy optimized configuration
4. Monitor production performance
5. Establish daily monitoring routine

---

**Goal**: System generating 50 qualified nonprofit travel auction leads daily by end of testing period. 