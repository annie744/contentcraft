import { Switch } from "@/components/ui/switch";
import { CalendarEvent } from "@shared/schema";
import { toggleEventRecording } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface MeetingToggleProps {
  event: CalendarEvent;
}

export default function MeetingToggle({ event }: MeetingToggleProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number, enabled: boolean }) => 
      toggleEventRecording(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/calendar-events'] });
      toast({
        title: "Recording setting updated",
        description: event.isRecordingEnabled 
          ? "Recording has been disabled for this meeting" 
          : "A note-taker will attend this meeting",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update recording setting",
        variant: "destructive"
      });
    }
  });
  
  const handleToggle = (checked: boolean) => {
    toggleMutation.mutate({ id: event.id, enabled: checked });
  };
  
  return (
    <div className="flex items-center">
      <label className="inline-flex items-center cursor-pointer">
        <span className="mr-2 text-sm text-gray-600">Record</span>
        <Switch 
          checked={event.isRecordingEnabled} 
          onCheckedChange={handleToggle}
          disabled={toggleMutation.isPending}
        />
      </label>
    </div>
  );
}
