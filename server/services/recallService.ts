import fetch from 'node-fetch';
import { storage } from '../storage';
import { CalendarEvent, InsertRecallBot, RecallBot } from '@shared/schema';

export class RecallService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.RECALL_API_URL || 'https://api.recall.ai/api/v1';
    const apiKey = process.env.RECALL_API_KEY;
    console.log('[Recall API] Initializing RecallService');
    if (!apiKey) {
      console.error('[Recall API] RECALL_API_KEY environment variable is not set');
      throw new Error('RECALL_API_KEY environment variable is required');
    }
    console.log('[Recall API] API key loaded successfully');
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, method: string = 'GET', body?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Token ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      console.log(`[Recall API] Making ${method} request to ${url}`);
      console.log(`[Recall API] Headers:`, { ...headers, Authorization: 'Token [REDACTED]' });
      if (body) {
        console.log(`[Recall API] Request body:`, body);
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log(`[Recall API] Response status: ${response.status}`);
      const responseText = await response.text();
      console.log(`[Recall API] Response body:`, responseText);

      if (!response.ok) {
        console.error(`[Recall API] Error response:`, {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });
        throw new Error(`Recall API error (${response.status}): ${responseText}`);
      }

      try {
        const jsonResponse = JSON.parse(responseText);
        return jsonResponse;
      } catch (parseError) {
        console.error(`[Recall API] Failed to parse response as JSON:`, parseError);
        console.error(`[Recall API] Raw response:`, responseText);
        throw new Error(`Invalid JSON response from Recall API: ${responseText}`);
      }
    } catch (error) {
      console.error(`[Recall API] Request failed:`, error);
      if (error instanceof Error) {
        console.error(`[Recall API] Error details: ${error.message}`);
        console.error(`[Recall API] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  // Create a bot for a meeting
  async createBot(calendarEvent: CalendarEvent, userId: number): Promise<RecallBot> {
    if (!calendarEvent.meetingLink) {
      throw new Error('Calendar event does not have a meeting link');
    }

    // Extract meeting URL from the calendar event
    const meetingUrl = calendarEvent.meetingLink;

    // Get bot_name, join_at based on user settings
    const userSettings = await storage.getSettings(userId);
    const joinMinutesBefore = userSettings?.botJoinMinutesBefore || 5;
    
    // Calculate the join time (X minutes before the meeting starts)
    const joinAt = new Date(calendarEvent.startTime);
    joinAt.setMinutes(joinAt.getMinutes() - joinMinutesBefore);
    
    // Create bot with Recall API
    const botData = {
      bot_name: `Meeting: ${calendarEvent.title}`,
      meeting_url: meetingUrl,
      join_at: joinAt.toISOString(),
      transcription_options: {
        provider: 'deepgram', // Make sure this is set correctly
        use_separate_streams_when_available: true
      },
      // Ensure recording is enabled
      recording_mode: 'speaker_view'
    };

    try {
      const recallBot = await this.request('/bot', 'POST', botData);
      
      // Save the bot to our database
      const botToSave: InsertRecallBot = {
        userId,
        calendarEventId: calendarEvent.id,
        recallBotId: recallBot.id,
        status: 'scheduled',
      };
      
      return await storage.createRecallBot(botToSave);
    } catch (error) {
      console.error(`Failed to create Recall bot: ${error}`);
      throw error;
    }
  }

  // Check bot status
  async getBotStatus(botId: string): Promise<any> {
    try {
      console.log(`[Recall API] Getting status for bot ${botId}`);
      const response = await this.request(`/bot/${botId}`);
      console.log(`[Recall API] Bot ${botId} status response:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error(`[Recall API] Failed to get bot status for bot ${botId}:`, error);
      if (error instanceof Error) {
        console.error(`[Recall API] Error details: ${error.message}`);
        console.error(`[Recall API] Error stack: ${error.stack}`);
      }
      throw error;
    }
  }

  // Enhanced transcript fetching with better error handling and debugging
  async getTranscript(botId: string): Promise<string | null> {
    try {
      console.log(`[Recall API] Fetching transcript for bot ${botId}`);
      
      // First, check bot status to see if transcript should be available
      const botStatus = await this.getBotStatus(botId);
      console.log(`[Transcript Debug] Bot status for ${botId}:`, JSON.stringify({
        status_changes: botStatus.status_changes,
        recordings: botStatus.recordings || [],
        has_recording: !!botStatus.recording,
        has_recordings_array: !!botStatus.recordings && Array.isArray(botStatus.recordings)
      }, null, 2));

      // Check if we have any recordings
      if (!botStatus.recordings || !Array.isArray(botStatus.recordings) || botStatus.recordings.length === 0) {
        console.warn(`[Transcript Debug] No recordings found for bot ${botId}`);
        return null;
      }

      // Check recording status
      const recording = botStatus.recordings[0];
      console.log(`[Transcript Debug] Recording details:`, JSON.stringify({
        id: recording.id,
        status: recording.status,
        completed_at: recording.completed_at,
        transcription_started_at: recording.transcription_started_at,
        transcription_completed_at: recording.transcription_completed_at
      }, null, 2));

      // Check if transcription is completed
      if (!recording.transcription_completed_at) {
        console.log(`[Transcript Debug] Transcription not completed yet for bot ${botId}`);
        return null;
      }

      // Try different transcript endpoints
      const transcriptEndpoints = [
        `/bot/${botId}/transcript`,
        `/bot/${botId}/transcript/`,
        `/recording/${recording.id}/transcript`
      ];

      for (const endpoint of transcriptEndpoints) {
        try {
          console.log(`[Transcript Debug] Trying endpoint: ${endpoint}`);
          const response = await this.request(endpoint);
          
          console.log(`[Transcript Debug] Response from ${endpoint}:`, JSON.stringify(response, null, 2));
          
          // Check different possible response formats
          if (response && typeof response === 'string') {
            console.log(`[Transcript Debug] Found transcript as string from ${endpoint}`);
            return response;
          }
          
          if (response && response.transcript) {
            console.log(`[Transcript Debug] Found transcript in .transcript property from ${endpoint}`);
            return response.transcript;
          }
          
          if (response && response.text) {
            console.log(`[Transcript Debug] Found transcript in .text property from ${endpoint}`);
            return response.text;
          }
          
          if (response && response.content) {
            console.log(`[Transcript Debug] Found transcript in .content property from ${endpoint}`);
            return response.content;
          }

          // Check if it's an array of transcript segments
          if (response && Array.isArray(response)) {
            console.log(`[Transcript Debug] Found transcript as array from ${endpoint}`);
            const fullTranscript = response.map(segment => 
              segment.text || segment.content || segment.transcript || ''
            ).join(' ');
            if (fullTranscript.trim()) {
              return fullTranscript;
            }
          }

          // Check if it's in a data property
          if (response && response.data) {
            if (typeof response.data === 'string') {
              console.log(`[Transcript Debug] Found transcript in .data as string from ${endpoint}`);
              return response.data;
            }
            if (Array.isArray(response.data)) {
              console.log(`[Transcript Debug] Found transcript in .data as array from ${endpoint}`);
              const fullTranscript = response.data.map((segment: { text?: string; content?: string; transcript?: string }) => 
                segment.text || segment.content || segment.transcript || ''
              ).join(' ');
              if (fullTranscript.trim()) {
                return fullTranscript;
              }
            }
          }
          
        } catch (endpointError) {
          console.log(`[Transcript Debug] Endpoint ${endpoint} failed:`, endpointError);
          continue; // Try next endpoint
        }
      }
      
      console.error(`[Transcript Debug] No transcript found in any endpoint for bot ${botId}`);
      return null;
      
    } catch (error) {
      console.error(`[Recall API] Failed to get transcript for bot ${botId}:`, error);
      if (error instanceof Error) {
        console.error(`[Recall API] Error details: ${error.message}`);
        console.error(`[Recall API] Error stack: ${error.stack}`);
      }
      return null;
    }
  }

  // Poll for bot status and update our database
  async updateBotStatus(recallBot: RecallBot): Promise<RecallBot> {
    try {
      console.log(`[Bot Status] Checking status for bot ${recallBot.id} (current status: ${recallBot.status})`);
      const botStatus = await this.getBotStatus(recallBot.recallBotId);
      
      // Check if status_changes exists and has items
      if (!botStatus.status_changes || !Array.isArray(botStatus.status_changes) || botStatus.status_changes.length === 0) {
        console.error(`[Bot Status] No status_changes found for bot ${recallBot.id}`);
        return recallBot;
      }
      
      // Get the latest status from status_changes array
      const latestStatus = botStatus.status_changes[botStatus.status_changes.length - 1].code;
      console.log(`[Bot Status] Recall API latest status for bot ${recallBot.id}: ${latestStatus}`);
      
      let status = recallBot.status;
      
      // Map Recall API status to our status
      if (latestStatus === 'ready') {
        status = 'scheduled';
      } else if (['joining_call', 'in_waiting_room'].includes(latestStatus)) {
        status = 'joining';
      } else if (['in_call_not_recording', 'in_call_recording'].includes(latestStatus)) {
        status = 'recording';
      } else if (['call_ended', 'recording_done', 'done'].includes(latestStatus)) {
        status = 'completed';
      } else if (['failed', 'error'].includes(latestStatus)) {
        status = 'failed';
      }
      
      console.log(`[Bot Status] Mapped status: ${latestStatus} -> ${status}`);
      
      // Update our database if status changed
      if (status !== recallBot.status) {
        console.log(`[Bot Status] Updating bot ${recallBot.id} status from ${recallBot.status} to ${status}`);
        return await storage.updateRecallBot(recallBot.id, { status });
      } else {
        console.log(`[Bot Status] Bot ${recallBot.id} status unchanged: ${status}`);
      }
      
      return recallBot;
    } catch (error) {
      console.error(`[Bot Status] Failed to update bot status for bot ${recallBot.id}:`, error);
      if (error instanceof Error) {
        console.error(`[Bot Status] Error details: ${error.message}`);
        console.error(`[Bot Status] Error stack: ${error.stack}`);
      }
      return recallBot;
    }
  }

  // Enhanced meeting processing with better transcript handling
  async processMeeting(recallBot: RecallBot): Promise<void> {
    try {
      // Check if this bot is completed and needs processing
      if (recallBot.status !== 'completed') {
        console.log(`[Bot Processing] Bot ${recallBot.id} is not completed (status: ${recallBot.status}), skipping processing`);
        return;
      }
      
      // Get the meeting from database
      const meeting = await storage.getMeetingByCalendarEventId(recallBot.calendarEventId);
      if (!meeting) {
        console.error(`[Bot Processing] Meeting not found for calendar event ${recallBot.calendarEventId}`);
        return;
      }
      
      console.log(`[Bot Processing] Processing meeting ${meeting.id} for bot ${recallBot.id}`);
      
      // Get transcript if we don't have it yet
      if (!meeting.transcript) {
        // First check if the recording is ready
        const botStatus = await this.getBotStatus(recallBot.recallBotId);
        const latestStatus = botStatus.status_changes[botStatus.status_changes.length - 1].code;
        
        console.log(`[Bot Processing] Current bot status: ${latestStatus}`);
        console.log(`[Bot Processing] Bot status details:`, JSON.stringify({
          recordings: botStatus.recordings || [],
          recording: botStatus.recording || null
        }, null, 2));

        // More flexible status checking
        if (!['done', 'recording_done', 'call_ended'].includes(latestStatus)) {
          console.log(`[Bot Processing] Bot ${recallBot.id} is not done yet (status: ${latestStatus}), will try again later`);
          return;
        }

        // Check if we have recordings
        if (!botStatus.recordings || !Array.isArray(botStatus.recordings) || botStatus.recordings.length === 0) {
          console.log(`[Bot Processing] No recordings found for bot ${recallBot.id}, will try again later`);
          return;
        }

        // Check if the recording/transcription is completed
        const recording = botStatus.recordings[0];
        console.log(`[Bot Processing] Recording details:`, JSON.stringify({
          id: recording.id,
          status: recording.status,
          completed_at: recording.completed_at,
          transcription_started_at: recording.transcription_started_at,
          transcription_completed_at: recording.transcription_completed_at
        }, null, 2));

        // Check transcription options to see if transcription is enabled
        console.log(`[Bot Processing] Transcription options:`, JSON.stringify(botStatus.transcription_options, null, 2));
        
        if (botStatus.transcription_options?.provider === 'none') {
          console.error(`[Bot Processing] Transcription is disabled for bot ${recallBot.id} (provider: none). Cannot get transcript.`);
          return;
        }

        // For bots with transcription enabled, wait for transcription to be completed
        if (recording.transcription_completed_at) {
          // Calculate time since transcription completed
          const completedAt = new Date(recording.transcription_completed_at);
          const now = new Date();
          const minutesSinceCompletion = (now.getTime() - completedAt.getTime()) / (1000 * 60);

          // If less than 2 minutes have passed since transcription completed, wait longer
          if (minutesSinceCompletion < 2) {
            console.log(`[Bot Processing] Transcription completed ${minutesSinceCompletion.toFixed(1)} minutes ago, waiting a bit more...`);
            return;
          }
        } else {
          // Check if enough time has passed since recording completed for transcription to process
          const recordingCompletedAt = new Date(recording.completed_at);
          const now = new Date();
          const minutesSinceRecording = (now.getTime() - recordingCompletedAt.getTime()) / (1000 * 60);
          
          if (minutesSinceRecording < 5) {
            console.log(`[Bot Processing] Recording completed ${minutesSinceRecording.toFixed(1)} minutes ago, waiting for transcription to start...`);
            return;
          } else {
            console.log(`[Bot Processing] Recording completed ${minutesSinceRecording.toFixed(1)} minutes ago, transcription should be ready. Attempting to fetch...`);
          }
        }

        console.log(`[Bot Processing] Attempting to fetch transcript for meeting ${meeting.id}`);
        const transcript = await this.getTranscript(recallBot.recallBotId);
        if (transcript && transcript.trim()) {
          console.log(`[Bot Processing] Successfully fetched transcript for meeting ${meeting.id} (${transcript.length} characters)`);
          await storage.updateMeeting(meeting.id, { 
            transcript,
            status: 'completed'
          });
          console.log(`[Bot Processing] Updated meeting ${meeting.id} with transcript and completed status`);
        } else {
          console.log(`[Bot Processing] Transcript not ready yet for meeting ${meeting.id}, will try again later`);
        }
      } else {
        console.log(`[Bot Processing] Meeting ${meeting.id} already has a transcript, skipping fetch`);
      }
    } catch (error) {
      console.error(`[Bot Processing] Failed to process meeting: ${error}`);
    }
  }

  // Helper method to manually debug a specific bot
  async debugBot(botId: string): Promise<void> {
    try {
      console.log(`[Debug] Starting debug for bot ${botId}`);
      
      const botStatus = await this.getBotStatus(botId);
      console.log(`[Debug] Full bot status:`, JSON.stringify(botStatus, null, 2));
      
      const transcript = await this.getTranscript(botId);
      console.log(`[Debug] Transcript result:`, transcript ? `${transcript.length} characters` : 'null');
      
    } catch (error) {
      console.error(`[Debug] Error debugging bot ${botId}:`, error);
    }
  }
}

export const recallService = new RecallService();