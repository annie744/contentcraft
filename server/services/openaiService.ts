import OpenAI from "openai";
import { Meeting } from '@shared/schema';
import { InferenceClient } from "@huggingface/inference";

class OpenAIService {
  private openai: OpenAI | null;
  private huggingface: InferenceClient | null;
  private openaiKey: string | undefined;
  private huggingfaceKey: string | undefined;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.huggingfaceKey = process.env.HUGGINGFACE_API_KEY;
    this.openai = this.openaiKey ? new OpenAI({ apiKey: this.openaiKey }) : null;
    this.huggingface = this.huggingfaceKey ? new InferenceClient(this.huggingfaceKey) : null;
    if (!this.openai && !this.huggingface) {
      throw new Error('Either OPENAI_API_KEY or HUGGINGFACE_API_KEY environment variable is required');
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.MAX_RETRIES,
    delay: number = this.RETRY_DELAY
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        if (i < maxRetries - 1) {
          const backoffDelay = delay * Math.pow(2, i);
          console.log(`Attempt ${i + 1} failed, retrying in ${backoffDelay}ms...`);
          await this.sleep(backoffDelay);
        }
      }
    }
    throw lastError;
  }

  private async generateWithOpenAI(messages: any[], max_tokens = 1000): Promise<string> {
    if (!this.openai) throw new Error('OpenAI not configured');
    try {
      return await this.retryWithBackoff(async () => {
        const response = await this.openai!.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages,
          max_tokens,
        });
        return response.choices[0].message.content || "Unable to generate response";
      });
    } catch (error: any) {
      console.error('OpenAI generation error:', error);
      if (error?.code === 'model_not_found') {
        throw new Error('OpenAI model not available. Please check your API access.');
      }
      throw error;
    }
  }

  private async generateWithHuggingFace(messages: any[], max_tokens = 1000): Promise<string> {
    if (!this.huggingface) throw new Error('Hugging Face not configured');
    try {
      return await this.retryWithBackoff(async () => {
        // Convert OpenAI-style messages to Hugging Face chat format
        const hfMessages = messages.map(m => ({ role: m.role, content: m.content }));
        
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          const response = await this.huggingface!.chatCompletion({
            model: "HuggingFaceH4/zephyr-7b-beta",
            messages: hfMessages,
            max_tokens,
            fetch: (url: string | URL | Request, options?: RequestInit) => 
              fetch(url, { 
                ...options, 
                signal: controller.signal,
                // Add additional fetch options to handle network issues
                keepalive: true,
                headers: {
                  ...options?.headers,
                  'Connection': 'keep-alive'
                }
              })
          });
          
          clearTimeout(timeoutId);
          return response.choices?.[0]?.message?.content || "Unable to generate response";
        } finally {
          clearTimeout(timeoutId);
        }
      });
    } catch (error: any) {
      console.error('Hugging Face generation error:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Hugging Face API request timed out. Please try again later.');
      }
      if (error.message?.includes('insufficient permissions')) {
        throw new Error('Hugging Face API key does not have sufficient permissions. Please check your API key settings.');
      }
      if (error.cause?.code === 'UND_ERR_SOCKET') {
        throw new Error('Network connection issue with Hugging Face API. Please check your network connection and try again.');
      }
      throw error;
    }
  }

  private async generateChat(messages: any[], max_tokens = 1000): Promise<string> {
    // Prefer OpenAI if available, fallback to Hugging Face
    try {
      if (this.openai) {
        return await this.generateWithOpenAI(messages, max_tokens);
      }
    } catch (err: any) {
      console.error('OpenAI generation failed, attempting Hugging Face fallback:', err);
      // If quota error or other, fallback
      if (this.huggingface) {
        try {
          return await this.generateWithHuggingFace(messages, max_tokens);
        } catch (hfErr: any) {
          console.error('Hugging Face fallback also failed:', hfErr);
          const errorMessage = hfErr.message || 'Unknown error';
          throw new Error(`Both OpenAI and Hugging Face generation failed: ${errorMessage}`);
        }
      }
      throw err;
    }
    if (this.huggingface) {
      return await this.generateWithHuggingFace(messages, max_tokens);
    }
    throw new Error('No LLM provider available');
  }

  async generateFollowUpEmail(meeting: Meeting): Promise<string> {
    if (!meeting.transcript) {
      throw new Error('No transcript available for this meeting');
    }
    const messages = [
      {
        role: "system",
        content: "You are an expert assistant that creates professional follow-up emails based on meeting transcripts. Create a concise, professional follow-up email that summarizes the key points discussed, action items, and next steps."
      },
      {
        role: "user",
        content: `Please create a follow-up email for a meeting titled \"${meeting.title}\" with the following transcript: ${meeting.transcript.substring(0, 8000)}`
      }
    ];
    return await this.generateChat(messages, 1000);
  }

  async generateSocialMediaPost(meeting: Meeting, platform: string, prompt: string): Promise<{ content: string, imagePrompt: string }> {
    if (!meeting.transcript) {
      throw new Error('No transcript available for this meeting');
    }
    const systemPrompt = prompt || this.getDefaultPromptForPlatform(platform);
    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `Create a social media post based on this meeting titled \"${meeting.title}\" with the following transcript: ${meeting.transcript.substring(0, 6000)}`
      }
    ];
    const resultStr = await this.generateChat(messages, 1000);
    let result: { content: string, imagePrompt: string } = { content: '', imagePrompt: '' };
    try {
      result = JSON.parse(resultStr);
    } catch {
      result.content = resultStr;
      result.imagePrompt = "professional business meeting";
    }
    if (!result.content) result.content = "Unable to generate social media post";
    if (!result.imagePrompt) result.imagePrompt = "professional business meeting";
    return result;
  }

  // Helper to generate image for social media post
  async generateImage(prompt: string): Promise<string> {
    try {
      if (!this.openai) {
        console.error('OpenAI not configured for image generation');
        return "";
      }
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: `${prompt}. Professional quality, high-resolution, suitable for business social media.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });
      if (response.data && response.data[0] && response.data[0].url) {
        return response.data[0].url;
      }
      return "";
    } catch (error) {
      console.error('Error generating image:', error);
      return "";
    }
  }

  // Default prompts for different platforms
  private getDefaultPromptForPlatform(platform: string): string {
    if (platform === 'linkedin') {
      return `You are a professional social media content creator specializing in LinkedIn. 
      Create an engaging LinkedIn post based on the meeting transcript provided. 
      The post should be professional, highlight key insights, and include relevant hashtags.
      Follow these guidelines:
      - Keep it professional and business-focused
      - Include 3-5 hashtags
      - Aim for 150-200 words
      - Focus on value and insights from the meeting
      - Include a call to action
      
      Return a JSON object with two fields:
      1. "content": the text for the LinkedIn post
      2. "imagePrompt": a brief description to generate a professional image to accompany the post`;
    }
    
    if (platform === 'facebook') {
      return `You are a social media content creator specializing in Facebook. 
      Create an engaging Facebook post based on the meeting transcript provided. 
      The post should be conversational, relatable, and encourage engagement.
      Follow these guidelines:
      - Use a more casual, conversational tone
      - Include a question to encourage comments
      - Aim for 100-150 words
      - Focus on the most interesting points from the meeting
      - Add 2-3 relevant hashtags
      
      Return a JSON object with two fields:
      1. "content": the text for the Facebook post
      2. "imagePrompt": a brief description to generate an engaging image to accompany the post`;
    }
    
    // Default
    return `Create a social media post based on the meeting transcript provided.
    The post should be engaging and professional.
    
    Return a JSON object with two fields:
    1. "content": the text for the social media post
    2. "imagePrompt": a brief description to generate an image to accompany the post`;
  }
}

export const openaiService = new OpenAIService();
