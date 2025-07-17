-- Lead Miner Database Schema
-- Week 1: Basic schema with pgvector extension for future deduplication

-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table - main table for storing qualified leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_name VARCHAR(255) NOT NULL,
    ein VARCHAR(20),
    event_name VARCHAR(255) NOT NULL,
    event_date DATE,
    event_date_range VARCHAR(100),
    url TEXT NOT NULL,
    travel_keywords BOOLEAN DEFAULT FALSE,
    auction_keywords BOOLEAN DEFAULT FALSE,
    us_verified BOOLEAN DEFAULT FALSE,
    geographic_region VARCHAR(100),
    score DECIMAL(3,2) CHECK (score >= 0 AND score <= 1),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    staff_size INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'contacted', 'converted', 'rejected')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search queries table - track search queries for analytics
CREATE TABLE IF NOT EXISTS search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,
    date_range VARCHAR(100),
    geographic VARCHAR(100),
    results_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Scraped content table - store raw scraped content
CREATE TABLE IF NOT EXISTS scraped_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL UNIQUE,
    title TEXT,
    content TEXT,
    images TEXT[], -- Array of image URLs
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'classified', 'failed')),
    -- Vector embedding for deduplication (to be implemented in Week 4)
    content_embedding vector(1536)
);

-- Classification results table - store AI classification results
CREATE TABLE IF NOT EXISTS classification_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    is_relevant BOOLEAN NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    has_auction_keywords BOOLEAN DEFAULT FALSE,
    has_travel_keywords BOOLEAN DEFAULT FALSE,
    reasoning TEXT,
    model_used VARCHAR(50),
    classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Nonprofit verification table - store verification results
CREATE TABLE IF NOT EXISTS nonprofit_verification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    ein VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    source VARCHAR(20) CHECK (source IN ('irs', 'guidestar', 'manual')),
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    additional_info JSONB
);

-- Budget tracking table - monitor API usage and costs
CREATE TABLE IF NOT EXISTS budget_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service VARCHAR(50) NOT NULL, -- 'openai', 'serpapi', 'google', etc.
    operation VARCHAR(100) NOT NULL, -- 'search', 'classify', 'sheets_write', etc.
    tokens_used INTEGER,
    cost_usd DECIMAL(10,4),
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_event_date ON leads(event_date);
CREATE INDEX IF NOT EXISTS idx_scraped_content_url ON scraped_content(url);
CREATE INDEX IF NOT EXISTS idx_search_queries_status ON search_queries(status);
CREATE INDEX IF NOT EXISTS idx_budget_tracking_date ON budget_tracking(date);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on leads table
CREATE TRIGGER update_leads_modtime 
    BEFORE UPDATE ON leads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_modified_column();

-- View for daily lead summary
CREATE OR REPLACE VIEW daily_lead_summary AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_leads,
    AVG(score) as avg_confidence,
    COUNT(CASE WHEN us_verified = true THEN 1 END) as verified_nonprofits,
    COUNT(CASE WHEN travel_keywords = true THEN 1 END) as travel_events,
    COUNT(CASE WHEN auction_keywords = true THEN 1 END) as auction_events
FROM leads
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View for budget summary
CREATE OR REPLACE VIEW daily_budget_summary AS
SELECT 
    date,
    service,
    SUM(cost_usd) as total_cost,
    COUNT(*) as operation_count
FROM budget_tracking
GROUP BY date, service
ORDER BY date DESC, service;

-- Insert initial configuration data
INSERT INTO budget_tracking (service, operation, tokens_used, cost_usd) 
VALUES ('system', 'initialization', 0, 0.00)
ON CONFLICT DO NOTHING; 