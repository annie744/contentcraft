import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarEvent, Meeting } from "@shared/schema";
import { format } from "date-fns";
import { getMeetingPlatformDetails } from "@/lib/social-platforms";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface MeetingCardProps {
  meeting: Meeting;
}

export default function MeetingCard({ meeting }: MeetingCardProps) {
  const startTime = new Date(meeting.startTime);
  const dateStr = format(startTime, 'MMM d, yyyy');
  const timeStr = format(startTime, 'h:mm a');
  
  const platformDetails = getMeetingPlatformDetails(meeting.platform);
  
  const attendees = meeting.attendees ? 
    (Array.isArray(meeting.attendees) ? meeting.attendees : []) : 
    [];
  
  // Limit to first 3 attendees for display
  const displayAttendees = attendees.slice(0, 3);
  
  return (
    <Card className="overflow-hidden border border-gray-200 hover:border-primary-300 transition">
      <CardHeader className="border-b border-gray-200 bg-gray-50 py-3 px-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-medium text-gray-900 truncate">{meeting.title}</h3>
          {meeting.platform && (
            <div className="flex-shrink-0">
              <img className="h-5 w-5" src={platformDetails.icon} alt={platformDetails.name} />
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{dateStr} • {timeStr}</p>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex items-center mb-3">
          <div className="flex -space-x-2 overflow-hidden">
            {displayAttendees.length > 0 ? (
              displayAttendees.map((attendee: any, index) => (
                <Avatar key={index} className="h-8 w-8 ring-2 ring-white">
                  <AvatarFallback>{attendee.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
              ))
            ) : (
              <Avatar className="h-8 w-8 ring-2 ring-white">
                <AvatarFallback>?</AvatarFallback>
              </Avatar>
            )}
          </div>
          <div className="ml-2 text-sm text-gray-500">
            {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
          </div>
        </div>
        
        <div className="mt-2 flex space-x-2">
          {meeting.status === 'completed' && (
            <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
              <Check className="mr-1 h-3 w-3" />
              Processed
            </Badge>
          )}
          
          {meeting.transcript && (
            <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              <FileText className="mr-1 h-3 w-3" />
              Transcript
            </Badge>
          )}
        </div>
        
        <div className="mt-4">
          <Link href={`/meetings/${meeting.id}`}>
            <Button 
              variant="secondary" 
              className="w-full text-primary-700 bg-primary-100 hover:bg-primary-200 border-none"
            >
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
