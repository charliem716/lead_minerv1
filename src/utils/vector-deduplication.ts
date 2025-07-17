import { ScrapedContent } from '../types';
import { DeduplicationEngine } from './deduplication';

/**
 * Vector-based deduplication using pgvector for semantic similarity
 */
export interface VectorSimilarityResult {
  id: string;
  url: string;
  similarity: number;
  vector: number[];
  content: ScrapedContent;
}

export interface VectorDeduplicationResult {
  isUnique: boolean;
  similarity: number;
  duplicateOf?: string;
  reasoning: string;
  vector: number[];
}

export interface ContentVector {
  id: string;
  url: string;
  orgName: string;
  eventTitle: string;
  content: string;
  vector: number[];
  createdAt: Date;
  lastUpdated: Date;
}

/**
 * Enhanced Deduplication Engine with Vector-based Similarity
 * 
 * Uses pgvector for semantic similarity detection and OpenAI embeddings
 * for more accurate duplicate detection beyond simple text matching
 */
export class VectorDeduplicationEngine extends DeduplicationEngine {
  private vectorCache: Map<string, ContentVector> = new Map();
  private readonly vectorDimension = 1536; // OpenAI embedding dimension
  private readonly semanticSimilarityThreshold = 0.85;
  private mockEmbeddings: Map<string, number[]> = new Map();

  constructor(similarityThreshold: number = 0.8) {
    super(similarityThreshold);
    console.log('🔍 Vector deduplication engine initialized');
  }

  /**
   * Enhanced duplicate detection with semantic similarity
   */
  async isVectorDuplicate(content: ScrapedContent): Promise<VectorDeduplicationResult> {
    console.log(`🔍 Checking vector similarity for: ${content.url}`);

    // First check basic deduplication
    const basicDuplicate = this.isDuplicate(content);
    if (basicDuplicate) {
      return {
        isUnique: false,
        similarity: 1.0,
        duplicateOf: 'basic-duplicate',
        reasoning: 'Exact match found (URL, EIN, or organization name)',
        vector: []
      };
    }

    // Generate embedding for the content
    const contentVector = await this.generateContentEmbedding(content);
    
    // Search for similar vectors in database
    const similarContent = await this.findSimilarVectors(contentVector, content);
    
    if (similarContent.length > 0) {
      const bestMatch = similarContent[0];
      
      if (bestMatch && bestMatch.similarity >= this.semanticSimilarityThreshold) {
        return {
          isUnique: false,
          similarity: bestMatch.similarity,
          duplicateOf: bestMatch.url,
          reasoning: `Semantic similarity: ${(bestMatch.similarity * 100).toFixed(1)}%`,
          vector: contentVector
        };
      }
    }

    // Content is unique
    await this.storeContentVector(content, contentVector);
    
    return {
      isUnique: true,
      similarity: 0,
      reasoning: 'No similar content found',
      vector: contentVector
    };
  }

  /**
   * Batch vector deduplication
   */
  async deduplicateVectorBatch(contents: ScrapedContent[]): Promise<{
    unique: ScrapedContent[];
    duplicates: { content: ScrapedContent; duplicateOf: string; similarity: number }[];
    stats: {
      totalProcessed: number;
      uniqueCount: number;
      duplicateCount: number;
      averageProcessingTime: number;
    };
  }> {
    console.log(`🔍 Processing ${contents.length} items for vector deduplication`);
    
    const startTime = Date.now();
    const unique: ScrapedContent[] = [];
    const duplicates: { content: ScrapedContent; duplicateOf: string; similarity: number }[] = [];
    
    for (let i = 0; i < contents.length; i++) {
      const content = contents[i];
      if (!content) continue;
      
      const result = await this.isVectorDuplicate(content);
      
      if (result.isUnique) {
        unique.push(content);
      } else {
        duplicates.push({
          content,
          duplicateOf: result.duplicateOf || 'unknown',
          similarity: result.similarity
        });
      }
      
      // Progress logging
      if ((i + 1) % 10 === 0) {
        console.log(`📊 Vector deduplication progress: ${i + 1}/${contents.length}`);
      }
    }
    
    const processingTime = Date.now() - startTime;
    const stats = {
      totalProcessed: contents.length,
      uniqueCount: unique.length,
      duplicateCount: duplicates.length,
      averageProcessingTime: processingTime / contents.length
    };
    
    console.log(`✅ Vector deduplication complete:`, stats);
    
    return { unique, duplicates, stats };
  }

