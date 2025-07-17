import OpenAI from 'openai';
import { config } from '../config';

/**
 * Hello World Agent - Basic test agent for Lead Miner system
 * This agent serves as a foundation and testing ground for our lead generation system
 */
export class HelloWorldAgent {
  private openai: OpenAI;
  private agentName: string;
  private instructions: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.apis.openai.apiKey,
    });
    
    this.agentName = 'Lead Miner Hello World Agent';
    this.instructions = `
      You are a test agent for the Lead Miner system. 
      Your job is to validate that the basic agent infrastructure is working.
      
      When asked to test, respond with:
      1. A confirmation that the agent is working
      2. Current configuration status
      3. A simple greeting message
      
      Keep responses concise and informative.
    `;
  }

  /**
   * Test the basic agent functionality
   */
  async testAgent(): Promise<string> {
    const testPrompt = `
      Please perform a basic test of the Lead Miner system.
      Report on:
      1. Agent status
      2. Configuration validation
      3. Ready for next steps
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.apis.openai.simpleModel || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: this.instructions },
          { role: 'user', content: testPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || 'No response received';
    } catch (error) {
      console.error('Agent test failed:', error);
      throw new Error(`Agent test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test Google Sheets integration readiness
   */
  async testSheetsIntegration(): Promise<string> {
    const testPrompt = `
      Verify that we're ready to integrate with Google Sheets for lead tracking.
      Check if we have the necessary configuration for:
      1. Google Service Account
      2. Sheet ID
      3. Required permissions
      
      Respond with readiness status.
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.apis.openai.simpleModel || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: this.instructions },
          { role: 'user', content: testPrompt }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || 'No response received';
    } catch (error) {
      console.error('Sheets integration test failed:', error);
      throw new Error(`Sheets integration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a test lead entry for Google Sheets
   */
  async generateTestLead(): Promise<string> {
    const testPrompt = `
      Generate a sample lead entry for testing our Google Sheets integration.
      Create a realistic but fictional nonprofit organization with:
      1. Organization name
      2. Event name (travel auction/raffle)
      3. Event date
      4. Location
      5. Contact information
      6. Confidence score

      Format as JSON for easy processing.
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: config.apis.openai.simpleModel || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: this.instructions },
          { role: 'user', content: testPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      return completion.choices[0]?.message?.content || 'No response received';
    } catch (error) {
      console.error('Test lead generation failed:', error);
      throw new Error(`Test lead generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get agent information
   */
  getAgentInfo(): { name: string; model: string; configured: boolean } {
    return {
      name: this.agentName,
      model: config.apis.openai.simpleModel || 'gpt-4.1-mini',
      configured: !!config.apis.openai.apiKey
    };
  }
}

// Export a default instance for easy usage
export const helloWorldAgent = new HelloWorldAgent(); 