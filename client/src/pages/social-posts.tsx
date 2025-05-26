import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchMeetings, generateSocialPost } from "@/lib/api";
import { Meeting, MeetingContent } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, PlusCircle } from "lucide-react";
import MeetingDetail from "@/components/MeetingDetail";
import SocialMediaPost from "@/components/SocialMediaPost";
import { socialPlatforms } from "@/lib/social-platforms";

export default function SocialPostsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: meetings, isLoading: isLoadingMeetings } = useQuery({
    queryKey: ['/api/meetings']
  });
  
  // Get completed meetings with transcripts
  const completedMeetings = meetings?.filter(
    meeting => meeting.status === 'completed' && meeting.transcript
  ) || [];
  
  // Generate a social post
  const generatePostMutation = useMutation({
    mutationFn: ({ meetingId, platform }: { meetingId: number, platform: string }) => 
      generateSocialPost(meetingId, platform),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings', selectedMeeting?.id, 'contents'] });
      setCreateDialogOpen(false);
      setDetailOpen(true);
      toast({
        title: "Post generated",
        description: "Your social media post has been created",
      });
    },
    onError: () => {
      toast({
        title: "Generation failed",
        description: "Failed to generate social media post",
        variant: "destructive"
      });
    }
  });
  
  const handleGeneratePost = () => {
    if (selectedMeeting && selectedPlatform) {
      generatePostMutation.mutate({
        meetingId: selectedMeeting.id,
        platform: selectedPlatform
      });
    }
  };
  
  const handleCreateNew = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setCreateDialogOpen(true);
  };
  
  const handleViewMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setDetailOpen(true);
  };
  
  // Filter meetings by search term
  const filteredMeetings = searchTerm 
    ? completedMeetings.filter(meeting => 
        meeting.title.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : completedMeetings;
  
  return (
    <div className="py-6 md:py-8">
      <div className="px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">Social Media Posts</h1>
            <p className="mt-1 text-sm text-gray-500">Generate and publish content from your meetings</p>
          </div>
        </div>
        
        {/* Search and filter */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="text"
              placeholder="Search meetings..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        {/* Meetings List */}
        <div className="mt-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Meetings with Transcripts</h2>
          
          {isLoadingMeetings ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </div>
                  <div className="p-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                    <div className="flex justify-end mt-4">
                      <Skeleton className="h-9 w-24" />
                      <Skeleton className="h-9 w-24 ml-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMeetings.length > 0 ? (
            <div className="space-y-4">
              {filteredMeetings.map(meeting => (
                <div key={meeting.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-4 py-4 border-b">
                    <h3 className="text-lg font-medium text-gray-900">{meeting.title}</h3>
                    <p className="text-sm text-gray-500">
                      {new Date(meeting.startTime).toLocaleDateString()} at {new Date(meeting.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-gray-700 line-clamp-2">
                      {meeting.transcript ? 
                        meeting.transcript.substring(0, 150) + "..." : 
                        "No transcript available"
                      }
                    </p>
                    <div className="flex justify-end mt-4">
                      <Button 
                        variant="outline"
                        onClick={() => handleViewMeeting(meeting)}
                      >
                        View Details
                      </Button>
                      <Button 
                        className="ml-2"
                        onClick={() => handleCreateNew(meeting)}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Create Post
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings with transcripts</h3>
              <p className="text-gray-500 mb-6">
                {searchTerm ? 
                  "No meetings match your search. Try a different search term." : 
                  "You don't have any completed meetings with transcripts yet."
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => window.location.href = '/calendar'}>
                  Go to Calendar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Create Post Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Social Media Post</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meeting</Label>
              <Input value={selectedMeeting?.title} disabled />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select 
                value={selectedPlatform} 
                onValueChange={setSelectedPlatform}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a platform" />
                </SelectTrigger>
                <SelectContent>
                  {socialPlatforms.map(platform => (
                    <SelectItem key={platform.id} value={platform.id}>
                      {platform.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGeneratePost}
              disabled={!selectedPlatform || generatePostMutation.isPending}
            >
              {generatePostMutation.isPending ? "Generating..." : "Generate Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Meeting Detail Modal */}
      <MeetingDetail 
        meeting={selectedMeeting || undefined}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
