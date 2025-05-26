import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User accounts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  picture: text("picture"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Google account connections
export const googleAccounts = pgTable("google_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  picture: text("picture"),
  isConnected: boolean("is_connected").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Social media connections
export const socialAccounts = pgTable("social_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // 'linkedin', 'facebook'
  platformUserId: text("platform_user_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  name: text("name").notNull(),
  email: text("email"),
  picture: text("picture"),
  isConnected: boolean("is_connected").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Calendar events from Google
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  googleAccountId: integer("google_account_id").notNull().references(() => googleAccounts.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull(), // Google Calendar event ID
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  meetingLink: text("meeting_link"), // Zoom, Teams, Meet link
  platform: text("platform"), // 'zoom', 'teams', 'meet'
  attendees: jsonb("attendees"), // Array of attendees
  isRecordingEnabled: boolean("is_recording_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Recall.ai bots
export const recallBots = pgTable("recall_bots", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  calendarEventId: integer("calendar_event_id").notNull().references(() => calendarEvents.id, { onDelete: "cascade" }),
  recallBotId: text("recall_bot_id").notNull(),
  status: text("status").notNull(), // 'scheduled', 'joined', 'recording', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Meeting recordings and transcripts
export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  calendarEventId: integer("calendar_event_id").notNull().references(() => calendarEvents.id, { onDelete: "cascade" }),
  recallBotId: integer("recall_bot_id").references(() => recallBots.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  platform: text("platform"), // 'zoom', 'teams', 'meet'
  transcript: text("transcript"),
  attendees: jsonb("attendees"), // Array of attendees with names and emails
  status: text("status").notNull(), // 'scheduled', 'in_progress', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Meeting content (follow-up emails, social posts)
export const meetingContents = pgTable("meeting_contents", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'follow_up_email', 'social_post'
  platform: text("platform"), // null for email, 'linkedin', 'facebook' for social
  automationId: integer("automation_id").references(() => automations.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  status: text("status").notNull(), // 'draft', 'published'
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Content generation automations
export const automations = pgTable("automations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // 'linkedin', 'facebook'
  prompt: text("prompt").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User settings
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  botJoinMinutesBefore: integer("bot_join_minutes_before").default(5).notNull(),
  autoJoinNewEvents: boolean("auto_join_new_events").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertGoogleAccountSchema = createInsertSchema(googleAccounts).omit({ id: true, createdAt: true });
export const insertSocialAccountSchema = createInsertSchema(socialAccounts).omit({ id: true, createdAt: true });
export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true });
export const insertRecallBotSchema = createInsertSchema(recallBots).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMeetingContentSchema = createInsertSchema(meetingContents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAutomationSchema = createInsertSchema(automations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type InsertGoogleAccount = z.infer<typeof insertGoogleAccountSchema>;

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = z.infer<typeof insertSocialAccountSchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type RecallBot = typeof recallBots.$inferSelect;
export type InsertRecallBot = z.infer<typeof insertRecallBotSchema>;

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type MeetingContent = typeof meetingContents.$inferSelect;
export type InsertMeetingContent = z.infer<typeof insertMeetingContentSchema>;

export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