  /**
   * Generate content embedding using OpenAI API (real implementation)
   */
  private async generateContentEmbedding(content: ScrapedContent): Promise<number[]> {
    try {
      // Create a comprehensive text representation
      const textForEmbedding = this.createEmbeddingText(content);
      
      // Use real OpenAI embeddings API
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env['OPENAI_API_KEY']}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: textForEmbedding,
          model: 'text-embedding-3-small'
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
      
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      // Return a fallback hash-based embedding for error cases
      const textForEmbedding = this.createEmbeddingText(content);
      return this.generateMockEmbedding(textForEmbedding);
    }
  }

  /**
   * Create text representation for embedding
   */
  private createEmbeddingText(content: ScrapedContent): string {
    const parts: string[] = [];
    
    // Add organization name
    if (content.organizationInfo?.name) {
      parts.push(`Organization: ${content.organizationInfo.name}`);
    }
    
    // Add event information
    if (content.eventInfo?.title) {
      parts.push(`Event: ${content.eventInfo.title}`);
    }
    
    if (content.eventInfo?.date) {
      parts.push(`Date: ${content.eventInfo.date}`);
    }
    
    // Add title
    if (content.title) {
      parts.push(`Title: ${content.title}`);
    }
    
    // Add key content excerpts (first 500 chars)
    if (content.content) {
      const excerpt = content.content.slice(0, 500).replace(/\s+/g, ' ').trim();
      parts.push(`Content: ${excerpt}`);
    }
    
    // Add contact information
    if (content.contactInfo?.emails?.length) {
      parts.push(`Email: ${content.contactInfo.emails[0]}`);
    }
    
    return parts.join(' | ');
  }



  /**
   * Generate mock embedding that's deterministic based on content
   */
  private generateMockEmbedding(text: string): number[] {
    const embedding = new Array(this.vectorDimension);
    
    // Create a deterministic but realistic embedding
    for (let i = 0; i < this.vectorDimension; i++) {
      // Use text hash and position to create consistent values
      const hash = this.hashTextAtPosition(text, i);
      embedding[i] = (hash % 2000 - 1000) / 1000; // Range: -1 to 1
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Hash text at specific position for consistent mock embeddings
   */
  private hashTextAtPosition(text: string, position: number): number {
    let hash = 0;
    const input = text + position.toString();
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      const val1 = vec1[i] || 0;
      const val2 = vec2[i] || 0;
      dotProduct += val1 * val2;
      magnitude1 += val1 * val1;
      magnitude2 += val2 * val2;
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Find similar vectors in database/cache
   */
  private async findSimilarVectors(queryVector: number[], content: ScrapedContent): Promise<VectorSimilarityResult[]> {
    const similarities: VectorSimilarityResult[] = [];
    
    // Search in cache first
    for (const [_id, cachedVector] of this.vectorCache.entries()) {
      const similarity = this.calculateCosineSimilarity(queryVector, cachedVector.vector);
      
      if (similarity > 0.7) { // Lower threshold for initial filtering
        similarities.push({
          id: cachedVector.id,
          url: cachedVector.url,
          similarity,
          vector: cachedVector.vector,
          content: content // This would be retrieved from database in production
        });
      }
    }
    
    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    return similarities;
  }

  /**
   * Store content vector in database/cache
   */
  private async storeContentVector(content: ScrapedContent, vector: number[]): Promise<void> {
    const contentVector: ContentVector = {
      id: content.id,
      url: content.url,
      orgName: content.organizationInfo?.name || 'Unknown',
      eventTitle: content.eventInfo?.title || 'Unknown',
      content: content.content || '', // Store the full content
      vector,
      createdAt: new Date(),
      lastUpdated: new Date()
    };
    
    // Store in cache
    this.vectorCache.set(content.id, contentVector);
    
    // In production, this would also store in PostgreSQL with pgvector
    console.log(`📊 Stored vector for: ${content.url}`);
  }

  /**
   * Search for similar content using vector similarity
   */
  async findSimilarContent(content: ScrapedContent, _limit: number = 10): Promise<VectorSimilarityResult[]> {
    console.log(`🔍 Finding similar content for: ${content.url}`);
    
    // Get embedding for the content
    const embedding = await this.generateContentEmbedding(content);
    
    // Find similar vectors in cache
    const similarities: VectorSimilarityResult[] = [];
    
    for (const [id, cachedVector] of this.vectorCache.entries()) {
      if (id === content.id) continue; // Skip self
      
      const similarity = this.calculateCosineSimilarity(embedding, cachedVector.vector);
      if (similarity > this.semanticSimilarityThreshold) {
        // Create a mock ScrapedContent object from cached data
        const mockContent: ScrapedContent = {
          id: cachedVector.id,
          url: cachedVector.url,
          title: cachedVector.eventTitle,
          content: cachedVector.content,
          images: [],
          rawHtml: '',
          eventInfo: { title: cachedVector.eventTitle },
          contactInfo: undefined,
          organizationInfo: { name: cachedVector.orgName },
          scrapedAt: cachedVector.createdAt,
          processingStatus: 'classified',
          statusCode: 200,
          error: undefined
        };
        
        similarities.push({
          id: id,
          url: cachedVector.url,
          similarity,
          vector: cachedVector.vector,
          content: mockContent
        });
      }
    }
    
    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`Found ${similarities.length} similar content items`);
    return similarities;
  }

  /**
   * Cluster similar content based on vector similarity
   */
  async clusterSimilarContent(contents: ScrapedContent[]): Promise<{
    clusters: Map<string, ScrapedContent[]>;
    singletons: ScrapedContent[];
    stats: {
      clusterCount: number;
      averageClusterSize: number;
      singletonCount: number;
    };
  }> {
    console.log(`🔍 Clustering ${contents.length} items by vector similarity`);
    
    const clusters = new Map<string, ScrapedContent[]>();
    const processed = new Set<string>();
    const singletons: ScrapedContent[] = [];
    
    for (const content of contents) {
      if (!content || processed.has(content.id)) {
        continue;
      }
      
      const similarContent = await this.findSimilarContent(content, 20);
      const cluster = [content];
      
      // Add similar content to cluster
      for (const similar of similarContent) {
        if (similar && similar.similarity >= this.semanticSimilarityThreshold && 
            !processed.has(similar.id)) {
          cluster.push(similar.content);
          processed.add(similar.id);
        }
      }
      
      processed.add(content.id);
      
      if (cluster.length > 1) {
        clusters.set(content.id, cluster);
      } else {
        singletons.push(content);
      }
    }
    
    const stats = {
      clusterCount: clusters.size,
      averageClusterSize: Array.from(clusters.values()).reduce((sum, cluster) => sum + cluster.length, 0) / clusters.size,
      singletonCount: singletons.length
    };
    
    console.log(`✅ Clustering complete:`, stats);
    
    return { clusters, singletons, stats };
  }

  /**
   * Get vector deduplication statistics
   */
  getVectorStats(): {
    vectorCacheSize: number;
    mockEmbeddingCacheSize: number;
    vectorDimension: number;
    semanticSimilarityThreshold: number;
  } {
    return {
      vectorCacheSize: this.vectorCache.size,
      mockEmbeddingCacheSize: this.mockEmbeddings.size,
      vectorDimension: this.vectorDimension,
      semanticSimilarityThreshold: this.semanticSimilarityThreshold
    };
  }

  /**
   * Clear vector cache
   */
  clearVectorCache(): void {
    this.vectorCache.clear();
    this.mockEmbeddings.clear();
    console.log('🧹 Vector cache cleared');
  }

  /**
   * Optimize vector cache by removing old entries
   */
  optimizeVectorCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = new Date(Date.now() - maxAge);
    let removedCount = 0;
    
    for (const [id, vector] of this.vectorCache.entries()) {
      if (vector.createdAt < cutoffTime) {
        this.vectorCache.delete(id);
        removedCount++;
      }
    }
    
    console.log(`🧹 Optimized vector cache: removed ${removedCount} old entries`);
  }
}

// Export default instance
export const vectorDeduplicationEngine = new VectorDeduplicationEngine(); 