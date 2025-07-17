// Type definitions for external packages
// These are temporary definitions until packages are installed

// Node.js global types
declare global {
  namespace NodeJS {
    interface Process {
      env: { [key: string]: string | undefined };
      exit(code?: number): void;
      on(event: string, listener: (...args: any[]) => void): void;
    }
  }
  
  var process: NodeJS.Process;
  var console: {
    log(...args: any[]): void;
    error(...args: any[]): void;
  };
  var require: (id: string) => any;
  var module: { main?: any };
}

declare module 'dotenv' {
  export function config(): void;
}

declare module '@openai/agents' {
  export class Agent {
    constructor(config: {
      name: string;
      instructions: string;
      model?: string;
    });
    name: string;
  }
  
  export function run(agent: Agent, prompt: string): Promise<{ finalOutput: string }>;
}

declare module 'google-spreadsheet' {
  export class GoogleSpreadsheet {
    constructor(id: string, auth: any);
    title: string;
    sheetsByTitle: { [key: string]: GoogleSpreadsheetWorksheet };
    sheetsByIndex: GoogleSpreadsheetWorksheet[];
    loadInfo(): Promise<void>;
    addSheet(options: { title: string; headerValues?: string[] }): Promise<GoogleSpreadsheetWorksheet>;
  }
  
  export class GoogleSpreadsheetWorksheet {
    title: string;
    addRow(data: Record<string, string | undefined>): Promise<void>;
    addRows(data: Record<string, string | undefined>[]): Promise<void>;
    getRows(): Promise<any[]>;
    setHeaderRow(headers: string[]): Promise<void>;
  }
}

declare module 'google-auth-library' {
  export class JWT {
    constructor(options: {
      email: string;
      key: string;
      scopes: string[];
    });
  }
}

declare module 'serpapi' {
  // SerpAPI types (to be expanded in Week 2)
}

declare module 'puppeteer' {
  // Puppeteer types (to be expanded in Week 2)
}

declare module 'cheerio' {
  // Cheerio types (to be expanded in Week 2)
}

declare module 'pg' {
  // PostgreSQL types (to be expanded in Week 1)
}

declare module 'pgvector' {
  // pgvector types (to be expanded in Week 4)
}

declare module 'bullmq' {
  // BullMQ types (to be expanded in Week 2)
}

declare module 'zod' {
  // Zod types (to be expanded in Week 2)
}

declare module 'googleapis' {
  // Google APIs types (to be expanded in Week 2)
} 