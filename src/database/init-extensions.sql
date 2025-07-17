-- Initialize PostgreSQL extensions for Lead-Miner Agent
-- This script runs before the main schema.sql

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for text similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable fuzzystrmatch for fuzzy string matching
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Lead-Miner Agent database extensions initialized successfully';
END $$; 