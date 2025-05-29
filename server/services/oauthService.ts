import { OAuth2Client } from 'google-auth-library';
import { storage } from '../storage';
import { InsertGoogleAccount, InsertSocialAccount, InsertUser, User } from '@shared/schema';
import fetch from 'node-fetch';

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
}

class OAuthService {
  private googleClient: OAuth2Client;
  
  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    
    if (!clientId || !clientSecret || !callbackUrl) {
      throw new Error('Google OAuth credentials are missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL environment variables.');
    }
      
    this.googleClient = new OAuth2Client(
      clientId,
      clientSecret,
      callbackUrl
    );
  }

  // Google OAuth URL generator
  getGoogleAuthUrl() {
    return this.googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly'
      ],
      prompt: 'consent'
    });
  }

  // Handle Google OAuth callback
  async handleGoogleCallback(code: string): Promise<User> {
    try {
      console.log('Starting Google OAuth callback with code:', code);
      
      // Exchange code for tokens
      console.log('Attempting to exchange code for tokens...');
      const { tokens } = await this.googleClient.getToken(code) as { tokens: GoogleTokenResponse };
      console.log('Successfully obtained tokens');
      
      this.googleClient.setCredentials(tokens);
      console.log('Set credentials in OAuth client');

      // Get user info
      console.log('Fetching user info from Google...');
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      
      if (!userInfoResponse.ok) {
        console.error('Failed to fetch user info. Status:', userInfoResponse.status);
        const errorText = await userInfoResponse.text();
        console.error('Error response:', errorText);
        throw new Error('Failed to fetch Google user info');
      }

      const userInfo = await userInfoResponse.json() as GoogleUserInfo;
      console.log('Successfully fetched user info:', { email: userInfo.email, name: userInfo.name });
      
      // Check if user exists
      let user = await storage.getUserByEmail(userInfo.email);

      // Create user if doesn't exist
      if (!user) {
        console.log('Creating new user...');
        const newUser: InsertUser = {
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture
        };
        user = await storage.createUser(newUser);
        console.log('Created new user:', user.id);
        
        // Create default settings for the new user
        await storage.createSettings({
          userId: user.id,
          botJoinMinutesBefore: 5,
          autoJoinNewEvents: true
        });
      }

      // Check if this Google account is already connected
      const existingAccount = await storage.getGoogleAccountByEmail(userInfo.email);
      
      if (existingAccount) {
        console.log('Updating existing Google account...');
        // Update tokens
        await storage.updateGoogleAccount(existingAccount.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || existingAccount.refreshToken,
          expiresAt: new Date(Date.now() + (tokens.expiry_date - Date.now())),
          isConnected: true
        });
      } else {
        console.log('Creating new Google account connection...');
        // Create new Google account connection
        const googleAccount: InsertGoogleAccount = {
          userId: user.id,
          email: userInfo.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token!,
          expiresAt: new Date(Date.now() + (tokens.expiry_date - Date.now())),
          picture: userInfo.picture
        };
        
        await storage.createGoogleAccount(googleAccount);
      }

      return user;
    } catch (error: any) {
      console.error('Google OAuth error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        response: error.response?.data
      });
      throw new Error('Failed to authenticate with Google');
    }
  }

  // Facebook OAuth URL generator
  getFacebookAuthUrl() {
    const clientId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      throw new Error('Facebook credentials are missing. Set FACEBOOK_APP_ID and FACEBOOK_REDIRECT_URI environment variables.');
    }
    
    // Try without explicit scope parameter - Facebook will use default permissions
    return `https://www.facebook.com/v17.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
  }

  // Handle Facebook OAuth callback
  async handleFacebookCallback(code: string, userId: number): Promise<void> {
    try {
      const clientId = process.env.FACEBOOK_APP_ID;
      const clientSecret = process.env.FACEBOOK_APP_SECRET;
      const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
      
      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('Facebook OAuth credentials are missing. Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, and FACEBOOK_REDIRECT_URI environment variables.');
      }
      
      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v17.0/oauth/access_token?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${clientSecret}&code=${code}`
      );
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get Facebook access token');
      }
      
      const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number };
      
      // Get user info - only public_profile fields are available
      const userInfoResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,picture&access_token=${tokenData.access_token}`
      );
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch Facebook user info');
      }
      
      const userInfo = await userInfoResponse.json() as { 
        id: string; 
        name: string; 
        picture?: { data?: { url?: string } } 
      };
      
      // Save or update Facebook account
      const existingAccount = await storage.getSocialAccountByPlatformAndUserId(userId, 'facebook');
      
      if (existingAccount) {
        await storage.updateSocialAccount(existingAccount.id, {
          accessToken: tokenData.access_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          isConnected: true
        });
      } else {
        const socialAccount: InsertSocialAccount = {
          userId,
          platform: 'facebook',
          platformUserId: userInfo.id,
          accessToken: tokenData.access_token,
          name: userInfo.name,
          email: null, // Email is no longer available through Facebook OAuth
          picture: userInfo.picture?.data?.url,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
        };
        
        await storage.createSocialAccount(socialAccount);
      }
    } catch (error) {
      console.error('Facebook OAuth error:', error);
      throw new Error('Failed to authenticate with Facebook');
    }
  }

  // LinkedIn OAuth URL generator
  getLinkedInAuthUrl() {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      throw new Error('LinkedIn credentials are missing. Set LINKEDIN_CLIENT_ID and LINKEDIN_REDIRECT_URI environment variables.');
    }
    
    return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=r_liteprofile%20r_emailaddress%20w_member_social`;
  }

  // Handle LinkedIn OAuth callback
  async handleLinkedInCallback(code: string, userId: number): Promise<void> {
    try {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
      
      if (!clientId || !clientSecret || !redirectUri) {
        throw new Error('LinkedIn OAuth credentials are missing. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_REDIRECT_URI environment variables.');
      }
      
      // Exchange code for access token
      const tokenResponse = await fetch(
        'https://www.linkedin.com/oauth/v2/accessToken',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            client_secret: clientSecret
          })
        }
      );
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get LinkedIn access token');
      }
      
      const tokenData = await tokenResponse.json() as { access_token: string; expires_in: number };
      
      // Get user profile
      const profileResponse = await fetch(
        'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        }
      );
      
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch LinkedIn profile');
      }
      
      const profileData = await profileResponse.json() as {
        id: string;
        localizedFirstName: string;
        localizedLastName: string;
        profilePicture?: { 'displayImage~'?: { elements?: { identifiers?: { identifier?: string }[] }[] } };
      };
      
      // Get email address
      const emailResponse = await fetch(
        'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        }
      );
      
      if (!emailResponse.ok) {
        throw new Error('Failed to fetch LinkedIn email');
      }
      
      const emailData = await emailResponse.json() as { elements: { 'handle~': { emailAddress: string } }[] };
      const email = emailData.elements[0]['handle~'].emailAddress;
      
      // Get profile picture
      let picture = '';
      if (
        profileData.profilePicture &&
        profileData.profilePicture['displayImage~'] &&
        profileData.profilePicture['displayImage~'].elements &&
        profileData.profilePicture['displayImage~'].elements.length > 0 &&
        profileData.profilePicture['displayImage~'].elements[0].identifiers &&
        profileData.profilePicture['displayImage~'].elements[0].identifiers.length > 0
      ) {
        picture = profileData.profilePicture['displayImage~'].elements[0].identifiers[0].identifier ?? '';
      }
      
      // Save or update LinkedIn account
      const existingAccount = await storage.getSocialAccountByPlatformAndUserId(userId, 'linkedin');
      
      if (existingAccount) {
        await storage.updateSocialAccount(existingAccount.id, {
          accessToken: tokenData.access_token,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
          isConnected: true
        });
      } else {
        const name = `${profileData.localizedFirstName} ${profileData.localizedLastName}`;
        
        const socialAccount: InsertSocialAccount = {
          userId,
          platform: 'linkedin',
          platformUserId: profileData.id,
          accessToken: tokenData.access_token,
          name,
          email,
          picture,
          expiresAt: new Date(Date.now() + tokenData.expires_in * 1000)
        };
        
        await storage.createSocialAccount(socialAccount);
      }
    } catch (error) {
      console.error('LinkedIn OAuth error:', error);
      throw new Error('Failed to authenticate with LinkedIn');
    }
  }

  // Fetch calendar events from Google
  async fetchCalendarEvents(googleAccountId: number) {
    try {
      const googleAccount = await storage.getGoogleAccount(googleAccountId);
      if (!googleAccount) {
        throw new Error('Google account not found');
      }
      
      // Check if token is expired and refresh if needed
      if (new Date(googleAccount.expiresAt) <= new Date()) {
        await this.refreshGoogleToken(googleAccount.id);
      }
      
      // Get events from primary calendar
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // Fetch next 30 days of events
      
      console.log(`[Calendar Sync] Fetching events from ${timeMin.toISOString()} to ${timeMax.toISOString()}`);
      
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
        'maxResults=100' +
        '&timeMin=' + timeMin.toISOString() +
        '&timeMax=' + timeMax.toISOString() +
        '&singleEvents=true' +
        '&orderBy=startTime',
        {
          headers: {
            Authorization: `Bearer ${googleAccount.accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events');
      }
      
      const data = (await response.json()) as { [key: string]: any };
      console.log(`[Calendar Sync] Fetched ${data.items?.length || 0} events from Google Calendar`);
      return data;
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw error;
    }
  }

  // Refresh Google token
  async refreshGoogleToken(googleAccountId: number) {
    try {
      const googleAccount = await storage.getGoogleAccount(googleAccountId);
      if (!googleAccount || !googleAccount.refreshToken) {
        throw new Error('Cannot refresh token: no refresh token available');
      }
      
      this.googleClient.setCredentials({
        refresh_token: googleAccount.refreshToken
      });
      
      const { credentials } = await this.googleClient.refreshAccessToken();
      
      await storage.updateGoogleAccount(googleAccount.id, {
        accessToken: credentials.access_token!,
        expiresAt: new Date(Date.now() + (credentials.expiry_date! - Date.now()))
      });
      
      return credentials.access_token;
    } catch (error) {
      console.error('Failed to refresh Google token:', error);
      throw error;
    }
  }

  // Post to LinkedIn
  async postToLinkedIn(userId: number, content: string, imageUrl?: string) {
    try {
      const linkedInAccount = await storage.getSocialAccountByPlatformAndUserId(userId, 'linkedin');
      if (!linkedInAccount) {
        throw new Error('LinkedIn account not connected');
      }
      
      // Get user URN
      const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${linkedInAccount.accessToken}`
        }
      });
      
      if (!profileResponse.ok) {
        throw new Error('Failed to get LinkedIn profile');
      }
      
      const profile = (await profileResponse.json()) as { id: string };
      const userUrn = `urn:li:person:${profile.id}`;
      
      // Create share
      const postData: any = {
        author: userUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: 'NONE'
          }
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
        }
      };
      
      // Add image if provided
      if (imageUrl) {
        // Register upload
        const registerResponse = await fetch(
          'https://api.linkedin.com/v2/assets?action=registerUpload', 
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${linkedInAccount.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              registerUploadRequest: {
                recipes: [
                  'urn:li:digitalmediaRecipe:feedshare-image'
                ],
                owner: userUrn,
                serviceRelationships: [
                  {
                    relationshipType: 'OWNER',
                    identifier: 'urn:li:userGeneratedContent'
                  }
                ]
              }
            })
          }
        );
        
        if (!registerResponse.ok) {
          throw new Error('Failed to register LinkedIn image upload');
        }
        
        const registerData = (await registerResponse.json()) as { [key: string]: any };
        
        // Get image from URL
        const imageResponse = await fetch(imageUrl);
        const imageBuffer = await imageResponse.buffer();
        
        // Upload image
        const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const assetId = registerData.value.asset;
        
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${linkedInAccount.accessToken}`,
            'Content-Type': 'image/jpeg'
          },
          body: imageBuffer
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image to LinkedIn');
        }
        
        // Add media to post
        postData.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory = 'IMAGE';
        postData.specificContent['com.linkedin.ugc.ShareContent'].media = [
          {
            status: 'READY',
            description: {
              text: 'Image from meeting'
            },
            media: assetId
          }
        ];
      }
      
      // Create post
      const postResponse = await fetch(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${linkedInAccount.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(postData)
        }
      );
      
      if (!postResponse.ok) {
        const errorText = await postResponse.text();
        throw new Error(`Failed to post to LinkedIn: ${errorText}`);
      }
      
      return await postResponse.json();
    } catch (error) {
      console.error('Error posting to LinkedIn:', error);
      throw error;
    }
  }

  // Post to Facebook
  async postToFacebook(userId: number, content: string, imageUrl?: string) {
    try {
      const facebookAccount = await storage.getSocialAccountByPlatformAndUserId(userId, 'facebook');
      if (!facebookAccount) {
        throw new Error('Facebook account not connected');
      }
      
      // Get user pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v17.0/me/accounts?access_token=${facebookAccount.accessToken}`
      );
      
      if (!pagesResponse.ok) {
        throw new Error('Failed to get Facebook pages');
      }
      
      const pagesData = await pagesResponse.json() as { data?: { id: string; access_token: string }[] };
      
      if (!pagesData.data || pagesData.data.length === 0) {
        throw new Error('No Facebook pages found. User must have at least one page to post content.');
      }
      
      // Use the first page
      const page = pagesData.data[0] ?? { id: '', access_token: '' };
      const pageAccessToken = page.access_token ?? '';
      
      let postData: any = {
        message: content
      };
      
      // If image URL is provided, attach it to the post
      if (imageUrl) {
        postData.url = imageUrl;
        
        const postResponse = await fetch(
          `https://graph.facebook.com/v17.0/${page.id}/photos?access_token=${pageAccessToken}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
          }
        );
        
        if (!postResponse.ok) {
          throw new Error('Failed to post to Facebook page');
        }
        
        return await postResponse.json();
      } else {
        // Text-only post
        const postResponse = await fetch(
          `https://graph.facebook.com/v17.0/${page.id}/feed?access_token=${pageAccessToken}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(postData)
          }
        );
        
        if (!postResponse.ok) {
          throw new Error('Failed to post to Facebook page');
        }
        
        return await postResponse.json();
      }
    } catch (error) {
      console.error('Error posting to Facebook:', error);
      throw error;
    }
  }
}

export const oauthService = new OAuthService();
