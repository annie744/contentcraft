import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchSocialAccounts, 
  fetchSettings, 
  updateSettings,
  disconnectSocialAccount
} from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import SocialLogin from "@/components/SocialLogin";
import { socialPlatforms } from "@/lib/social-platforms";
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

export default function SettingsPage() {
  const [botJoinMinutes, setBotJoinMinutes] = useState<number>(5);
  const [autoJoinEvents, setAutoJoinEvents] = useState<boolean>(true);
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/settings'],
    onSuccess: (data) => {
      setBotJoinMinutes(data.botJoinMinutesBefore);
      setAutoJoinEvents(data.autoJoinNewEvents);
    }
  });
  
  const { data: socialAccounts, isLoading: isLoadingSocial } = useQuery({
    queryKey: ['/api/social-accounts']
  });
  
  const settingsMutation = useMutation({
    mutationFn: (data: { botJoinMinutesBefore: number, autoJoinNewEvents: boolean }) => 
      updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Failed to update settings",
        variant: "destructive"
      });
    }
  });
  
  const disconnectMutation = useMutation({
    mutationFn: (id: number) => disconnectSocialAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-accounts'] });
      setDisconnectId(null);
      toast({
        title: "Account disconnected",
        description: "Social media account has been disconnected",
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
  
  const handleSaveSettings = () => {
    settingsMutation.mutate({
      botJoinMinutesBefore: botJoinMinutes,
      autoJoinNewEvents: autoJoinEvents
    });
  };
  
  const handleDisconnect = (id: number) => {
    setDisconnectId(id);
  };
  
  const confirmDisconnect = () => {
    if (disconnectId !== null) {
      disconnectMutation.mutate(disconnectId);
    }
  };
  
  // Find connected social accounts
  const getConnectedAccount = (platform: string) => {
    return socialAccounts?.find(account => 
      account.platform === platform && account.isConnected
    );
  };
  
  return (
    <div className="py-6 md:py-8">
      <div className="px-4 sm:px-6 md:px-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-1 text-sm text-gray-500">Configure your account and integrations</p>
        </div>
        
        <div className="mt-8 space-y-8">
          {/* Meeting Bot Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Meeting Bot Settings</CardTitle>
              <CardDescription>Configure how the notetaker bot joins your meetings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoadingSettings ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="bot-join-time">Join meetings before start time</Label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <Input 
                        type="number" 
                        id="bot-join-time" 
                        min={1}
                        max={30}
                        value={botJoinMinutes}
                        onChange={(e) => setBotJoinMinutes(parseInt(e.target.value))}
                        className="flex-1 rounded-r-none"
                      />
                      <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                        minutes
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Switch 
                      id="auto-join" 
                      checked={autoJoinEvents}
                      onCheckedChange={setAutoJoinEvents}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="auto-join">Automatically join new calendar events</Label>
                      <p className="text-sm text-gray-500">
                        When enabled, the bot will automatically join meetings from your connected calendars
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={handleSaveSettings}
                    disabled={settingsMutation.isPending}
                  >
                    {settingsMutation.isPending ? "Saving..." : "Save Settings"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Social Media Connections */}
          <Card>
            <CardHeader>
              <CardTitle>Social Media Connections</CardTitle>
              <CardDescription>Connect your social media accounts for automated posting</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSocial ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <Skeleton className="h-8 w-8 rounded" />
                        <div className="ml-3">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-16 mt-1" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {socialPlatforms.map(platform => {
                    const connectedAccount = getConnectedAccount(platform.id);
                    return (
                      <SocialLogin 
                        key={platform.id}
                        platform={platform}
                        connected={!!connectedAccount}
                        onDisconnect={connectedAccount ? 
                          () => handleDisconnect(connectedAccount.id) : 
                          undefined
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={disconnectId !== null} onOpenChange={() => setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Social Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect this social media account? You won't be able to post content directly until you reconnect it.
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
