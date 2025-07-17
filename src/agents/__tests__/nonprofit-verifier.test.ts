import { nonprofitVerifier, NonprofitVerifier, NonprofitVerificationResult } from '../nonprofit-verifier';

describe('NonprofitVerifier', () => {
  let verifier: NonprofitVerifier;
  
  beforeEach(() => {
    verifier = new NonprofitVerifier();
  });

  describe('verifyByEIN', () => {
    it('should verify nonprofit by EIN using IRS database', async () => {
      const ein = '123456789';
      const result = await verifier.verifyByEIN(ein);

      expect(result.ein).toBe(ein);
      expect(result.isVerified).toBe(true);
      expect(result.source).toBe('irs');
      expect(result.confidence).toBe(1.0);
      expect(result.verificationDetails.exemptionCode).toBe('501(c)(3)');
      expect(result.verificationDetails.state).toBe('CA');
    });

    it('should fall back to GuideStar if IRS fails', async () => {
      const ein = '987654321';
      const result = await verifier.verifyByEIN(ein);

      expect(result.ein).toBe(ein);
      expect(result.isVerified).toBe(true);
      expect(result.source).toBe('guidestar');
      expect(result.confidence).toBe(0.9);
      expect(result.additionalInfo?.website).toBe('https://example.org');
    });

    it('should return failed result for unknown EIN', async () => {
      const ein = '000000000';
      const result = await verifier.verifyByEIN(ein);

      expect(result.ein).toBe(ein);
      expect(result.isVerified).toBe(false);
      expect(result.source).toBe('failed');
      expect(result.confidence).toBe(0);
      expect(result.error).toContain('Not found');
    });
  });

  describe('verifyByName', () => {
    it('should verify nonprofit by name using fuzzy matching', async () => {
      const orgName = 'Example Nonprofit';
      const result = await verifier.verifyByName(orgName);

      expect(result.orgName).toBe('Example Nonprofit Foundation');
      expect(result.isVerified).toBe(true);
      expect(result.source).toBe('irs');
      expect(result.ein).toBe('123456789');
    });

    it('should return failed result for unknown organization', async () => {
      const orgName = 'Unknown Organization';
      const result = await verifier.verifyByName(orgName);

      expect(result.orgName).toBe(orgName);
      expect(result.isVerified).toBe(false);
      expect(result.source).toBe('failed');
      expect(result.error).toContain('Not found');
    });
  });

  describe('extractEIN', () => {
    it('should extract EIN from text content', () => {
      const text = 'Our organization EIN is 12-3456789 and we are a 501(c)(3) nonprofit.';
      const ein = verifier.extractEIN(text);

      expect(ein).toBe('12-3456789');
    });

    it('should return null if no EIN found', () => {
      const text = 'This text contains no EIN number.';
      const ein = verifier.extractEIN(text);

      expect(ein).toBe(null);
    });
  });

  describe('extractOrganizationName', () => {
    it('should extract organization name from content', () => {
      const content = {
        organizationInfo: {
          name: 'Springfield Charity Foundation'
        }
      };
      const orgName = verifier.extractOrganizationName(content);

      expect(orgName).toBe('Springfield Charity Foundation');
    });

    it('should extract name from title if organizationInfo not available', () => {
      const content = {
        title: 'Springfield Charity Foundation Annual Auction'
      };
      const orgName = verifier.extractOrganizationName(content);

      expect(orgName).toBe('Springfield Charity Foundation');
    });

    it('should return null if no name found', () => {
      const content = {};
      const orgName = verifier.extractOrganizationName(content);

      expect(orgName).toBe(null);
    });
  });

  describe('verifyBatch', () => {
    it('should verify multiple organizations', async () => {
      const organizations = [
        { ein: '123456789' },
        { name: 'Example Nonprofit' },
        { ein: '000000000' }
      ];

      const results = await verifier.verifyBatch(organizations);

      expect(results).toHaveLength(3);
      expect(results[0]?.isVerified).toBe(true);
      expect(results[1]?.isVerified).toBe(true);
      expect(results[2]?.isVerified).toBe(false);
    });

    it('should handle empty input', async () => {
      const results = await verifier.verifyBatch([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('getVerificationStats', () => {
    it('should calculate correct statistics', () => {
      const results: NonprofitVerificationResult[] = [
        {
          id: 'stat-1',
          orgName: 'Org 1',
          ein: '123456789',
          isVerified: true,
          source: 'irs',
          verificationDetails: {},
          verifiedAt: new Date(),
          confidence: 1.0
        },
        {
          id: 'stat-2',
          orgName: 'Org 2',
          ein: '987654321',
          isVerified: true,
          source: 'guidestar',
          verificationDetails: {},
          verifiedAt: new Date(),
          confidence: 0.9
        },
        {
          id: 'stat-3',
          orgName: 'Org 3',
          isVerified: false,
          source: 'failed',
          verificationDetails: {},
          verifiedAt: new Date(),
          confidence: 0
        }
      ];

      const stats = verifier.getVerificationStats(results);

      expect(stats.total).toBe(3);
      expect(stats.verified).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.verificationRate).toBe(2/3);
      expect(stats.averageConfidence).toBe(0.95); // (1.0 + 0.9) / 2
      expect(stats.sourceBreakdown.irs).toBe(1);
      expect(stats.sourceBreakdown.guidestar).toBe(1);
      expect(stats.sourceBreakdown.failed).toBe(1);
    });
  });

  describe('cache functionality', () => {
    it('should cache verification results', async () => {
      const ein = '123456789';
      
      // First call
      const result1 = await verifier.verifyByEIN(ein);
      
      // Second call should use cache
      const result2 = await verifier.verifyByEIN(ein);
      
      expect(result1.id).toBe(result2.id);
      expect(result1.verifiedAt).toEqual(result2.verifiedAt);
    });

    it('should clear cache', () => {
      verifier.clearCache();
      // Test passes if no error is thrown
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      // Mock the verifyWithIRS method to throw an error
      const originalMethod = (verifier as any).verifyWithIRS;
      (verifier as any).verifyWithIRS = jest.fn().mockRejectedValue(new Error('API Error'));

      const result = await verifier.verifyByEIN('123456789');

      expect(result.isVerified).toBe(false);
      expect(result.source).toBe('failed');
      expect(result.error).toContain('Nonprofit verification failed');

      // Restore original method
      (verifier as any).verifyWithIRS = originalMethod;
    });
  });
});

describe('NonprofitVerifier Integration', () => {
  it('should work with the singleton instance', () => {
    expect(nonprofitVerifier).toBeInstanceOf(NonprofitVerifier);
  });

  it('should have proper configuration', () => {
    expect((nonprofitVerifier as any).irsApiBase).toBe('https://apps.irs.gov/app/eos/pub78Search.do');
    expect((nonprofitVerifier as any).guidetarApiBase).toBe('https://www.guidestar.org/search');
  });
}); 