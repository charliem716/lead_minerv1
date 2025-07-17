declare module 'puppeteer' {
  export interface Browser {
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }

  export interface Page {
    setUserAgent(userAgent: string): Promise<void>;
    setViewport(viewport: { width: number; height: number }): Promise<void>;
    goto(url: string, options?: { waitUntil?: string | string[]; timeout?: number }): Promise<void>;
    waitForTimeout(timeout: number): Promise<void>;
    content(): Promise<string>;
    title(): Promise<string>;
    close(): Promise<void>;
  }

  export interface PuppeteerLaunchOptions {
    headless?: boolean | 'new';
    args?: string[];
  }

  export default {
    launch(options?: PuppeteerLaunchOptions): Promise<Browser>;
  };
} 