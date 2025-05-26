# Assessment Tracker

A web application for tracking and managing assessments, meetings, and social media content.

## Setup

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Environment Setup:
   - Copy `.env.sample` to `.env`:
   ```bash
   cp .env.sample .env
   ```
   - Update the values in `.env` with your own credentials:
     - For Google OAuth: Create a project in [Google Cloud Console](https://console.cloud.google.com)
     - For Facebook OAuth: Create an app in [Facebook Developers](https://developers.facebook.com)
     - For LinkedIn OAuth: Create an app in [LinkedIn Developers](https://www.linkedin.com/developers)
     - For Recall.ai: Sign up at [Recall.ai](https://recall.ai)

4. Set up the database:
```bash
npm run db:migrate
```

5. Start the development server:
```bash
npm run dev
```

## Environment Variables

### Server Configuration
- `PORT`: The port number the server will run on (default: 5000)
- `NODE_ENV`: Environment mode (development/production)
- `SESSION_SECRET`: Secret key for session management (generate a random string)

### Database
- `DATABASE_URL`: PostgreSQL connection string
  - Format: `postgres://username:password@host:port/database_name`
  - Default development: `postgres://postgres:postgres@localhost:5432/assessment_tracker`

### OAuth Configuration
#### Google
- `GOOGLE_CLIENT_ID`: From Google Cloud Console > Credentials > OAuth 2.0 Client IDs
- `GOOGLE_CLIENT_SECRET`: From Google Cloud Console > Credentials > OAuth 2.0 Client IDs
- `GOOGLE_CALLBACK_URL`: Must match the authorized redirect URI in Google Cloud Console
  - Development: `http://localhost:5000/api/auth/google/callback`
  - Production: `https://yourdomain.com/api/auth/google/callback`

#### Facebook
- `FACEBOOK_APP_ID`: From Facebook Developers > Your App > Settings > Basic
- `FACEBOOK_APP_SECRET`: From Facebook Developers > Your App > Settings > Basic
- `FACEBOOK_REDIRECT_URI`: Must match the OAuth redirect URI in Facebook App Settings
  - Development: `http://localhost:5000/api/auth/facebook/callback`
  - Production: `https://yourdomain.com/api/auth/facebook/callback`

#### LinkedIn
- `LINKEDIN_CLIENT_ID`: From LinkedIn Developers > Your App > Auth
- `LINKEDIN_CLIENT_SECRET`: From LinkedIn Developers > Your App > Auth
- `LINKEDIN_REDIRECT_URI`: Must match the authorized redirect URL in LinkedIn App Settings
  - Development: `http://localhost:5000/api/auth/linkedin/callback`
  - Production: `https://yourdomain.com/api/auth/linkedin/callback`

### Recall.ai API
- `RECALL_API_KEY`: Your API key from Recall.ai dashboard
- `RECALL_API_URL`: Recall.ai API base URL (default: `https://api.recall.ai/api/v1`)

## Development

The application uses:
- React + TypeScript for the frontend
- Express.js for the backend
- PostgreSQL for the database
- Drizzle ORM for database operations
- OAuth2 for authentication
- Recall.ai for meeting recordings

## Application Flow

### Authentication Flow
1. User clicks on a social login button (Google/Facebook/LinkedIn)
2. User is redirected to the respective OAuth provider
3. After successful authentication, user is redirected back to the application
4. The application creates/updates the user record and establishes a session
5. User is redirected to the dashboard

### Meeting Recording Flow
1. User connects their meeting platform (Zoom/Teams/Meet) through Recall.ai
2. When a meeting starts, Recall.ai automatically begins recording
3. After the meeting ends:
   - Recording is processed by Recall.ai
   - Transcript and insights are generated
   - Data is stored in the application database
4. User can view meeting recordings, transcripts, and insights in the dashboard

### Assessment Flow
1. User creates a new assessment
2. Assessment details are stored in the database
3. User can:
   - Add meeting recordings to the assessment
   - Add social media content
   - Add notes and comments
   - Track progress and status
4. Assessment data is organized and displayed in the dashboard

### Social Media Integration
1. User connects their social media accounts
2. Social media content can be:
   - Manually added to assessments
   - Automatically tracked based on keywords
   - Analyzed for insights
3. Content is stored and organized in the database

### Dashboard Features
- View all assessments and their status
- Access meeting recordings and transcripts
- Track social media content
- Generate reports and analytics
- Manage user settings and preferences

## Dashboard and Core Functionality

### Meeting Automation & Recall.ai Integration
- The app uses Recall.ai to send a notetaker bot to meetings on your calendar (Zoom, Teams, Google Meet).
- When you connect your calendar or add an event, the app detects meeting links and ensures a Recall bot joins a configurable number of minutes before the meeting starts.
- After the meeting, it appears in a list of past meetings, showing attendees, start time, and platform logo.
- The app uses polling to check for available meeting media due to shared API key usage.

### Meeting Details & Actions
- For each past meeting, you can:
  - View the full transcript.
  - View an AI-generated draft follow-up email summarizing the meeting.
  - See a list of social media posts generated by your automations for that meeting.
  - View and edit a draft AI-generated social media post (with example content and hashtags).
  - Copy the draft post or publish it directly to your connected social media accounts (LinkedIn, Facebook).

### Social Media Automation
- Configure automations to generate marketing content for different platforms (e.g., LinkedIn, Facebook).
- Each automation can specify:
  - Name, type, and platform.
  - Description of what the automation does (e.g., generate a LinkedIn post summarizing the meeting in first person, with hashtags).
  - Example output for reference.

### Settings & Integrations
- Settings page allows you to:
  - Connect LinkedIn and Facebook accounts via OAuth.
  - Configure how many minutes before a meeting the bot should join.
  - Manage and add automations for post generation.

### UI Features
- Draft post modal includes:
  - Example post text, hashtags, and disclaimers.
  - "Copy" button for easy copying.
  - "Post" button to publish directly to social media.
  - Cancel and Save/Close options.
- Automations can be created, edited, and deleted from the UI.

![alt text](image-9.png)
![alt text](image-11.png)
![alt text](image-10.png)
![alt text](image-7.png)
![alt text](image-4.png)
![alt text](image-5.png)
![alt text](image-6.png)

## Production Deployment

For production deployment:

1. Update the OAuth callback URLs in your `.env` to use your production domain:
```env
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
FACEBOOK_REDIRECT_URI=https://yourdomain.com/api/auth/facebook/callback
LINKEDIN_REDIRECT_URI=https://yourdomain.com/api/auth/linkedin/callback
```

2. Set `NODE_ENV=production`

3. Ensure all environment variables are properly set in your production environment

4. Build and deploy:
```bash
npm run build
npm start
```

## Troubleshooting

### OAuth Issues
- Make sure all callback URLs are correctly configured in both your `.env` and the respective developer consoles
- Check that your app's OAuth scopes include all necessary permissions
- Verify that your app is properly configured for the correct environment (development/production)

### Database Issues
- Ensure PostgreSQL is running and accessible
- Verify the database credentials in your `DATABASE_URL`
- Check that the database exists and migrations have been run

### Recall.ai Issues
- Verify your API key is valid
- Check that your account has sufficient credits
- Ensure the meeting platform (Zoom/Teams/Meet) is properly configured

## License

MIT 