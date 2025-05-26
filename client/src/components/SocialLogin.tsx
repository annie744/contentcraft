import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLinkedInAuthUrl, getFacebookAuthUrl } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SocialPlatform, socialPlatforms } from "@/lib/social-platforms";

interface SocialLoginProps {
  platform: SocialPlatform;
  connected: boolean;
  onDisconnect?: () => void;
}

export default function SocialLogin({ platform, connected, onDisconnect }: SocialLoginProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  
  const PlatformIcon = platform.icon;
  
  const linkedInAuthMutation = useMutation({
    mutationFn: getLinkedInAuthUrl,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: `Failed to initiate ${platform.name} login`,
        variant: "destructive"
      });
    }
  });
  
  const facebookAuthMutation = useMutation({
    mutationFn: getFacebookAuthUrl,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: `Failed to initiate ${platform.name} login`,
        variant: "destructive"
      });
    }
  });
  
  const handleConnect = () => {
    setIsLoading(true);
    if (platform.id === 'linkedin') {
      linkedInAuthMutation.mutate();
    } else if (platform.id === 'facebook') {
      facebookAuthMutation.mutate();
    }
  };
  
  return (
    <li className="py-4 flex items-center justify-between">
      <div className="flex items-center">
        <PlatformIcon className="h-8 w-8" style={{ color: platform.color }} />
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-900">{platform.name}</p>
          <p className="text-sm text-gray-500">
            {connected ? 'Connected' : 'Not connected'}
          </p>
        </div>
      </div>
      
      {connected ? (
        <Button 
          variant="outline" 
          size="sm"
          onClick={onDisconnect}
          disabled={isLoading}
        >
          Disconnect
        </Button>
      ) : (
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleConnect}
          disabled={isLoading || linkedInAuthMutation.isPending || facebookAuthMutation.isPending}
        >
          {isLoading || linkedInAuthMutation.isPending || facebookAuthMutation.isPending 
            ? 'Connecting...' 
            : 'Connect'
          }
        </Button>
      )}
    </li>
  );
}
