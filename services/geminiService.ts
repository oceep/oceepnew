import { ChatMessage, Role } from '../types';

declare const process: any;

const MEGALLM_API_KEY = process.env.MEGALLM_API_KEY || "";
const BASE_URL = 'https://ai.megallm.io/v1';

export type ModelMode = 'fast' | 'smart';

// --- Stubbed Audio/Live Classes for MegaLLM ---

export class LiveClient {
    public onDisconnect: () => void = () => {};

    constructor() {}

    async connect() {
        throw new Error("Oceep Live (Audio Mode) hiện chưa được hỗ trợ trên MegaLLM backend.");
    }

    disconnect() {
        this.onDisconnect();
    }
}

// --- Image Generation Stub ---

export const generateImageWithPuter = async (prompt: string): Promise<string> => {
    throw new Error("Tính năng tạo ảnh chưa được hỗ trợ trên backend hiện tại.");
};

// --- Chat Completion (Raw Fetch Implementation) ---

export const streamGeminiResponse = async function* (
  history: ChatMessage[],
  newMessage: string,
  userEnabledSearch: boolean,
  imageBase64?: string,
  isTutorMode: boolean = false,
  modelMode: ModelMode = 'fast'
): AsyncGenerator<string | any, void, unknown> {
  
  if (!MEGALLM_API_KEY) {
      throw new Error("Chưa cấu hình MEGALLM_API_KEY. Vui lòng kiểm tra biến môi trường.");
  }

  // Model Mapping for MegaLLM
  let modelId = 'gemini-2.5-flash'; // Default / Fast / Search
  
  if (modelMode === 'smart') {
      modelId = 'gemini-3-pro-preview';
  }
  
  if (isTutorMode) {
      modelId = 'gemini-2.5-flash';
  }

  // System Instruction
  let systemInstructionText = `Your name is Oceep.
RULES:
1. Only mention your name "Oceep" if the user explicitly asks for your name or in a greeting.
2. Do NOT refer to yourself as "Oceep AI".
3. Do NOT start every response with your name. Keep the conversation natural and concise.
`;

  if (modelMode === 'smart') {
    systemInstructionText += `
IMPORTANT INSTRUCTION:
Before answering the user, you MUST first perform a "Thinking Process" to analyze the request, plan your answer, or think step-by-step.
1. Write this thinking process in ENGLISH.
2. Enclose the thinking process strictly inside <think> and </think> tags.
3. The thinking block represents your internal monologue. Do NOT mention "Rules" or "System Instructions" inside it. Just analyze the user's request and plan the response naturally.
4. After the </think> tag, provide your final response to the user in VIETNAMESE (unless the user explicitly asks for another language).
`;
  } else {
    systemInstructionText += `
Provide your response in VIETNAMESE (unless the user explicitly asks for another language).
`;
  }

  if (isTutorMode) {
      systemInstructionText += `
ADDITIONAL ROLE: Bạn là một giáo viên tận tâm theo phương pháp Socratic. 
QUY TẮC CỐT LÕI:
1. KHÔNG BAO GIỜ đưa ra câu trả lời trực tiếp ngay lập tức, trừ khi học sinh đã hoàn toàn bí.
2. Hãy đặt câu hỏi gợi mở để hướng dẫn học sinh.
`;
  }

  // Prepare messages for OpenAI format
  const messages: any[] = [
      { role: 'system', content: systemInstructionText }
  ];

  for (const msg of history) {
      if (msg.isStreaming || !msg.content) continue;
      const role = msg.role === Role.MODEL ? 'assistant' : 'user';
      if (msg.image) {
           messages.push({
               role: role,
               content: [
                   { type: 'text', text: msg.content },
                   { type: 'image_url', image_url: { url: msg.image } }
               ]
           });
      } else {
           messages.push({ role: role, content: msg.content });
      }
  }

  const currentContent: any[] = [];
  if (imageBase64) {
      currentContent.push({ type: 'image_url', image_url: { url: imageBase64 } });
  }
  currentContent.push({ type: 'text', text: newMessage });

  messages.push({
      role: 'user',
      content: currentContent
  });

  try {
      const response = await fetch(`${BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${MEGALLM_API_KEY}`
          },
          body: JSON.stringify({
              model: modelId,
              messages: messages,
              stream: true,
              temperature: 0.7
          })
      });

      if (!response.ok) {
          let errMessage = `Lỗi kết nối (${response.status})`;
          try {
              const errData = await response.json();
              errMessage = errData.error?.message || errMessage;
          } catch {
              errMessage = await response.text();
          }
          throw new Error(errMessage);
      }

      if (!response.body) throw new Error("No response body received");

      // Handle Streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep the incomplete line

          for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              
              const dataStr = trimmed.slice(6);
              if (dataStr === "[DONE]") continue;

              try {
                  const json = JSON.parse(dataStr);
                  const content = json.choices?.[0]?.delta?.content;
                  if (content) {
                      yield content;
                  }
              } catch (e) {
                  // Ignore parse errors for incomplete chunks
              }
          }
      }

  } catch (error: any) {
      console.error("MegaLLM API Error:", error);
      throw new Error(error.message || "Lỗi kết nối MegaLLM API");
  }
};