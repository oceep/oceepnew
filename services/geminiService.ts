import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { ChatMessage, Role } from '../types';

declare const process: any;

const API_KEY = process.env.API_KEY || "";
const SMART_KEY = process.env.SMART_KEY || "";

// Default client for general tasks (Image, Live, Fast Chat)
const defaultAi = new GoogleGenAI({ apiKey: API_KEY });

export type ModelMode = 'fast' | 'smart';

// --- Audio Helpers (Live API) ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export class LiveClient {
    private inputAudioContext: AudioContext | null = null;
    private outputAudioContext: AudioContext | null = null;
    private inputSource: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    private outputNode: AudioNode | null = null;
    private stream: MediaStream | null = null;
    private nextStartTime = 0;
    private sessionPromise: Promise<any> | null = null;
    private session: any = null;
    private sources = new Set<AudioBufferSourceNode>();
    public onDisconnect: () => void = () => {};

    constructor() {}

    async connect() {
        // Security Check
        if (!window.isSecureContext) {
            throw new Error("Live Chat yêu cầu kết nối bảo mật (HTTPS) hoặc localhost.");
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
             throw new Error("Trình duyệt không hỗ trợ thu âm.");
        }

        // Step 1: Request Microphone Access with specific error handling
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (error: any) {
            // Handle specific errors without excessive console noise
            if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
                 throw new Error("Không tìm thấy thiết bị microphone. Vui lòng kiểm tra kết nối.");
            }
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                 throw new Error("Quyền truy cập microphone bị từ chối. Vui lòng cho phép trong cài đặt trình duyệt.");
            }
            console.error("Microphone Access Error:", error);
            throw new Error("Không thể truy cập microphone: " + (error.message || "Lỗi không xác định"));
        }

        // Step 2: Initialize Audio Contexts safely
        try {
            this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            
            // Resume contexts if suspended
            if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
            if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();

            this.outputNode = this.outputAudioContext.createGain();
            this.outputNode.connect(this.outputAudioContext.destination);
        } catch (error: any) {
             console.error("Audio Context Init Error:", error);
             this.disconnect();
             throw new Error("Không thể khởi tạo hệ thống âm thanh. Vui lòng thử lại.");
        }

        // Step 3: Connect to Gemini Live
        const config = { 
            responseModalities: [Modality.AUDIO],
            systemInstruction: "Your name is Oceep. You are a helpful AI assistant. Keep responses concise and natural for voice conversation."
        };

        const model = 'gemini-2.5-flash-native-audio-preview-12-2025';

        try {
            // Use defaultAi (API_KEY) for Live
            this.sessionPromise = defaultAi.live.connect({
                model: model,
                config: config,
                callbacks: {
                    onopen: () => {
                        console.debug('Live Session Opened');
                        this.startAudioInput();
                    },
                    onmessage: (message: LiveServerMessage) => this.handleMessage(message),
                    onerror: (e: any) => {
                        console.error('Live Error:', e);
                        this.disconnect();
                    },
                    onclose: (e: any) => {
                        console.debug('Live Session Closed', e);
                        this.disconnect();
                    }
                }
            });
            this.session = await this.sessionPromise;
        } catch (error: any) {
            console.error("Gemini Live Connection Error:", error);
            this.disconnect(); // Clean up resources
            throw error;
        }
    }

    private startAudioInput() {
        if (!this.inputAudioContext || !this.stream || !this.session) return;

        try {
            this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
            this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

            this.processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                this.session.sendRealtimeInput({ media: pcmBlob });
            };

            this.inputSource.connect(this.processor);
            this.processor.connect(this.inputAudioContext.destination);
        } catch (e) {
            console.error("Error starting audio input:", e);
            this.disconnect();
        }
    }

    private async handleMessage(message: LiveServerMessage) {
        if (!this.outputAudioContext || !this.outputNode) return;

        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
            try {
                const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    this.outputAudioContext,
                    24000,
                    1
                );
                
                const source = this.outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.outputNode);
                
                source.addEventListener('ended', () => {
                    this.sources.delete(source);
                });

                source.start(this.nextStartTime);
                this.nextStartTime += audioBuffer.duration;
                this.sources.add(source);
            } catch (e) {
                console.error("Error decoding audio:", e);
            }
        }

        const interrupted = message.serverContent?.interrupted;
        if (interrupted) {
            this.sources.forEach(src => {
                try { src.stop(); } catch(e){}
            });
            this.sources.clear();
            this.nextStartTime = 0;
        }
    }

    disconnect() {
        if (this.session) {
            try {
                this.session.close();
            } catch (e) { console.error(e); }
            this.session = null;
        }
        
        if (this.processor) {
            try { this.processor.disconnect(); } catch (e) {}
            this.processor = null;
        }
        if (this.inputSource) {
            try { this.inputSource.disconnect(); } catch (e) {}
            this.inputSource = null;
        }
        if (this.stream) {
            try { this.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
            this.stream = null;
        }
        if (this.inputAudioContext) {
            try { this.inputAudioContext.close(); } catch (e) {}
            this.inputAudioContext = null;
        }
        if (this.outputAudioContext) {
            try { this.outputAudioContext.close(); } catch (e) {}
            this.outputAudioContext = null;
        }
        this.sources.clear();
        this.onDisconnect();
    }
}

