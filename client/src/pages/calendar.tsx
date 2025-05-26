import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchGoogleAccounts, fetchCalendarEvents, syncCalendarEvents, disconnectGoogleAccount } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CalendarPlus, Clock, Users } from "lucide-react";
import { format, isToday, isTomorrow, addDays } from "date-fns";
import MeetingToggle from "@/components/MeetingToggle";
import { getMeetingPlatformDetails } from "@/lib/social-platforms";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CalendarPage() {
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: googleAccounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['/api/google-accounts']
  });
  
  const { data: calendarEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['/api/calendar-events']
  });
  
  const syncMutation = useMutation({
    mutationFn: syncCalendarEvents,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({
        title: "Calendar synced",
        description: "Your calendar has been synced successfully",
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync calendar",
        variant: "destructive"
      });
    }
  });
  
  const disconnectMutation = useMutation({
    mutationFn: (id: number) => disconnectGoogleAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-accounts'] });
      setDisconnectId(null);
      toast({
        title: "Account disconnected",
        description: "Google account has been disconnected",
      });
    },
    onError: () => {
      toast({
        title: "Disconnect failed",
        description: "Failed to disconnect account",
        variant: "destructive"
      });
    }
  });
  
  const handleConnect = () => {
    window.open("/api/auth/google", "_self");
  };
  
  const handleSync = () => {
    syncMutation.mutate();
  };
  
  const handleDisconnect = (id: number) => {
    setDisconnectId(id);
  };
  
  const confirmDisconnect = () => {
    if (disconnectId !== null) {
      disconnectMutation.mutate(disconnectId);
    }
  };
  
  // Group events by day
  const groupedEvents = calendarEvents ? calendarEvents.reduce((acc, event) => {
    const date = new Date(event.startTime);
    const key = date.toDateString();
    
    if (!acc[key]) {
      acc[key] = [];
    }
    
    acc[key].push(event);
    return acc;
  }, {} as Record<string, typeof calendarEvents>) : {};
  
  // Sort days
  const sortedDays = Object.keys(groupedEvents).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  );
  
  // Get display name for day
  const getDayDisplayName = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };
  
  // Format time
  const formatEventTime = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${format(startDate, 'h:mm a')} - ${format(endDate, 'h:mm a')}`;
  };
  
  return (
    <div className="py-6 md:py-8">
      <div className="px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
            <p className="mt-1 text-sm text-gray-500">Connect your calendars and manage meeting note-taking</p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Button 
              variant="outline" 
              onClick={handleSync}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button 
              className="ml-3" 
              onClick={handleConnect}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Connect Calendar
            </Button>
          </div>
        </div>
        
        {/* Connected Accounts Section */}
        <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Connected Calendar Accounts</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Manage your connected Google accounts</p>
          </div>
          
          {isLoadingAccounts ? (
            <div className="divide-y divide-gray-200">
              {[1, 2].map((i) => (
                <div key={i} className="px-4 py-4 sm:px-6 flex items-center justify-between">
                  <div className="flex items-center">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="ml-4">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24 mt-1" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : googleAccounts?.length ? (
            <ul className="divide-y divide-gray-200">
              {googleAccounts.map((account) => (
                <li key={account.id}>
                  <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <img 
                          className="h-10 w-10 rounded-full" 
                          src={account.picture || `/api/avatar?name=${encodeURIComponent(account.email)}`} 
                          alt={account.email} 
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{account.email}</div>
                        <div className="text-sm text-gray-500">
                          Connected on {format(new Date(account.createdAt), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDisconnect(account.id)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No Google accounts connected</p>
              <Button onClick={handleConnect}>Connect Google Account</Button>
            </div>
          )}
        </div>
        
        {/* Calendar Events Section */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Upcoming Meetings</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Enable note-taking for your meetings</p>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" disabled>
                    <span className="flex items-center text-sm font-medium">
                      {format(new Date(), 'MMM d')} - {format(addDays(new Date(), 7), 'MMM d, yyyy')}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
            
            {isLoadingEvents ? (
              <div className="divide-y divide-gray-200">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="ml-4 flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-64 mt-1" />
                        <Skeleton className="h-6 w-24 mt-2" />
                      </div>
                      <Skeleton className="h-6 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedDays.length > 0 ? (
              <div>
                {sortedDays.map(day => (
                  <div key={day}>
                    <div className="px-4 py-2 bg-gray-50 border-t border-b border-gray-200">
                      <h4 className="text-sm font-medium text-gray-700">{getDayDisplayName(day)}</h4>
                    </div>
                    <ul className="divide-y divide-gray-200">
                      {groupedEvents[day]
                        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                        .map(event => {
                          const platformDetails = getMeetingPlatformDetails(event.platform);
                          return (
                            <li key={event.id}>
                              <div className="px-4 py-4 sm:px-6 flex items-center">
                                <div className="min-w-0 flex-1 flex items-center">
                                  <div className={`flex-shrink-0 rounded-md p-2`} style={{ backgroundColor: platformDetails.backgroundColor }}>
                                    {event.platform ? (
                                      <img 
                                        className="h-5 w-5" 
                                        src={platformDetails.icon} 
                                        alt={platformDetails.name} 
                                      />
                                    ) : (
                                      <Clock className="h-5 w-5 text-gray-600" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 px-4">
                                    <div>
                                      <p className="text-sm font-medium text-primary-600 truncate">{event.title}</p>
                                      <p className="mt-1 flex items-center text-sm text-gray-500">
                                        <span>{formatEventTime(event.startTime, event.endTime)}</span>
                                        {event.platform && (
                                          <>
                                            <span className="mx-2 text-gray-300">•</span>
                                            <img 
                                              className="h-4 w-4 mr-1" 
                                              src={platformDetails.icon} 
                                              alt={platformDetails.name} 
                                            />
                                            <span>{platformDetails.name}</span>
                                          </>
                                        )}
                                      </p>
                                    </div>
                                    {event.attendees && Array.isArray(event.attendees) && (
                                      <div className="mt-2">
                                        <Badge variant="outline" className="bg-green-100 text-green-800">
                                          <Users className="h-3 w-3 mr-1" />
                                          {event.attendees.length} {event.attendees.length === 1 ? 'attendee' : 'attendees'}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <MeetingToggle event={event} />
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No upcoming meetings found</p>
                <p className="text-sm text-gray-400">
                  {googleAccounts?.length ? 
                    "Sync your calendar to see upcoming meetings with meeting links" : 
                    "Connect a Google account to see your meetings"
                  }
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectId !== null} onOpenChange={() => setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this Google account? Any scheduled recordings for meetings from this account will be canceled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDisconnect}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
