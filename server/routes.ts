import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { recallService } from "./services/recallService";
import { openaiService } from "./services/openaiService";
import { oauthService } from "./services/oauthService";
import { z } from "zod";
import { insertAutomationSchema, insertCalendarEventSchema, insertSettingsSchema, recallBots, meetings } from "@shared/schema";
import { db } from "./db";
import { eq, inArray } from "drizzle-orm";
import { getUserId, requireAuth, assertUserId } from "./utils/session";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.get('/api/auth/google', (req, res) => {
    const authUrl = oauthService.getGoogleAuthUrl();
    res.json({ url: authUrl });
  });

  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Invalid code parameter' });
      }

      const user = await oauthService.handleGoogleCallback(code);
      
      // Set session
      req.session.userId = user.id;
      
      // Redirect to frontend
      res.redirect('/calendar');
    } catch (error) {
      console.error('Google auth callback error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });

  app.get('/api/auth/linkedin', requireAuth, (req, res) => {
    try {
      const authUrl = oauthService.getLinkedInAuthUrl();
      res.json({ url: authUrl });
    } catch (error) {
      console.error('LinkedIn auth error:', error);
      res.status(500).json({ message: 'Failed to generate LinkedIn auth URL' });
    }
  });

  app.get('/api/auth/linkedin/callback', requireAuth, async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Invalid code parameter' });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      await oauthService.handleLinkedInCallback(code, userId);
      
      // Redirect to settings page
      res.redirect('/settings');
    } catch (error) {
      console.error('LinkedIn auth callback error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });

  app.get('/api/auth/facebook', requireAuth, (req, res) => {
    try {
      const authUrl = oauthService.getFacebookAuthUrl();
      res.json({ url: authUrl });
    } catch (error) {
      console.error('Facebook auth error:', error);
      res.status(500).json({ message: 'Failed to generate Facebook auth URL' });
    }
  });

  app.get('/api/auth/facebook/callback', requireAuth, async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Invalid code parameter' });
      }

      await oauthService.handleFacebookCallback(code, req.session.userId);
      
      // Redirect to settings page
      res.redirect('/settings');
    } catch (error) {
      console.error('Facebook auth callback error:', error);
      res.status(500).json({ message: 'Authentication failed' });
    }
  });

  app.get('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/user', requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ message: 'Failed to get user' });
    }
  });

  // Google accounts
  app.get('/api/google-accounts', requireAuth, async (req, res) => {
    try {
      const accounts = await storage.getGoogleAccountsByUserId(req.session.userId);
      res.json(accounts);
    } catch (error) {
      console.error('Get Google accounts error:', error);
      res.status(500).json({ message: 'Failed to get Google accounts' });
    }
  });

  app.delete('/api/google-accounts/:id', requireAuth, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ message: 'Invalid account ID' });
      }
      
      const account = await storage.getGoogleAccount(accountId);
      if (!account || account.userId !== req.session.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.disconnectGoogleAccount(accountId);
      res.json({ success: true });
    } catch (error) {
      console.error('Disconnect Google account error:', error);
      res.status(500).json({ message: 'Failed to disconnect Google account' });
    }
  });

  // Calendar events
  app.get('/api/calendar-events', requireAuth, async (req, res) => {
    try {
      const events = await storage.getUpcomingCalendarEventsByUserId(req.session.userId);
      res.json(events);
    } catch (error) {
      console.error('Get calendar events error:', error);
      res.status(500).json({ message: 'Failed to get calendar events' });
    }
  });

  app.post('/api/calendar-events/sync', requireAuth, async (req, res) => {
    try {
      const googleAccounts = await storage.getGoogleAccountsByUserId(req.session.userId);
      const syncResults = [];
      
      for (const account of googleAccounts) {
        try {
          const eventsData = await oauthService.fetchCalendarEvents(account.id);
          
          for (const event of eventsData.items) {
            // Skip events without a start time or hangout/zoom/teams link
            if (!event.start || !event.start.dateTime) continue;
            
            // Parse and validate dates
            let startTime: Date;
            let endTime: Date;
            try {
              startTime = new Date(event.start.dateTime);
              endTime = new Date(event.end.dateTime);
              
              // Validate dates
              if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                console.error(`Invalid date for event ${event.id}: start=${event.start.dateTime}, end=${event.end.dateTime}`);
                continue;
              }
            } catch (error) {
              console.error(`Error parsing dates for event ${event.id}:`, error);
              continue;
            }
            
            // Extract meeting links
            let meetingLink = null;
            let platform = null;
            
            // Check for Google Meet link
            if (event.hangoutLink) {
              meetingLink = event.hangoutLink;
              platform = 'meet';
            }
            
            // Check for Zoom or Teams link in description or location
            const zoomRegex = /https:\/\/.*zoom\.us\/[j|my]\/[0-9a-zA-Z?=&]+/i;
            const teamsRegex = /https:\/\/teams\.microsoft\.com\/[a-zA-Z0-9\/?=._-]+/i;
            
            const description = event.description || '';
            const location = event.location || '';
            
            let zoomMatch = description.match(zoomRegex) || location.match(zoomRegex);
            let teamsMatch = description.match(teamsRegex) || location.match(teamsRegex);
            
            if (zoomMatch && !meetingLink) {
              meetingLink = zoomMatch[0];
              platform = 'zoom';
            } else if (teamsMatch && !meetingLink) {
              meetingLink = teamsMatch[0];
              platform = 'teams';
            }
            
            // Skip if no meeting link found
            if (!meetingLink) continue;
            
            // Check if event already exists
            const existingEvent = await storage.getCalendarEventByEventId(account.id, event.id);
            
            // Parse attendees
            const attendees = event.attendees ? 
              event.attendees.map((attendee: any) => ({
                email: attendee.email,
                name: attendee.displayName || attendee.email.split('@')[0],
                responseStatus: attendee.responseStatus
              })) : [];
            
            if (existingEvent) {
              // Update existing event
              await storage.updateCalendarEvent(existingEvent.id, {
                title: event.summary,
                description: event.description,
                startTime,
                endTime,
                meetingLink,
                platform,
                attendees
              });
            } else {
              // Create new event
              const calendarEvent = {
                googleAccountId: account.id,
                eventId: event.id,
                title: event.summary,
                description: event.description,
                startTime,
                endTime,
                meetingLink,
                platform,
                attendees,
                isRecordingEnabled: false
              };
              
              const validatedEvent = insertCalendarEventSchema.parse(calendarEvent);
              await storage.createCalendarEvent(validatedEvent);
            }
          }
          
          syncResults.push({ account: account.email, success: true });
        } catch (error) {
          console.error(`Error syncing calendar for ${account.email}:`, error);
          syncResults.push({ account: account.email, success: false, error: error.message });
        }
      }
      
      res.json({ results: syncResults });
    } catch (error) {
      console.error('Sync calendar events error:', error);
      res.status(500).json({ message: 'Failed to sync calendar events' });
    }
  });

  app.patch('/api/calendar-events/:id/toggle-recording', requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: 'Invalid event ID' });
      }
      
      const event = await storage.getCalendarEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: 'Calendar event not found' });
      }
      
      // Verify user owns the Google account for this event
      const googleAccount = await storage.getGoogleAccount(event.googleAccountId);
      if (!googleAccount || googleAccount.userId !== req.session.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const isRecordingEnabled = req.body.isRecordingEnabled;
      if (typeof isRecordingEnabled !== 'boolean') {
        return res.status(400).json({ message: 'Invalid recording status' });
      }
      
      const updated = await storage.updateCalendarEvent(eventId, { isRecordingEnabled });
      
      // If enabling recording, schedule a Recall bot
      if (isRecordingEnabled && eventId) {
        let meeting = null;
        let bot = null;

        try {
          // Check if a bot already exists
          const existingBot = await storage.getRecallBotByCalendarEventId(eventId);
          if (!existingBot) {
            // Get user settings
            const userSettings = await storage.getSettings(req.session.userId);
            
            // Calculate when the bot should join
            const joinTime = new Date(event.startTime);
            joinTime.setMinutes(joinTime.getMinutes() - (userSettings?.botJoinMinutesBefore || 5));
            
            // Only create a bot if the meeting is in the future
            if (joinTime > new Date()) {
              try {
                console.log(`[Meeting Setup] Starting setup for event ${eventId} - "${event.title}"`);
                console.log(`[Meeting Setup] Bot will join at ${joinTime.toISOString()}`);
                
                // Create the meeting record first
                meeting = await storage.createMeeting({
                  userId: req.session.userId,
                  calendarEventId: eventId,
                  title: event.title,
                  startTime: event.startTime,
                  endTime: event.endTime,
                  platform: event.platform,
                  attendees: event.attendees,
                  status: 'scheduled'
                });

                console.log(`[Meeting Setup] Created meeting record (ID: ${meeting.id}) for event ${eventId}`);

                // Then create the Recall bot
                bot = await recallService.createBot(event, req.session.userId);
                
                // Update the meeting with the bot ID
                if (bot) {
                  await storage.updateMeeting(meeting.id, {
                    recallBotId: bot.id
                  });
                  console.log(`[Meeting Setup] Created bot (ID: ${bot.id}) and linked to meeting ${meeting.id}`);
                  console.log(`[Meeting Setup] Bot will join ${userSettings?.botJoinMinutesBefore || 5} minutes before meeting starts`);
                }

              } catch (error) {
                console.error('[Meeting Setup] Error creating meeting or bot:', error);
                // If we created a meeting but bot creation failed, update the meeting status
                if (meeting && !bot) {
                  await storage.updateMeeting(meeting.id, {
                    status: 'failed',
                    transcript: 'Failed to create recording bot'
                  });
                  console.log(`[Meeting Setup] Updated meeting ${meeting.id} status to failed due to bot creation error`);
                }
                // Don't re-throw the error, just log it
              }
            } else {
              console.log(`[Meeting Setup] Skipping bot creation for past event ${eventId} - "${event.title}"`);
            }
          } else {
            console.log(`[Meeting Setup] Bot already exists for event ${eventId} - "${event.title}"`);
          }
        } catch (error) {
          console.error('[Meeting Setup] Error in recording setup:', error);
          // Don't re-throw the error, just log it
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Toggle recording error:', error);
      res.status(500).json({ message: 'Failed to toggle recording status' });
    }
  });

  // Meetings
  app.get('/api/meetings', requireAuth, async (req, res) => {
    try {
      const meetings = await storage.getMeetingsByUserId(req.session.userId);
      res.json(meetings);
    } catch (error) {
      console.error('Get meetings error:', error);
      res.status(500).json({ message: 'Failed to get meetings' });
    }
  });

  app.get('/api/meetings/:id', requireAuth, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || meeting.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      res.json(meeting);
    } catch (error) {
      console.error('Get meeting error:', error);
      res.status(500).json({ message: 'Failed to get meeting' });
    }
  });

  // Meeting contents (follow-up emails, social posts)
  app.get('/api/meetings/:id/contents', requireAuth, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || meeting.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      const contents = await storage.getMeetingContentsByMeetingId(meetingId);
      res.json(contents);
    } catch (error) {
      console.error('Get meeting contents error:', error);
      res.status(500).json({ message: 'Failed to get meeting contents' });
    }
  });

  app.post('/api/meetings/:id/generate-email', requireAuth, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || meeting.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      if (!meeting.transcript) {
        return res.status(400).json({ message: 'Meeting has no transcript' });
      }
      
      // Check if follow-up email already exists
      const existingEmails = await storage.getMeetingContentsByMeetingIdAndType(meetingId, 'follow_up_email');
      if (existingEmails.length > 0) {
        return res.json(existingEmails[0]);
      }
      
      // Generate follow-up email
      const emailContent = await openaiService.generateFollowUpEmail(meeting);
      
      // Save to database
      const content = await storage.createMeetingContent({
        meetingId,
        type: 'follow_up_email',
        content: emailContent,
        status: 'draft'
      });
      
      res.json(content);
    } catch (error) {
      console.error('Generate follow-up email error:', error);
      res.status(500).json({ message: 'Failed to generate follow-up email' });
    }
  });

  app.post('/api/meetings/:id/generate-social-post', requireAuth, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      const { platform, automationId } = req.body;
      if (!platform) {
        return res.status(400).json({ message: 'Platform is required' });
      }
      
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || meeting.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Meeting not found' });
      }
      
      if (!meeting.transcript) {
        return res.status(400).json({ message: 'Meeting has no transcript' });
      }
      
      // Get automation if specified
      let prompt = '';
      let automation = null;
      
      if (automationId) {
        automation = await storage.getAutomation(parseInt(automationId));
        if (automation && automation.userId === req.session.userId) {
          prompt = automation.prompt;
        }
      }
      
      // Generate social media post
      const { content, imagePrompt } = await openaiService.generateSocialMediaPost(meeting, platform, prompt);
      
      // Generate image
      const imageUrl = await openaiService.generateImage(imagePrompt);
      
      // Save to database
      const socialPost = await storage.createMeetingContent({
        meetingId,
        type: 'social_post',
        platform,
        automationId: automation?.id,
        content,
        imageUrl,
        status: 'draft'
      });
      
      res.json(socialPost);
    } catch (error) {
      console.error('Generate social post error:', error);
      res.status(500).json({ message: 'Failed to generate social media post' });
    }
  });

  app.post('/api/social-posts/:id/publish', requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ message: 'Invalid post ID' });
      }
      
      const post = await storage.getMeetingContent(postId);
      if (!post || post.type !== 'social_post') {
        return res.status(404).json({ message: 'Social media post not found' });
      }
      
      // Check if user owns this post
      const meeting = await storage.getMeeting(post.meetingId);
      if (!meeting || meeting.userId !== req.session.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Make sure platform is connected
      const socialAccount = await storage.getSocialAccountByPlatformAndUserId(
        req.session.userId,
        post.platform || ''
      );
      
      if (!socialAccount) {
        return res.status(400).json({ message: `${post.platform} account not connected` });
      }
      
      // Post to social media
      let result;
      if (post.platform === 'linkedin') {
        result = await oauthService.postToLinkedIn(req.session.userId, post.content, post.imageUrl);
      } else if (post.platform === 'facebook') {
        result = await oauthService.postToFacebook(req.session.userId, post.content, post.imageUrl);
      } else {
        return res.status(400).json({ message: 'Unsupported platform' });
      }
      
      // Update post status
      const updated = await storage.updateMeetingContent(postId, {
        status: 'published',
        publishedAt: new Date()
      });
      
      res.json({ success: true, post: updated, platformResponse: result });
    } catch (error) {
      console.error('Publish social post error:', error);
      res.status(500).json({ message: 'Failed to publish social media post' });
    }
  });

  // Automations
  app.get('/api/automations', requireAuth, async (req, res) => {
    try {
      const automations = await storage.getAutomationsByUserId(req.session.userId);
      res.json(automations);
    } catch (error) {
      console.error('Get automations error:', error);
      res.status(500).json({ message: 'Failed to get automations' });
    }
  });

  app.post('/api/automations', requireAuth, async (req, res) => {
    try {
      const automationSchema = insertAutomationSchema.extend({
        userId: z.number()
      });
      
      const automation = automationSchema.parse({
        ...req.body,
        userId: req.session.userId
      });
      
      const created = await storage.createAutomation(automation);
      res.status(201).json(created);
    } catch (error) {
      console.error('Create automation error:', error);
      
      if (error.errors) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      
      res.status(500).json({ message: 'Failed to create automation' });
    }
  });

  app.patch('/api/automations/:id', requireAuth, async (req, res) => {
    try {
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ message: 'Invalid automation ID' });
      }
      
      const automation = await storage.getAutomation(automationId);
      if (!automation || automation.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Automation not found' });
      }
      
      const updated = await storage.updateAutomation(automationId, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Update automation error:', error);
      res.status(500).json({ message: 'Failed to update automation' });
    }
  });

  app.delete('/api/automations/:id', requireAuth, async (req, res) => {
    try {
      const automationId = parseInt(req.params.id);
      if (isNaN(automationId)) {
        return res.status(400).json({ message: 'Invalid automation ID' });
      }
      
      const automation = await storage.getAutomation(automationId);
      if (!automation || automation.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Automation not found' });
      }
      
      await storage.deleteAutomation(automationId);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete automation error:', error);
      res.status(500).json({ message: 'Failed to delete automation' });
    }
  });

  // Settings
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      let settings = await storage.getSettings(req.session.userId);
      
      if (!settings) {
        // Create default settings if not exists
        settings = await storage.createSettings({
          userId: req.session.userId,
          botJoinMinutesBefore: 5,
          autoJoinNewEvents: true
        });
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ message: 'Failed to get settings' });
    }
  });

  app.patch('/api/settings', requireAuth, async (req, res) => {
    try {
      const settingsSchema = insertSettingsSchema.pick({
        botJoinMinutesBefore: true,
        autoJoinNewEvents: true
      });
      
      const settings = settingsSchema.parse(req.body);
      
      // Get existing settings or create default
      let existingSettings = await storage.getSettings(req.session.userId);
      
      if (!existingSettings) {
        existingSettings = await storage.createSettings({
          userId: req.session.userId,
          ...settings
        });
      } else {
        existingSettings = await storage.updateSettings(req.session.userId, settings);
      }
      
      res.json(existingSettings);
    } catch (error) {
      console.error('Update settings error:', error);
      
      if (error.errors) {
        return res.status(400).json({ message: 'Validation error', errors: error.errors });
      }
      
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Social media connections
  app.get('/api/social-accounts', requireAuth, async (req, res) => {
    try {
      const accounts = await storage.getSocialAccountsByUserId(req.session.userId);
      res.json(accounts);
    } catch (error) {
      console.error('Get social accounts error:', error);
      res.status(500).json({ message: 'Failed to get social media accounts' });
    }
  });

  app.delete('/api/social-accounts/:id', requireAuth, async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      if (isNaN(accountId)) {
        return res.status(400).json({ message: 'Invalid account ID' });
      }
      
      const account = await storage.getSocialAccount(accountId);
      if (!account || account.userId !== req.session.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      await storage.disconnectSocialAccount(accountId);
      res.json({ success: true });
    } catch (error) {
      console.error('Disconnect social account error:', error);
      res.status(500).json({ message: 'Failed to disconnect social media account' });
    }
  });

  // Temporary route to delete all bots (for testing)
  app.delete('/api/recall-bots/all', requireAuth, async (req, res) => {
    try {
      await db.delete(recallBots);
      res.json({ message: 'All bots deleted successfully' });
    } catch (error) {
      console.error('Delete all bots error:', error);
      res.status(500).json({ message: 'Failed to delete bots' });
    }
  });

  // Temporary route to delete all meetings (for testing)
  app.delete('/api/meetings/all', requireAuth, async (req, res) => {
    try {
      await db.delete(meetings);
      res.json({ message: 'All meetings deleted successfully' });
    } catch (error) {
      console.error('Delete all meetings error:', error);
      res.status(500).json({ message: 'Failed to delete meetings' });
    }
  });

  // Force transcript fetch for a specific meeting
  app.post('/api/meetings/:id/fetch-transcript', requireAuth, async (req, res) => {
    try {
      const meetingId = parseInt(req.params.id);
      if (isNaN(meetingId)) {
        return res.status(400).json({ message: 'Invalid meeting ID' });
      }
      
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting || meeting.userId !== req.session.userId) {
        return res.status(404).json({ message: 'Meeting not found' });
      }

      if (!meeting.recallBotId) {
        return res.status(400).json({ message: 'Meeting has no associated bot' });
      }

      const bot = await storage.getRecallBot(meeting.recallBotId);
      if (!bot) {
        return res.status(404).json({ message: 'Bot not found' });
      }

      console.log(`[Manual Fetch] Attempting to fetch transcript for meeting ${meetingId}`);
      await recallService.processMeeting(bot);
      
      // Get updated meeting data
      const updatedMeeting = await storage.getMeeting(meetingId);
      res.json({
        message: 'Transcript fetch initiated',
        meeting: updatedMeeting
      });
    } catch (error) {
      console.error('Force transcript fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch transcript' });
    }
  });

  // Background task to update bot statuses and process completed meetings
  setInterval(async () => {
    try {
      console.log('[Background Task] Starting background task');
      
      // Get all active bots
      const activeBots = await db.select().from(recallBots).where(
        inArray(recallBots.status, ['scheduled', 'joined', 'joining', 'recording'])
      );
      
      console.log(`[Background Task] Found ${activeBots.length} active bots`);
      
      // Log details of each active bot
      for (const bot of activeBots) {
        console.log(`[Background Task] Active bot ${bot.id}: status=${bot.status}, recallBotId=${bot.recallBotId}`);
      }
      
      for (const bot of activeBots) {
        try {
          const oldStatus = bot.status;
          console.log(`[Background Task] Processing bot ${bot.id} (current status: ${oldStatus})`);
          const updatedBot = await recallService.updateBotStatus(bot);
          
          if (updatedBot.status !== oldStatus) {
            console.log(`[Background Task] Bot ${bot.id} status changed from ${oldStatus} to ${updatedBot.status}`);
            
            // Get the associated meeting
            const meeting = await storage.getMeetingByCalendarEventId(bot.calendarEventId);
            if (meeting) {
              // Update meeting status based on bot status
              let meetingStatus = meeting.status;
              if (updatedBot.status === 'joined') {
                meetingStatus = 'in_progress';
                console.log(`[Background Task] Meeting ${meeting.id} started - bot has joined`);
              } else if (updatedBot.status === 'recording') {
                meetingStatus = 'in_progress';
                console.log(`[Background Task] Meeting ${meeting.id} is being recorded`);
              } else if (updatedBot.status === 'completed') {
                meetingStatus = 'completed';
                console.log(`[Background Task] Meeting ${meeting.id} completed - bot finished recording`);
                console.log(`[Background Task] Will attempt to fetch transcript for meeting ${meeting.id}`);
              } else if (updatedBot.status === 'failed') {
                meetingStatus = 'failed';
                console.log(`[Background Task] Meeting ${meeting.id} failed - bot encountered an error`);
              }
              
              if (meetingStatus !== meeting.status) {
                await storage.updateMeeting(meeting.id, { status: meetingStatus });
                console.log(`[Background Task] Updated meeting ${meeting.id} status to ${meetingStatus}`);
              }
            } else {
              console.error(`[Background Task] No meeting found for bot ${bot.id} (calendar event ${bot.calendarEventId})`);
            }
          } else {
            console.log(`[Background Task] Bot ${bot.id} status unchanged: ${oldStatus}`);
          }
        } catch (error) {
          console.error(`[Background Task] Error processing bot ${bot.id}:`, error);
          if (error instanceof Error) {
            console.error(`[Background Task] Error details: ${error.message}`);
            console.error(`[Background Task] Error stack: ${error.stack}`);
          }
        }
      }
      
      // Process completed bots
      const completedBots = await db.select().from(recallBots).where(
        eq(recallBots.status, 'completed')
      );
      
      console.log(`[Background Task] Found ${completedBots.length} completed bots to process`);
      
      for (const bot of completedBots) {
        try {
          console.log(`[Background Task] Processing completed bot ${bot.id}`);
          const meeting = await storage.getMeetingByCalendarEventId(bot.calendarEventId);
          if (meeting) {
            console.log(`[Background Task] Found meeting ${meeting.id} for bot ${bot.id}`);
            if (!meeting.transcript) {
              console.log(`[Background Task] No transcript found for meeting ${meeting.id}, will attempt to fetch`);
            } else {
              console.log(`[Background Task] Meeting ${meeting.id} already has a transcript`);
            }
          } else {
            console.error(`[Background Task] No meeting found for bot ${bot.id}`);
          }
          await recallService.processMeeting(bot);
          console.log(`[Background Task] Finished processing bot ${bot.id}`);
        } catch (error) {
          console.error(`[Background Task] Error processing completed bot ${bot.id}:`, error);
          if (error instanceof Error) {
            console.error(`[Background Task] Error details: ${error.message}`);
            console.error(`[Background Task] Error stack: ${error.stack}`);
          }
        }
      }
      
      console.log('[Background Task] Finished background task');
    } catch (error) {
      console.error('[Background Task] Error:', error);
      if (error instanceof Error) {
        console.error(`[Background Task] Error details: ${error.message}`);
        console.error(`[Background Task] Error stack: ${error.stack}`);
      }
    }
  }, 60000); // Run every minute

  const httpServer = createServer(app);

  return httpServer;
}