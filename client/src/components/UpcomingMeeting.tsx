import { format } from 'date-fns';
import { ArrowRight, Clock } from 'lucide-react';
import { Link } from 'wouter';
import { CalendarEvent } from '@shared/schema';
import { getMeetingPlatformDetails } from '@/lib/social-platforms';

interface UpcomingMeetingProps {
  meeting: CalendarEvent;
}

export default function UpcomingMeeting({ meeting }: UpcomingMeetingProps) {
  const startTime = new Date(meeting.startTime);
  const isToday = new Date().toDateString() === startTime.toDateString();
  
  const formattedDate = isToday 
    ? 'Today' 
    : format(startTime, 'EEE, MMM d');
  
  const formattedTime = format(startTime, 'h:mm a');
  const platformDetails = getMeetingPlatformDetails(meeting.platform);
  
  return (
    <div className="rounded-lg bg-primary-50 p-4">
      <h3 className="text-sm font-medium text-primary-800">Upcoming Meeting</h3>
      <div className="mt-2 text-sm text-primary-700">
        <p className="font-medium">{meeting.title}</p>
        <p className="mt-1 flex items-center">
          <Clock className="mr-1 h-4 w-4" />
          <span>{formattedDate}, {formattedTime}</span>
        </p>
        {meeting.platform && (
          <p className="mt-1 flex items-center">
            <img 
              src={platformDetails.icon} 
              alt={platformDetails.name} 
              className="h-4 w-4 mr-1" 
            />
            <span>{platformDetails.name}</span>
          </p>
        )}
      </div>
      <div className="mt-3">
        <Link 
          href={`/meetings`} 
          className="text-sm font-medium text-primary-600 hover:text-primary-500 flex items-center"
        >
          View details <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