// --- End Audio Helpers ---

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
    try {
        // Use defaultAi (API_KEY)
        const response = await defaultAi.models.generateImages({
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
  let useSmartKey = false;

  if (modelMode === 'smart') {
      modelId = 'gemini-3-pro-preview';
      useSmartKey = true;
  }
  // Tutor always uses flash for speed in this context unless overridden
  if (isTutorMode) {
      modelId = 'gemini-3-flash-preview';
      useSmartKey = false; // Tutor uses standard key
  }

  // Configuration
  const config: any = {};
  
  // System Instruction
  let systemInstructionText = `Your name is Oceep.
RULES:
1. Only mention your name "Oceep" if the user explicitly asks for your name or in a greeting.
2. Do NOT refer to yourself as "Oceep AI".
3. Do NOT start every response with your name. Keep the conversation natural and concise.
`;

  // Only apply Thinking Process for Smart mode (Tu Duy)
  if (modelMode === 'smart') {
    systemInstructionText += `
IMPORTANT INSTRUCTION:
Before answering the user, you MUST first perform a "Thinking Process" to analyze the request, plan your answer, or think step-by-step.
1. Write this thinking process in ENGLISH.
2. Enclose the thinking process strictly inside <think> and </think> tags.
3. The thinking block represents your internal monologue. Do NOT mention "Rules" or "System Instructions" inside it. Just analyze the user's request and plan the response naturally.
4. After the </think> tag, provide your final response to the user in VIETNAMESE (unless the user explicitly asks for another language).

Example:
<think>
The user is asking about [topic]. I need to consider [aspects]. I will structure the answer by...
</think>
[Final Answer in Vietnamese]
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

  // Determine which client/key to use
  let chatAi = defaultAi;
  if (useSmartKey && SMART_KEY) {
      chatAi = new GoogleGenAI({ apiKey: SMART_KEY });
  }

  // Create Chat Session
  const chat = chatAi.chats.create({
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
      const result = await chat.sendMessageStream({ message: currentMessageParts });
      
      for await (const chunk of result) {
          // Chunk is GenerateContentResponse
          // We need to yield the text and potentially grounding metadata
          const text = chunk.text;
          if (text) yield text;

          // Check for grounding metadata in the chunk to pass back
          if (chunk.candidates?.[0]?.groundingMetadata) {
             yield chunk.candidates[0].groundingMetadata;
          }
      }
  } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Lỗi kết nối Gemini API");
  }
};