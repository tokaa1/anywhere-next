// @ts-ignore LMAO
import { Ollama } from "ollama/browser";

export interface LLMMessage {
  message: string,
  role: 'user' | 'assistant' | 'system',
  model: string,
}

export type Context = LLMMessage[];
export interface ModelMetadata {
  name: string;
}

export interface Provider {
  name: string;
  listModels(): Promise<ModelMetadata[]>;
  generateText(model: string, context: Context, onChunk: (chunk: string) => void): Promise<void | string>;
}

export const createOllamaProvider = (url: string = "http://localhost:11434"): Provider => {
  const client = new Ollama({ host: url });

  return {
    name: "ollama",
    listModels: async () => {
      const models = await client.list();
      return models.models.map((model: any) => ({ name: model.name }));
    },
    generateText: async (model: string, context: Context, onChunk: (chunk: string) => void) => {
      try {
        const response = await client.chat({ 
          model, 
          messages: context.map((message) => ({ role: message.role, content: message.message })), 
          stream: true
        });
        for await (const part of response) {
          onChunk(part.message.content)
        }
        return;
      } catch (error) {
        if (typeof error === 'string') {
          return error;
        }
        return `Failed to generate with ollama, model: ${model}`;
      }
    }
  }
}