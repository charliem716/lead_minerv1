declare module 'serpapi' {
  export interface SerpApiParams {
    q: string;
    engine: string;
    api_key: string;
    num?: number;
    gl?: string;
    hl?: string;
    safe?: string;
    async?: boolean;
  }

  export interface SerpApiResponse {
    organic_results?: any[];
    search_metadata?: {
      id: string;
      status: string;
      created_at: string;
      processed_at: string;
    };
  }

  export interface SerpApiConfig {
    api_key: string;
    timeout?: number;
  }

  export function getJson(params: SerpApiParams, callback?: (result: SerpApiResponse) => void): Promise<SerpApiResponse>;
  export function getHtml(params: SerpApiParams, callback?: (result: string) => void): Promise<string>;
  export function getAccount(params?: { api_key?: string; timeout?: number }, callback?: (result: any) => void): Promise<any>;
  export function getLocations(params?: { q?: string; limit?: number; timeout?: number }, callback?: (result: any) => void): Promise<any>;
  export function getJsonBySearchId(searchId: string, params?: { api_key?: string; timeout?: number }, callback?: (result: SerpApiResponse) => void): Promise<SerpApiResponse>;
  export function getHtmlBySearchId(searchId: string, params?: { api_key?: string; timeout?: number }, callback?: (result: string) => void): Promise<string>;
  
  export const config: SerpApiConfig;
} 