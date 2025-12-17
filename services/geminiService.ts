import puter from '@heyputer/puter.js';

// Define the response type for safety
interface PuterResponse {
  message?: {
    content: string;
  };
  text?: string;
  [key: string]: any;
}

/**
 * Sends a prompt to Gemini 3 Pro via Puter.js
 * No API key is required.
 */
export const sendMessageToGemini = async (prompt: string): Promise<string> => {
  try {
    const response = await puter.ai.chat(prompt, {
      model: 'gemini-3-pro-preview', // Explicitly using the model you requested
    }) as PuterResponse;

    // Puter.js responses can vary slightly, this safely extracts the text
    const text = response?.message?.content || response?.text || JSON.stringify(response);
    
    return text;
  } catch (error) {
    console.error("Gemini 3 Pro Error:", error);
    throw new Error("Failed to get response from Gemini 3 Pro.");
  }
};
