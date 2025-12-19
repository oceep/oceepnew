import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage, Role } from '../types';

const API_KEY = "AIzaSyBodR21AztBA9dW-XqfJy22FKiwOWPXOfU";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type ModelMode = 'fast' | 'smart';

// Helper to convert blob to base64 if needed, but we deal with base64 strings mostly
const getBase64Parts = (base64String: string) => {
    const match = base64String.match(/^data:(.+);base64,(.+)$/);
    if (!match) return null;
    return {
        mimeType: match[1],
        data: match[2]
    };
};

export const generateImageWithPuter = async (prompt: string): Promise<string> => {
    // Replaced with Google Gemini/Imagen generation
    // Using gemini-2.5-flash-image or imagen if available.
    // Since we are in the 'geminiService', we'll use the ai client.
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
                outputMimeType: 'image/jpeg'
            }
        });
        
        const b64 = response.generatedImages?.[0]?.image?.imageBytes;
        if (b64) return `data:image/jpeg;base64,${b64}`;
        throw new Error("Không thể tạo ảnh. Vui lòng thử lại.");
    } catch (error: any) {
        console.error("Image Gen Error:", error);
        throw new Error(error.message || "Lỗi tạo ảnh");
    }
};

export const streamGeminiResponse = async function* (
  history: ChatMessage[],
  newMessage: string,
  userEnabledSearch: boolean,
  imageBase64?: string,
  isTutorMode: boolean = false,
  modelMode: ModelMode = 'fast'
): AsyncGenerator<string | any, void, unknown> {
  
  // Model Mapping
  let modelId = 'gemini-3-flash-preview'; // Default / Fast
  if (modelMode === 'smart') {
      modelId = 'gemini-3-pro-preview';
  }
  // Tutor always uses flash for speed in this context unless overridden
  if (isTutorMode) {
      modelId = 'gemini-3-flash-preview';
  }

  // Configuration
  const config: any = {};
  
  // System Instruction
  let systemInstructionText = `You are Oceep AI.`;

  // Only apply Thinking Process for Smart mode (Tu Duy)
  if (modelMode === 'smart') {
    systemInstructionText += `
IMPORTANT INSTRUCTION:
Before answering the user, you MUST first perform a "Thinking Process" to analyze the request, plan your answer, or think step-by-step.
1. Write this thinking process in ENGLISH.
2. Enclose the thinking process strictly inside <think> and </think> tags.
3. After the </think> tag, provide your final response to the user in VIETNAMESE (unless the user explicitly asks for another language).

Example:
<think>
User is asking for... I should explain...
</think>
Xin chào, đây là câu trả lời của tôi...
`;
  } else {
    // Fast mode instruction (Nhanh) - Direct answer
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
3. Chia nhỏ vấn đề phức tạp.
4. Luôn kiểm tra sự hiểu biết.
5. Nếu là câu hỏi kiến thức chung, hãy giải thích ngắn gọn.
`;
  }
  
  config.systemInstruction = systemInstructionText;

  // Tools (Search)
  if (userEnabledSearch) {
     config.tools = [{ googleSearch: {} }];
  }

  // Format History for Chat
  // Note: Gemini SDK Chat expects Content objects.
  const historyContents = history
    .filter(msg => !msg.isStreaming && msg.content)
    .map(msg => {
        const parts: any[] = [];
        if (msg.image) {
            const imgData = getBase64Parts(msg.image);
            if (imgData) {
                parts.push({ inlineData: imgData });
            }
        }
        parts.push({ text: msg.content });
        return {
            role: msg.role === Role.MODEL ? 'model' : 'user',
            parts: parts
        };
    });

  // Create Chat Session
  const chat = ai.chats.create({
      model: modelId,
      config: config,
      history: historyContents
  });

  // Prepare current message
  const currentMessageParts: any[] = [];
  if (imageBase64) {
      const imgData = getBase64Parts(imageBase64);
      if (imgData) {
          currentMessageParts.push({ inlineData: imgData });
      }
  }
  currentMessageParts.push({ text: newMessage });

  try {
      // FIX: sendMessageStream expects an object with 'message' property
      const result = await chat.sendMessageStream({ message: currentMessageParts });
      
      for await (const chunk of result) {
          // Chunk is GenerateContentResponse
          // We need to yield the text and potentially grounding metadata
          const text = chunk.text;
          if (text) yield text;

          // Check for grounding metadata in the chunk to pass back?
          // The current app architecture expects string chunks mostly.
          // However, we might need to handle metadata. 
          // For now, let's just yield text. 
          // If we want to return the full object for metadata processing in App.tsx:
          if (chunk.candidates?.[0]?.groundingMetadata) {
             yield chunk.candidates[0].groundingMetadata;
          }
      }
  } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Lỗi kết nối Gemini API");
  }
};