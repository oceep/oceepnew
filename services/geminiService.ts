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

// --- Chat Completion (SerpAPI) ---

export const streamGeminiResponse = async function* (
  _history: ChatMessage[],
  newMessage: string,
  _userEnabledSearch: boolean,
  _imageBase64?: string,
  _isTutorMode: boolean = false,
  modelMode: ModelMode = 'fast'
): AsyncGenerator<string | any, void, unknown> {
  
  if (!SERPAPI_API_KEY) {
      throw new Error("Chưa cấu hình SERPAPI_API_KEY. Vui lòng kiểm tra biến môi trường.");
  }

  try {
      const url = new URL(BASE_URL);
      url.searchParams.append("q", newMessage);
      url.searchParams.append("api_key", SERPAPI_API_KEY);
      url.searchParams.append("hl", "vi"); 
      url.searchParams.append("gl", "vn");

      // Logic: Smart = google_ai_mode, Fast = google (standard)
      if (modelMode === 'smart') {
          url.searchParams.append("engine", "google_ai_mode");
      } else {
          url.searchParams.append("engine", "google");
          url.searchParams.append("num", "7"); // Get a few more results for Fast mode
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Lỗi kết nối SerpAPI (${response.status}): ${errText}`);
      }

      const json = await response.json();

      if (json.error) {
          throw new Error(json.error);
      }

      if (modelMode === 'smart') {
          // --- SMART MODE: Process AI Overview ---
          const textBlocks = json.text_blocks || json.ai_overview?.text_blocks;
          
          let hasAiContent = false;
          if (textBlocks && Array.isArray(textBlocks)) {
              for (const block of textBlocks) {
                  let text = "";
                  if (typeof block === 'string') {
                      text = block;
                  } else if (typeof block === 'object' && block !== null) {
                      text = block.value || block.text || block.snippet || "";
                  }

                  if (text) {
                      yield text + "\n\n";
                      hasAiContent = true;
                  }
              }
          }
          
          if (!hasAiContent) {
              // Fallback to organic if AI didn't answer
              if (json.organic_results && json.organic_results.length > 0) {
                   yield "Google AI chưa có câu trả lời cho vấn đề này. Dưới đây là các kết quả tìm kiếm liên quan:\n\n";
                   for (let i = 0; i < Math.min(4, json.organic_results.length); i++) {
                       const result = json.organic_results[i];
                       yield `**[${result.title}](${result.link})**\n${result.snippet}\n\n`;
                   }
              } else {
                   yield "Không tìm thấy kết quả phù hợp.";
              }
          }

      } else {
          // --- FAST MODE: Process Standard Organic Results ---
          // Just list the results nicely
          if (json.organic_results && json.organic_results.length > 0) {
              yield "Dưới đây là kết quả tìm kiếm nhanh từ Google:\n\n";
              
              // Feature Snippet (if any)
              if (json.answer_box) {
                   const answer = json.answer_box.answer || json.answer_box.snippet;
                   if (answer) {
                       yield `> **Thông tin nổi bật:**\n> ${answer}\n\n`;
                   }
              }

              for (const result of json.organic_results) {
                  yield `### [${result.title}](${result.link})\n`;
                  if (result.snippet) {
                      yield `${result.snippet}\n\n`;
                  }
                  // Rich Snippet handling (optional)
                  if (result.rich_snippet?.top?.extensions) {
                      yield `*${result.rich_snippet.top.extensions.join(', ')}*\n\n`;
                  }
              }
          } else {
              yield "Không tìm thấy kết quả nào trên Google.";
          }
      }

  } catch (error: any) {
      console.error("SerpAPI Error:", error);
      throw new Error(error.message || "Lỗi kết nối SerpAPI");
  }
};