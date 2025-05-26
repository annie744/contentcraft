import {
  users, User, InsertUser,
  googleAccounts, GoogleAccount, InsertGoogleAccount,
  socialAccounts, SocialAccount, InsertSocialAccount,
  calendarEvents, CalendarEvent, InsertCalendarEvent,
  recallBots, RecallBot, InsertRecallBot,
  meetings, Meeting, InsertMeeting,
  meetingContents, MeetingContent, InsertMeetingContent,
  automations, Automation, InsertAutomation,
  settings, Settings, InsertSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, desc, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Google Accounts
  getGoogleAccount(id: number): Promise<GoogleAccount | undefined>;
  getGoogleAccountByEmail(email: string): Promise<GoogleAccount | undefined>;
  getGoogleAccountsByUserId(userId: number): Promise<GoogleAccount[]>;
  createGoogleAccount(account: InsertGoogleAccount): Promise<GoogleAccount>;
  updateGoogleAccount(id: number, data: Partial<InsertGoogleAccount>): Promise<GoogleAccount>;
  disconnectGoogleAccount(id: number): Promise<void>;
  
  // Social Accounts
  getSocialAccount(id: number): Promise<SocialAccount | undefined>;
  getSocialAccountsByUserId(userId: number): Promise<SocialAccount[]>;
  getSocialAccountByPlatformAndUserId(userId: number, platform: string): Promise<SocialAccount | undefined>;
  createSocialAccount(account: InsertSocialAccount): Promise<SocialAccount>;
  updateSocialAccount(id: number, data: Partial<InsertSocialAccount>): Promise<SocialAccount>;
  disconnectSocialAccount(id: number): Promise<void>;
  
  // Calendar Events
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  getCalendarEventByEventId(googleAccountId: number, eventId: string): Promise<CalendarEvent | undefined>;
  getUpcomingCalendarEventsByUserId(userId: number): Promise<CalendarEvent[]>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  
  // Recall Bots
  getRecallBot(id: number): Promise<RecallBot | undefined>;
  getRecallBotByRecallBotId(recallBotId: string): Promise<RecallBot | undefined>;
  getRecallBotByCalendarEventId(calendarEventId: number): Promise<RecallBot | undefined>;
  createRecallBot(bot: InsertRecallBot): Promise<RecallBot>;
  updateRecallBot(id: number, data: Partial<InsertRecallBot>): Promise<RecallBot>;
  
  // Meetings
  getMeeting(id: number): Promise<Meeting | undefined>;
  getMeetingsByUserId(userId: number): Promise<Meeting[]>;
  getMeetingByCalendarEventId(calendarEventId: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, data: Partial<InsertMeeting>): Promise<Meeting>;
  
  // Meeting Contents
  getMeetingContent(id: number): Promise<MeetingContent | undefined>;
  getMeetingContentsByMeetingId(meetingId: number): Promise<MeetingContent[]>;
  getMeetingContentsByMeetingIdAndType(meetingId: number, type: string): Promise<MeetingContent[]>;
  createMeetingContent(content: InsertMeetingContent): Promise<MeetingContent>;
  updateMeetingContent(id: number, data: Partial<InsertMeetingContent>): Promise<MeetingContent>;
  
  // Automations
  getAutomation(id: number): Promise<Automation | undefined>;
  getAutomationsByUserId(userId: number): Promise<Automation[]>;
  getActiveAutomationsByUserId(userId: number): Promise<Automation[]>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(id: number, data: Partial<InsertAutomation>): Promise<Automation>;
  deleteAutomation(id: number): Promise<void>;
  
  // Settings
  getSettings(userId: number): Promise<Settings | undefined>;
  createSettings(settings: InsertSettings): Promise<Settings>;
  updateSettings(userId: number, data: Partial<InsertSettings>): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Google Accounts
  async getGoogleAccount(id: number): Promise<GoogleAccount | undefined> {
    const [account] = await db.select().from(googleAccounts).where(eq(googleAccounts.id, id));
    return account;
  }

  async getGoogleAccountByEmail(email: string): Promise<GoogleAccount | undefined> {
    const [account] = await db.select().from(googleAccounts).where(eq(googleAccounts.email, email));
    return account;
  }

  async getGoogleAccountsByUserId(userId: number): Promise<GoogleAccount[]> {
    return db.select().from(googleAccounts).where(eq(googleAccounts.userId, userId));
  }

  async createGoogleAccount(account: InsertGoogleAccount): Promise<GoogleAccount> {
    const [newAccount] = await db.insert(googleAccounts).values(account).returning();
    return newAccount;
  }

  async updateGoogleAccount(id: number, data: Partial<InsertGoogleAccount>): Promise<GoogleAccount> {
    const [updated] = await db.update(googleAccounts).set(data).where(eq(googleAccounts.id, id)).returning();
    return updated;
  }

  async disconnectGoogleAccount(id: number): Promise<void> {
    await db.update(googleAccounts).set({ isConnected: false }).where(eq(googleAccounts.id, id));
  }

  // Social Accounts
  async getSocialAccount(id: number): Promise<SocialAccount | undefined> {
    const [account] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, id));
    return account;
  }

  async getSocialAccountsByUserId(userId: number): Promise<SocialAccount[]> {
    return db.select().from(socialAccounts).where(eq(socialAccounts.userId, userId));
  }

  async getSocialAccountByPlatformAndUserId(userId: number, platform: string): Promise<SocialAccount | undefined> {
    const [account] = await db.select().from(socialAccounts).where(
      and(
        eq(socialAccounts.userId, userId),
        eq(socialAccounts.platform, platform),
        eq(socialAccounts.isConnected, true)
      )
    );
    return account;
  }

  async createSocialAccount(account: InsertSocialAccount): Promise<SocialAccount> {
    const [newAccount] = await db.insert(socialAccounts).values(account).returning();
    return newAccount;
  }

  async updateSocialAccount(id: number, data: Partial<InsertSocialAccount>): Promise<SocialAccount> {
    const [updated] = await db.update(socialAccounts).set(data).where(eq(socialAccounts.id, id)).returning();
    return updated;
  }

  async disconnectSocialAccount(id: number): Promise<void> {
    await db.update(socialAccounts).set({ isConnected: false }).where(eq(socialAccounts.id, id));
  }

  // Calendar Events
  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event;
  }

  async getCalendarEventByEventId(googleAccountId: number, eventId: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(
      and(
        eq(calendarEvents.googleAccountId, googleAccountId),
        eq(calendarEvents.eventId, eventId)
      )
    );
    return event;
  }

  async getUpcomingCalendarEventsByUserId(userId: number): Promise<CalendarEvent[]> {
    const userGoogleAccounts = await this.getGoogleAccountsByUserId(userId);
    if (userGoogleAccounts.length === 0) return [];
    
    const googleAccountIds = userGoogleAccounts.map(account => account.id);
    
    const now = new Date();
    return db.select().from(calendarEvents)
      .where(
        and(
          inArray(calendarEvents.googleAccountId, googleAccountIds),
          gte(calendarEvents.startTime, now)
        )
      )
      .orderBy(calendarEvents.startTime);
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [newEvent] = await db.insert(calendarEvents).values(event).returning();
    return newEvent;
  }

  async updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [updated] = await db.update(calendarEvents).set(data).where(eq(calendarEvents.id, id)).returning();
    return updated;
  }

  // Recall Bots
  async getRecallBot(id: number): Promise<RecallBot | undefined> {
    const [bot] = await db.select().from(recallBots).where(eq(recallBots.id, id));
    return bot;
  }

  async getRecallBotByRecallBotId(recallBotId: string): Promise<RecallBot | undefined> {
    const [bot] = await db.select().from(recallBots).where(eq(recallBots.recallBotId, recallBotId));
    return bot;
  }

  async getRecallBotByCalendarEventId(calendarEventId: number): Promise<RecallBot | undefined> {
    const [bot] = await db.select().from(recallBots).where(eq(recallBots.calendarEventId, calendarEventId));
    return bot;
  }

  async createRecallBot(bot: InsertRecallBot): Promise<RecallBot> {
    const [newBot] = await db.insert(recallBots).values(bot).returning();
    return newBot;
  }

  async updateRecallBot(id: number, data: Partial<InsertRecallBot>): Promise<RecallBot> {
    const [updated] = await db.update(recallBots)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recallBots.id, id))
      .returning();
    return updated;
  }

  // Meetings
  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async getMeetingsByUserId(userId: number): Promise<Meeting[]> {
    return db.select().from(meetings)
      .where(eq(meetings.userId, userId))
      .orderBy(desc(meetings.startTime));
  }

  async getMeetingByCalendarEventId(calendarEventId: number): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.calendarEventId, calendarEventId));
    return meeting;
  }

  async createMeeting(meetingData: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(meetingData).returning();
    return meeting;
  }

  async updateMeeting(id: number, data: Partial<InsertMeeting>): Promise<Meeting> {
    const [updated] = await db.update(meetings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(meetings.id, id))
      .returning();
    return updated;
  }

  // Meeting Contents
  async getMeetingContent(id: number): Promise<MeetingContent | undefined> {
    const [content] = await db.select().from(meetingContents).where(eq(meetingContents.id, id));
    return content;
  }

  async getMeetingContentsByMeetingId(meetingId: number): Promise<MeetingContent[]> {
    return db.select().from(meetingContents).where(eq(meetingContents.meetingId, meetingId));
  }

  async getMeetingContentsByMeetingIdAndType(meetingId: number, type: string): Promise<MeetingContent[]> {
    return db.select().from(meetingContents).where(
      and(
        eq(meetingContents.meetingId, meetingId),
        eq(meetingContents.type, type)
      )
    );
  }

  async createMeetingContent(contentData: InsertMeetingContent): Promise<MeetingContent> {
    const [content] = await db.insert(meetingContents).values(contentData).returning();
    return content;
  }

  async updateMeetingContent(id: number, data: Partial<InsertMeetingContent>): Promise<MeetingContent> {
    const [updated] = await db.update(meetingContents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(meetingContents.id, id))
      .returning();
    return updated;
  }

  // Automations
  async getAutomation(id: number): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id));
    return automation;
  }

  async getAutomationsByUserId(userId: number): Promise<Automation[]> {
    return db.select().from(automations).where(eq(automations.userId, userId));
  }

  async getActiveAutomationsByUserId(userId: number): Promise<Automation[]> {
    return db.select().from(automations).where(
      and(
        eq(automations.userId, userId),
        eq(automations.isActive, true)
      )
    );
  }

  async createAutomation(automationData: InsertAutomation): Promise<Automation> {
    const [automation] = await db.insert(automations).values(automationData).returning();
    return automation;
  }

  async updateAutomation(id: number, data: Partial<InsertAutomation>): Promise<Automation> {
    const [updated] = await db.update(automations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automations.id, id))
      .returning();
    return updated;
  }

  async deleteAutomation(id: number): Promise<void> {
    await db.delete(automations).where(eq(automations.id, id));
  }

  // Settings
  async getSettings(userId: number): Promise<Settings | undefined> {
    const [userSettings] = await db.select().from(settings).where(eq(settings.userId, userId));
    return userSettings;
  }

  async createSettings(settingsData: InsertSettings): Promise<Settings> {
    const [userSettings] = await db.insert(settings).values(settingsData).returning();
    return userSettings;
  }

  async updateSettings(userId: number, data: Partial<InsertSettings>): Promise<Settings> {
    const [updated] = await db.update(settings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(settings.userId, userId))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
