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
  console.log('MeetingDetail received meeting:', meeting);
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
  
  const followUpEmail = contents?.find((content: any) => content.type === 'follow_up_email');
  const socialPosts = contents?.filter((content: any) => content.type === 'social_post') || [];
  
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
    
    // Replace all '\n' and '\\n' with real newlines, then split
    const normalizedTranscript = meeting.transcript.replace(/\\n|\n/g, '\n');
    const lines = normalizedTranscript.split(/\n|\r/).filter(Boolean);
    const messages: any[] = [];
    let lastSpeaker = '';
    lines.forEach(line => {
      // Match: Speaker: message OR Speaker [timestamp]: message OR Speaker (timestamp): message
      const match = line.match(/^([^:]+?)(?:\s*[\[(](.+?)[\])])?:\s*(.*)$/);
      if (match) {
        const speaker = match[1].trim();
        const timestamp = match[2] ? match[2].trim() : '';
        const text = match[3].trim();
        messages.push({ speaker, timestamp, text });
        lastSpeaker = speaker;
      } else if (messages.length > 0) {
        // Continuation of previous message
        messages[messages.length - 1].text += '\n' + line.trim();
      }
    });
    if (messages.length === 0) {
      return (
        <div className="whitespace-pre-wrap">{meeting.transcript}</div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {messages.map((item, index) => {
          const isMe = index % 2 === 1; // Alternate right/left
          const align = isMe ? 'justify-end' : 'justify-start';
          const bubbleColor = isMe ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900';
          const showAvatar = !isMe && (index === 0 || messages[index - 1].speaker !== item.speaker);
          const showName = !isMe && (index === 0 || messages[index - 1].speaker !== item.speaker);
          const initials = item.speaker.split(' ').map((n: string) => n[0]).join('').toUpperCase();
          return (
            <div key={index} className={`flex ${align} items-end gap-2`}>
              {!isMe && showAvatar && (
                <div className="flex flex-col items-center mr-2">
                  <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-lg">
                    {initials}
                  </div>
                </div>
              )}
              <div className={`rounded-2xl px-4 py-2 ${bubbleColor} shadow max-w-[70%]`} style={{borderBottomRightRadius: isMe ? '0.5rem' : '2rem', borderBottomLeftRadius: !isMe ? '0.5rem' : '2rem'}}>
                {showName && (
                  <div className="text-xs font-semibold mb-1 text-gray-700">{item.speaker}</div>
                )}
                <div className="whitespace-pre-line text-base">{item.text}</div>
                {item.timestamp && (
                  <div className="text-[10px] text-gray-400 text-right mt-1">{item.timestamp}</div>
                )}
              </div>
              {isMe && (
                <div className="w-8 h-8" />
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0" style={{ maxWidth: '90vw', maxHeight: '90vh', width: '90vw', height: '90vh', overflowY: 'auto' }}>
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
                <div className="max-w-none bg-white" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '16px' }}>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Meeting Transcript</h3>
                  {/* Messenger/WhatsApp-style chat UI */}
                  {formatTranscript()}
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
                      {socialPosts.map((post: any) => (
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
