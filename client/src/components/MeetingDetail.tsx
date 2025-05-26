import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Meeting, MeetingContent } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMeetingContents, generateFollowUpEmail } from "@/lib/api";
import { X, FileText, Mail, Share2, Copy } from "lucide-react";
import { format } from "date-fns";
import { getMeetingPlatformDetails } from "@/lib/social-platforms";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import SocialMediaPost from "./SocialMediaPost";
import { Skeleton } from "@/components/ui/skeleton";

interface MeetingDetailProps {
  meeting?: Meeting;
  open: boolean;
  onClose: () => void;
}

export default function MeetingDetail({ meeting, open, onClose }: MeetingDetailProps) {
  const [activeTab, setActiveTab] = useState("transcript");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Reset active tab when meeting changes
  useEffect(() => {
    if (meeting) {
      setActiveTab("transcript");
    }
  }, [meeting?.id]);
  
  const { data: contents, isLoading: isLoadingContents } = useQuery({
    queryKey: ['/api/meetings', meeting?.id, 'contents'],
    queryFn: () => fetchMeetingContents(meeting!.id),
    enabled: !!meeting && open
  });
  
  const generateEmailMutation = useMutation({
    mutationFn: () => generateFollowUpEmail(meeting!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', meeting?.id, 'contents'] });
      toast({
        title: "Follow-up email generated",
        description: "Your follow-up email draft is ready",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate follow-up email",
        variant: "destructive"
      });
    }
  });
  
  const followUpEmail = contents?.find(content => content.type === 'follow_up_email');
  const socialPosts = contents?.filter(content => content.type === 'social_post') || [];
  
  if (!meeting) return null;
  
  const startTime = new Date(meeting.startTime);
  const dateTimeStr = format(startTime, 'MMM d, yyyy • h:mm a');
  const platformDetails = getMeetingPlatformDetails(meeting.platform);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Content has been copied to your clipboard",
    });
  };
  
  // Format the transcript with speaker info
  const formatTranscript = () => {
    if (!meeting.transcript) return <p>No transcript available for this meeting.</p>;
    
    // Simple transcript formatting - in a real app this would be more sophisticated
    const lines = meeting.transcript.split('\n');
    const formattedLines = [];
    
    let currentSpeaker = '';
    let currentTimestamp = '';
    let currentText = [];
    
    for (const line of lines) {
      // Try to detect speaker patterns like "John Doe (10:15:20):"
      const speakerMatch = line.match(/^([^(]+)\(([^)]+)\):/);
      
      if (speakerMatch) {
        // If we had a previous speaker, add their content
        if (currentSpeaker) {
          formattedLines.push({
            speaker: currentSpeaker,
            timestamp: currentTimestamp,
            text: currentText.join(' ')
          });
          currentText = [];
        }
        
        currentSpeaker = speakerMatch[1].trim();
        currentTimestamp = speakerMatch[2].trim();
        currentText.push(line.substring(speakerMatch[0].length).trim());
      } else if (line.trim() !== '') {
        // Continue with current speaker
        currentText.push(line.trim());
      }
    }
    
    // Add the last speaker's content
    if (currentSpeaker) {
      formattedLines.push({
        speaker: currentSpeaker,
        timestamp: currentTimestamp,
        text: currentText.join(' ')
      });
    }
    
    // If we couldn't parse any speakers, just return the raw transcript
    if (formattedLines.length === 0) {
      return (
        <div className="whitespace-pre-wrap">
          {meeting.transcript}
        </div>
      );
    }
    
    return (
      <div className="space-y-6">
        {formattedLines.map((item, index) => {
          // Generate avatar fallback from speaker name
          const fallback = item.speaker.split(' ').map(name => name[0]).join('').toUpperCase();
          
          return (
            <div key={index} className="mb-6">
              <div className="flex items-center space-x-3 mb-4 pb-4 border-b border-gray-100">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.speaker}</p>
                  <p className="text-sm text-gray-500">{item.timestamp}</p>
                </div>
              </div>
              <p className="text-gray-700">{item.text}</p>
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0" closeButton={false}>
        <div className="h-full flex flex-col max-h-screen">
          <div className="px-4 py-6 sm:px-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">{meeting.title}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {dateTimeStr} 
                  {meeting.platform && (
                    <>
                      <span className="mx-2 text-gray-300">•</span>
                      <img 
                        src={platformDetails.icon} 
                        alt={platformDetails.name} 
                        className="inline h-4 w-4 mr-1" 
                      />
                      <span>{platformDetails.name}</span>
                    </>
                  )}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-6 w-6 text-gray-400" />
              </Button>
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <div className="border-b border-gray-200">
              <div className="px-4 sm:px-6">
                <TabsList className="h-auto -mb-px flex space-x-8 border-b-0">
                  <TabsTrigger 
                    value="transcript" 
                    className="border-primary-500 data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Transcript
                  </TabsTrigger>
                  <TabsTrigger 
                    value="email" 
                    className="border-transparent data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Follow-up Email
                  </TabsTrigger>
                  <TabsTrigger 
                    value="social" 
                    className="border-transparent data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Social Media Posts
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>
            
            <div className="flex-1 relative overflow-auto">
              <TabsContent 
                value="transcript" 
                className="absolute inset-0 py-6 px-4 sm:px-6 overflow-y-auto data-[state=inactive]:hidden"
              >
                <div className="prose max-w-none">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Meeting Transcript</h3>
                  
                  {meeting.transcript ? (
                    formatTranscript()
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-gray-500 mb-4">No transcript available for this meeting.</p>
                      {meeting.status === 'in_progress' && (
                        <p className="text-sm text-gray-400">
                          The meeting is still in progress. Transcript will be available after the meeting ends.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent 
                value="email" 
                className="absolute inset-0 py-6 px-4 sm:px-6 overflow-y-auto data-[state=inactive]:hidden"
              >
                <div className="prose max-w-none">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Follow-up Email Draft</h3>
                  
                  {isLoadingContents ? (
                    <div className="space-y-4">
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-4/6" />
                    </div>
                  ) : followUpEmail ? (
                    <div>
                      <div className="whitespace-pre-wrap bg-white border border-gray-200 rounded-lg p-4">
                        {followUpEmail.content}
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button 
                          variant="outline" 
                          onClick={() => copyToClipboard(followUpEmail.content)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy to Clipboard
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      {meeting.transcript ? (
                        <>
                          <p className="text-gray-500 mb-4">No follow-up email has been generated yet.</p>
                          <Button 
                            onClick={() => generateEmailMutation.mutate()}
                            disabled={generateEmailMutation.isPending}
                          >
                            {generateEmailMutation.isPending ? 'Generating...' : 'Generate Follow-up Email'}
                          </Button>
                        </>
                      ) : (
                        <p className="text-gray-500">
                          A transcript is required to generate a follow-up email.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent 
                value="social" 
                className="absolute inset-0 py-6 px-4 sm:px-6 overflow-y-auto data-[state=inactive]:hidden"
              >
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Social Media Posts</h3>
                  
                  {isLoadingContents ? (
                    <div className="space-y-6">
                      <Skeleton className="h-64 w-full rounded-lg" />
                      <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                  ) : socialPosts.length > 0 ? (
                    <div className="space-y-8">
                      {socialPosts.map(post => (
                        <SocialMediaPost 
                          key={post.id} 
                          post={post} 
                          meetingId={meeting.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      {meeting.transcript ? (
                        <p className="text-gray-500">
                          No social media posts have been generated yet. Go to the Social Posts page to generate content.
                        </p>
                      ) : (
                        <p className="text-gray-500">
                          A transcript is required to generate social media posts.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
