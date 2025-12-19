import { ChatMessage } from '../types';

declare const process: any;

const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY || "";
const BASE_URL = 'https://serpapi.com/search.json';

export type ModelMode = 'fast' | 'smart';

// --- Stubbed Audio/Live Classes ---

export class LiveClient {
    public onDisconnect: () => void = () => {};

    constructor() {}

    async connect() {
        throw new Error("Oceep Live (Audio Mode) hiện chưa được hỗ trợ trên chế độ Search.");
    }

    disconnect() {
        this.onDisconnect();
    }
}

// --- Image Generation Stub ---

export const generateImageWithPuter = async (_prompt: string): Promise<string> => {
    throw new Error("Tính năng tạo ảnh chưa được hỗ trợ trên backend hiện tại.");
};

// --- Chat Completion (SerpAPI google_ai_mode) ---

export const streamGeminiResponse = async function* (
  _history: ChatMessage[], // Search engines are generally stateless per query
  newMessage: string,
  _userEnabledSearch: boolean,
  _imageBase64?: string,
  _isTutorMode: boolean = false,
  _modelMode: ModelMode = 'fast'
): AsyncGenerator<string | any, void, unknown> {
  
  if (!SERPAPI_API_KEY) {
      throw new Error("Chưa cấu hình SERPAPI_API_KEY. Vui lòng kiểm tra biến môi trường.");
  }

  try {
      // Build the URL with query parameters
      // Note: We use a proxy logic or direct fetch. 
      // Direct fetch to serpapi.com from browser might require a proxy server 
      // due to CORS if not explicitly allowed by their dashboard for this domain.
      // Assuming it works or is proxied:
      
      const url = new URL(BASE_URL);
      url.searchParams.append("engine", "google_ai_mode");
      url.searchParams.append("q", newMessage);
      url.searchParams.append("api_key", SERPAPI_API_KEY);
      // Optional: Add location or language if needed, e.g., hl=vi, gl=vn
      url.searchParams.append("hl", "vi"); 
      url.searchParams.append("gl", "vn");

      const response = await fetch(url.toString());

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Lỗi kết nối SerpAPI (${response.status}): ${errText}`);
      }

      const json = await response.json();

      if (json.error) {
          throw new Error(json.error);
      }

      // Logic to extract text from google_ai_mode response.
      // The user specified json["text_blocks"].
      // We also look for related generative AI structures just in case.
      
      const textBlocks = json.text_blocks || json.ai_overview?.text_blocks;

      if (textBlocks && Array.isArray(textBlocks)) {
          for (const block of textBlocks) {
              // block might be a simple string or an object { type: '...', value: '...' }
              let text = "";
              if (typeof block === 'string') {
                  text = block;
              } else if (typeof block === 'object' && block !== null) {
                  // Common SerpAPI patterns
                  text = block.value || block.text || block.snippet || "";
              }

              if (text) {
                  yield text + "\n\n";
              }
          }
      } else if (json.organic_results && json.organic_results.length > 0) {
           // Fallback: If AI mode didn't return a direct answer, summarize top organic results
           yield "Không có câu trả lời AI trực tiếp. Dưới đây là kết quả tìm kiếm:\n\n";
           for (let i = 0; i < Math.min(3, json.organic_results.length); i++) {
               const result = json.organic_results[i];
               yield `**${result.title}**\n${result.snippet}\n[Xem thêm](${result.link})\n\n`;
           }
      } else {
           yield "Không tìm thấy kết quả phù hợp.";
      }

  } catch (error: any) {
      console.error("SerpAPI Error:", error);
      throw new Error(error.message || "Lỗi kết nối SerpAPI");
  }
};