declare module 'robotparser' {
  export interface RobotRules {
    userAgent: string;
    disallow: string[];
    allow: string[];
    crawlDelay?: number;
  }

  export class RobotParser {
    setUrl(url: string, callback: (error: any, result: any) => void): void;
    canFetch(userAgent: string, url: string, callback: (error: any, allowed: boolean) => void): void;
    getCrawlDelay(userAgent: string): number | undefined;
    parse(content: string): RobotRules;
  }

  const robotparser: {
    RobotParser: typeof RobotParser;
  };

  export default robotparser;
} 