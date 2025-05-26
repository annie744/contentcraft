import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { fetchMeetings, fetchMeeting } from "@/lib/api";
import MeetingCard from "@/components/MeetingCard";
import MeetingDetail from "@/components/MeetingDetail";
import { Meeting } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, List, Grid, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MeetingsPage() {
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [, setLocation] = useLocation();
  
  // Get meeting ID from URL if present
  const [location] = useLocation();
  const meetingId = location.match(/\/meetings\/(\d+)/)?.[1];
  
  // Fetch specific meeting if ID is present
  const { data: singleMeeting, isLoading: isLoadingSingle } = useQuery({
    queryKey: ['/api/meetings', meetingId],
    queryFn: () => fetchMeeting(parseInt(meetingId!)),
    enabled: !!meetingId
  });
  
  // Fetch all meetings
  const { data: meetings, isLoading: isLoadingMeetings } = useQuery({
    queryKey: ['/api/meetings']
  });
  
  // Set selected meeting when single meeting is loaded
  useEffect(() => {
    if (singleMeeting) {
      setSelectedMeeting(singleMeeting);
      setIsDetailOpen(true);
    }
  }, [singleMeeting]);
  
  const handleMeetingClick = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsDetailOpen(true);
    setLocation(`/meetings/${meeting.id}`);
  };
  
  const handleDetailClose = () => {
    setIsDetailOpen(false);
    setSelectedMeeting(null);
    setLocation('/meetings');
  };
  
  const sortedMeetings = meetings ? [...meetings].sort((a, b) => {
    const dateA = new Date(a.startTime).getTime();
    const dateB = new Date(b.startTime).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  }) : [];
  
  const completedMeetings = sortedMeetings.filter(meeting => meeting.status === 'completed');
  const inProgressMeetings = sortedMeetings.filter(meeting => meeting.status === 'in_progress');
  const scheduledMeetings = sortedMeetings.filter(meeting => meeting.status === 'scheduled');
  
  // Show loading state for single meeting view
  if (meetingId && isLoadingSingle) {
    return (
      <div className="py-6 md:py-8">
        <div className="px-4 sm:px-6 md:px-8">
          <div className="animate-pulse">
            <div className="h-8 w-1/4 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 w-1/2 bg-gray-200 rounded mb-8"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="py-6 md:py-8">
      <div className="px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            {meetingId ? (
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDetailClose}
                  className="mr-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-semibold text-gray-900">Meeting Details</h1>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-semibold text-gray-900">Meetings</h1>
                <p className="mt-1 text-sm text-gray-500">View past meetings, transcripts, and generated content</p>
              </>
            )}
          </div>
          {!meetingId && (
            <div className="mt-4 flex space-x-3 md:mt-0 md:ml-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    {sortBy === 'newest' ? 'Newest first' : 'Oldest first'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSortBy('newest')}>
                    Newest first
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy('oldest')}>
                    Oldest first
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex border rounded-md overflow-hidden">
                <Button 
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-none border-0"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button 
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-none border-0"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {isLoadingMeetings ? (
          <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-4 border-b">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </div>
                <div className="p-6">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-full mt-4" />
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-8 w-full mt-4 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : meetings?.length === 0 ? (
          <div className="mt-8 text-center py-12 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings found</h3>
            <p className="text-gray-500 mb-6">
              You don't have any recorded meetings yet. Enable recording for upcoming meetings on the Calendar page.
            </p>
            <Button onClick={() => setLocation('/calendar')}>
              Go to Calendar
            </Button>
          </div>
        ) : (
          <div>
            {/* In Progress Meetings */}
            {inProgressMeetings.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">In Progress</h2>
                <div className={viewMode === 'grid' 
                  ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                  : "space-y-4"
                }>
                  {inProgressMeetings.map(meeting => (
                    <div key={meeting.id} onClick={() => handleMeetingClick(meeting)} className="cursor-pointer">
                      <MeetingCard meeting={meeting} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Completed Meetings */}
            <div className="mt-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Past Meetings</h2>
              <div className={viewMode === 'grid' 
                ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                : "space-y-4"
              }>
                {completedMeetings.map(meeting => (
                  <div key={meeting.id} onClick={() => handleMeetingClick(meeting)} className="cursor-pointer">
                    <MeetingCard meeting={meeting} />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Scheduled Meetings */}
            {scheduledMeetings.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Scheduled</h2>
                <div className={viewMode === 'grid' 
                  ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" 
                  : "space-y-4"
                }>
                  {scheduledMeetings.map(meeting => (
                    <div key={meeting.id} onClick={() => handleMeetingClick(meeting)} className="cursor-pointer">
                      <MeetingCard meeting={meeting} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Meeting Detail Modal */}
      <MeetingDetail 
        meeting={selectedMeeting || undefined}
        open={isDetailOpen}
        onClose={handleDetailClose}
      />
    </div>
  );
}
