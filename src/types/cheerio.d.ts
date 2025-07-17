declare module 'cheerio' {
  export interface CheerioAPI {
    (selector: string): Cheerio;
    html(): string;
  }

  export interface Cheerio {
    each(func: (index: number, element: any) => void): Cheerio;
    find(selector: string): Cheerio;
    text(): string;
    attr(name: string): string | undefined;
    html(): string;
    first(): Cheerio;
    last(): Cheerio;
    eq(index: number): Cheerio;
    parent(): Cheerio;
    children(selector?: string): Cheerio;
    siblings(selector?: string): Cheerio;
    next(selector?: string): Cheerio;
    prev(selector?: string): Cheerio;
    filter(selector: string | ((index: number, element: any) => boolean)): Cheerio;
    map(func: (index: number, element: any) => any): Cheerio;
    remove(): Cheerio;
    toArray(): any[];
    length: number;
  }

  export function load(html: string, options?: any): CheerioAPI;
  
  const cheerio: {
    load: typeof load;
  };
  
  export default cheerio;
} 