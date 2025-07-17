import { HelloWorldAgent } from '../hello-world';

describe('HelloWorldAgent', () => {
  let agent: HelloWorldAgent;

  beforeEach(() => {
    agent = new HelloWorldAgent();
  });

  describe('getAgentInfo', () => {
    it('should return agent information', () => {
      const info = agent.getAgentInfo();
      
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('model');
      expect(info).toHaveProperty('configured');
      expect(info.name).toBe('Lead Miner Hello World Agent');
      expect(typeof info.configured).toBe('boolean');
    });
  });

  describe('testAgent', () => {
    it('should be defined', () => {
      expect(agent.testAgent).toBeDefined();
      expect(typeof agent.testAgent).toBe('function');
    });
  });

  describe('testSheetsIntegration', () => {
    it('should be defined', () => {
      expect(agent.testSheetsIntegration).toBeDefined();
      expect(typeof agent.testSheetsIntegration).toBe('function');
    });
  });

  describe('generateTestLead', () => {
    it('should be defined', () => {
      expect(agent.generateTestLead).toBeDefined();
      expect(typeof agent.generateTestLead).toBe('function');
    });
  });
});

// Integration test (requires API keys)
describe('HelloWorldAgent Integration', () => {
  let agent: HelloWorldAgent;

  beforeEach(() => {
    agent = new HelloWorldAgent();
  });

  // Skip integration tests if API keys are not configured
  const skipIntegrationTests = !process.env['OPENAI_API_KEY'] || process.env['OPENAI_API_KEY'] === 'test-openai-key';

  (skipIntegrationTests ? describe.skip : describe)('with real API', () => {
    it('should successfully test agent functionality', async () => {
      const result = await agent.testAgent();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

    it('should generate test lead data', async () => {
      const result = await agent.generateTestLead();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000);
  });
}); 