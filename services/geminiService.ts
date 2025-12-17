import puter from '@heyputer/puter.js';

// Define the response structure for TypeScript safety
interface PuterResponse {
  message?: {
    content: string;
  };
  text?: string;
  [key: string]: any;
}

export const sendMessageToGemini = async (prompt: string): Promise<string> => {
  try {
    const response = await puter.ai.chat(prompt, {
      model: 'gemini-3-pro-preview',
    }) as PuterResponse;

    // Puter returns data in a specific structure, we extract the text here
    return response?.message?.content || response?.text || "No response text found.";
  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw new Error("Failed to connect to Gemini via Puter.js");
  }
};
