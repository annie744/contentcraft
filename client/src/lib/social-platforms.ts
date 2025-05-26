import { SiLinkedin, SiFacebook, SiX } from 'react-icons/si';

export type SocialPlatform = {
  id: string;
  name: string;
  icon: React.ComponentType;
  color: string;
  backgroundColor: string;
  connectPath: string;
};

export const socialPlatforms: SocialPlatform[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: SiLinkedin,
    color: '#0A66C2',
    backgroundColor: '#E7F1FB',
    connectPath: '/api/auth/linkedin'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: SiFacebook,
    color: '#1877F2',
    backgroundColor: '#E6F2FF',
    connectPath: '/api/auth/facebook'
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: SiX,
    color: '#1DA1F2',
    backgroundColor: '#E8F5FD',
    connectPath: '/api/auth/twitter'
  }
];

export const getSocialPlatform = (id: string): SocialPlatform => {
  return socialPlatforms.find(platform => platform.id === id) || socialPlatforms[0];
};

export const getMeetingPlatformDetails = (platform: string | null | undefined) => {
  switch (platform) {
    case 'zoom':
      return {
        name: 'Zoom',
        icon: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/zoom.svg',
        color: '#2D8CFF',
        backgroundColor: '#E6F2FF'
      };
    case 'teams':
      return {
        name: 'Microsoft Teams',
        icon: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/microsoftteams.svg',
        color: '#5059C9',
        backgroundColor: '#EEEFFA'
      };
    case 'meet':
      return {
        name: 'Google Meet',
        icon: 'https://raw.githubusercontent.com/simple-icons/simple-icons/develop/icons/googlemeet.svg',
        color: '#00897B',
        backgroundColor: '#E6F5F3'
      };
    default:
      return {
        name: 'Online Meeting',
        icon: '',
        color: '#64748B',
        backgroundColor: '#F1F5F9'
      };
  }
};
