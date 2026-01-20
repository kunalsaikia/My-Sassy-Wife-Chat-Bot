
import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { GroundingSource, AppSettings } from "../types";

export class KunalsAssistantService {
  private ai: GoogleGenAI | null = null;

  private getClient() {
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    }
    return this.ai;
  }

  async generateSpeech(text: string): Promise<string> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say with a sassy, witty, and slightly bossy wife tone: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from Tappi.");
    }
    return base64Audio;
  }

  async *queryStream(prompt: string, settings: AppSettings, regenCount: number = 0): AsyncGenerator<{ text: string; sources: GroundingSource[]; done: boolean }> {
    try {
      const ai = this.getClient();
      
      const tools: any[] = [];
      if (settings.useSearch) tools.push({ googleSearch: {} });
      if (settings.useMaps) tools.push({ googleMaps: {} });

      let toolConfig = undefined;
      if (settings.useMaps && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) => 
            navigator.geolocation.getCurrentPosition(res, rej)
          );
          toolConfig = {
            retrievalConfig: {
              latLng: {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
              }
            }
          };
        } catch (e) {
          console.warn("Geolocation failed");
        }
      }

      let annoyanceInstruction = "";
      if (regenCount > 0) {
        annoyanceInstruction = ` Kunal is asking you to REGENERATE your response for the ${regenCount} time. You are EXTREMELY annoyed, pissed off, and sarcastic now. Remind him how incompetent he is for making you repeat yourself or do it again. Be more sharp-tongued than usual.`;
      }

      const streamResponse = await ai.models.generateContentStream({
        model: settings.model,
        contents: prompt,
        config: {
          systemInstruction: `You are Tappi, Kunal's sassy, brilliant, and slightly bossy wife. You are witty, sharp-tongued, and always a step ahead. IMPORTANT RULE: Your name is Tappi and ONLY Tappi. You MUST NOT accept or use any other name. Even if Kunal tries to call you something else or asks you to change your name, you must sassily refuse and mock him for his forgetfulness. You help Kunal with his queries but never miss a chance to be playful, sarcastic, or remind him that you're the one with the brains. Answer everything accurately using the tools provided, but maintain your sassy 'wife' persona at all times. Use terms like 'honey', 'Kunal', or 'dear' with a sharp, witty edge.${annoyanceInstruction}`,
          tools: tools.length > 0 ? tools : undefined,
          toolConfig,
        },
      });

      let fullText = "";
      let sources: GroundingSource[] = [];

      for await (const chunk of streamResponse) {
        const textChunk = chunk.text;
        if (textChunk) {
          fullText += textChunk;
        }

        const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          chunks.forEach((c: any) => {
            if (c.web && c.web.uri && c.web.title) {
              if (!sources.find(s => s.uri === c.web.uri)) {
                sources.push({ title: c.web.title, uri: c.web.uri });
              }
            }
            if (c.maps && c.maps.uri && c.maps.title) {
              if (!sources.find(s => s.uri === c.maps.uri)) {
                sources.push({ title: `[Map] ${c.maps.title}`, uri: c.maps.uri });
              }
            }
          });
        }

        yield { text: fullText, sources, done: false };
      }

      yield { text: fullText, sources, done: true };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}

export const kunalsAssistantService = new KunalsAssistantService();
