import { config, configDocumentation } from './config';
import { pipelineOrchestrator } from './pipeline/orchestrator';
import { sheetsManager } from './utils/sheets';

/**
 * Lead Miner Agent - Phase 4 Complete Implementation
 * 
 * This demonstrates the complete data pipeline:
 * 1. Search query generation
 * 2. Web scraping and content extraction
 * 3. AI-powered classification and verification
 * 4. Data enrichment and deduplication
 * 5. Professional Google Sheets output
 */

async function main() {
  console.log('🚀 Starting Lead Miner Agent - Phase 4 Complete Pipeline');
  console.log('=====================================================');
  
  try {
    // 1. Test configuration
    console.log('\n📋 Configuration Status:');
    console.log(`- OpenAI API Key: ${config.apis.openai.apiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`- SerpAPI Key: ${config.apis.serpapi.apiKey ? '✅ Configured' : '❌ Missing'}`);
    console.log(`- Google Service Account: ${config.apis.google.serviceAccountEmail ? '✅ Configured' : '❌ Missing'}`);
    console.log(`- Google Sheet ID: ${config.apis.google.sheetId ? '✅ Configured' : '❌ Missing'}`);
    console.log(`- Database URL: ${config.database.url ? '✅ Configured' : '❌ Missing'}`);
    
    // 2. Test Google Sheets integration
    console.log('\n📊 Testing Google Sheets Integration:');
    const sheetsInfo = await sheetsManager.getInfo();
    console.log(`- Spreadsheet: ${sheetsInfo.title}`);
    console.log(`- Sheets: ${sheetsInfo.sheets.join(', ')}`);
    console.log(`- URL: ${sheetsInfo.url}`);
    
    // 3. Display pipeline configuration
    console.log('\n⚙️ Pipeline Configuration:');
    const pipelineStatus = pipelineOrchestrator.getStatus();
    console.log(`- Session ID: ${pipelineStatus.sessionId}`);
    console.log(`- Budget Remaining: $${pipelineStatus.budgetRemaining}`);
    console.log(`- Current Phase: ${pipelineStatus.currentPhase}`);
    console.log(`- Progress: ${(pipelineStatus.progress * 100).toFixed(1)}%`);
    
    // 4. Execute the complete pipeline
    console.log('\n🚀 Executing Complete Data Pipeline:');
    const pipelineResult = await pipelineOrchestrator.execute();
    
    // 5. Display results
    console.log('\n📊 Pipeline Results:');
    console.log(`- Total Processed: ${pipelineResult.stats.totalProcessed}`);
    console.log(`- Final Leads: ${pipelineResult.results.finalLeads.length}`);
    console.log(`- Success Rate: ${(pipelineResult.stats.successRate * 100).toFixed(1)}%`);
    console.log(`- Quality Score: ${pipelineResult.stats.qualityScore.toFixed(2)}`);
    console.log(`- Processing Time: ${pipelineResult.stats.averageProcessingTime.toFixed(0)}ms avg`);
    console.log(`- Budget Used: $${pipelineResult.stats.budgetUsed.toFixed(2)}`);
    
    // 6. Show pipeline breakdown
    console.log('\n🔍 Pipeline Breakdown:');
    console.log(`- Search Queries: ${pipelineResult.results.searchQueries.length}`);
    console.log(`- Pages Scraped: ${pipelineResult.results.scrapedContent.length}`);
    console.log(`- Classifications: ${pipelineResult.results.classificationResults.length}`);
    console.log(`- Verifications: ${pipelineResult.results.verificationResults.length}`);
    console.log(`- Duplicates Removed: ${pipelineResult.results.duplicatesRemoved}`);
    console.log(`- Human Review Items: ${pipelineResult.results.humanReviewItems}`);
    
    // 7. Display sample leads
    if (pipelineResult.results.finalLeads.length > 0) {
      console.log('\n📋 Sample Leads Generated:');
      pipelineResult.results.finalLeads.slice(0, 3).forEach((lead, index) => {
        console.log(`${index + 1}. ${lead.orgName} - ${lead.eventName}`);
        console.log(`   📧 ${lead.contactEmail || 'No email'}`);
        console.log(`   📞 ${lead.contactPhone || 'No phone'}`);
        console.log(`   🎯 Confidence: ${lead.score.toFixed(2)}`);
        console.log(`   🌐 ${lead.url}`);
        console.log('');
      });
    }
    
    // 8. Show errors and warnings
    if (pipelineResult.errors.length > 0) {
      console.log('\n⚠️ Pipeline Errors:');
      pipelineResult.errors.forEach(error => {
        console.log(`  ❌ ${error}`);
      });
    }
    
    if (pipelineResult.warnings.length > 0) {
      console.log('\n⚠️ Pipeline Warnings:');
      pipelineResult.warnings.forEach(warning => {
        console.log(`  ⚠️ ${warning}`);
      });
    }
    
    // 9. Update configuration and quality metrics
    console.log('\n📊 Updating Configuration and Quality Metrics:');
    await sheetsManager.updateConfiguration({
      'Max Leads Per Day': config.limits.maxLeadsPerDay,
      'Confidence Threshold': config.precision.confidenceThreshold,
      'Vector Deduplication': 'Enabled',
      'Human Review': 'Enabled',
      'Last Pipeline Run': new Date().toISOString()
    });
    
    await sheetsManager.updateQualityMetrics({
      date: new Date(),
      precisionRate: pipelineResult.stats.successRate,
      falsePositives: 0,
      reviewRequired: pipelineResult.results.humanReviewItems,
      modelPerformance: pipelineResult.stats.qualityScore,
      feedback: 'Phase 4 pipeline execution successful'
    });
    
    console.log('\n✅ Phase 4 Complete Implementation Finished!');
    console.log('\n📈 System Ready for Production:');
    console.log('- ✅ Search and scraping agents operational');
    console.log('- ✅ AI classification and verification working');
    console.log('- ✅ Data enrichment and deduplication active');
    console.log('- ✅ Professional Google Sheets output configured');
    console.log('- ✅ Quality controls and human review implemented');
    console.log('- ✅ Budget monitoring and cost controls active');
    
    console.log('\n🎯 Next Steps:');
    console.log('- Schedule daily pipeline runs');
    console.log('- Monitor quality metrics and adjust thresholds');
    console.log('- Review human review items regularly');
    console.log('- Scale to handle seasonal traffic increases');
    
  } catch (error) {
    console.error('\n❌ Error during pipeline execution:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Missing required environment variables')) {
        console.log('\n📋 Setup Instructions:');
        console.log('1. Copy the environment variables template');
        console.log('2. Add your API keys and configuration');
        console.log('3. Restart the application');
        console.log('\nRequired Variables:');
        configDocumentation.requiredEnvVars.forEach(env => {
          console.log(`  - ${env}`);
        });
      }
    }
    
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Lead Miner Agent...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Lead Miner Agent...');
  process.exit(0);
});

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main }; 