import OpenAI from "openai";
import { Meeting } from '@shared/schema';

class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openai = new OpenAI({ apiKey });
  }

  async generateFollowUpEmail(meeting: Meeting): Promise<string> {
    if (!meeting.transcript) {
      throw new Error('No transcript available for this meeting');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert assistant that creates professional follow-up emails based on meeting transcripts. Create a concise, professional follow-up email that summarizes the key points discussed, action items, and next steps."
          },
          {
            role: "user",
            content: `Please create a follow-up email for a meeting titled "${meeting.title}" with the following transcript: ${meeting.transcript.substring(0, 8000)}`
          }
        ],
        max_tokens: 1000,
      });

      return response.choices[0].message.content || "Unable to generate follow-up email";
    } catch (error) {
      console.error('Error generating follow-up email:', error);
      throw new Error('Failed to generate follow-up email');
    }
  }

  async generateSocialMediaPost(meeting: Meeting, platform: string, prompt: string): Promise<{ content: string, imagePrompt: string }> {
    if (!meeting.transcript) {
      throw new Error('No transcript available for this meeting');
    }

    try {
      // Use custom prompt if provided, otherwise use defaults based on platform
      const systemPrompt = prompt || this.getDefaultPromptForPlatform(platform);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Create a social media post based on this meeting titled "${meeting.title}" with the following transcript: ${meeting.transcript.substring(0, 6000)}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{"content": "", "imagePrompt": ""}');
      return {
        content: result.content || "Unable to generate social media post",
        imagePrompt: result.imagePrompt || "professional business meeting"
      };
    } catch (error) {
      console.error('Error generating social media post:', error);
      throw new Error('Failed to generate social media post');
    }
  }

  // Helper to generate image for social media post
  async generateImage(prompt: string): Promise<string> {
    try {
      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: `${prompt}. Professional quality, high-resolution, suitable for business social media.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      return response.data[0].url || "";
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
