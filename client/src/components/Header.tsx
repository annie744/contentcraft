import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Menu, Plus, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/api";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const { data: user } = useQuery({
    queryKey: ['/api/user']
  });
  
  const handleLogout = async () => {
    try {
      await logout();
      queryClient.clear();
      setLocation("/");
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };
  
  const handleConnectAccount = () => {
    window.open("/api/auth/google", "_self");
  };
  
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <button 
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              onClick={onMenuClick}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-shrink-0 ml-2 md:ml-0">
              <span className="text-primary-600 font-bold text-xl">ContentCraft</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-sm bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-full"
              onClick={handleConnectAccount}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Account
            </Button>
            
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="p-0 h-auto">
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.picture || ''} alt={user.name} />
                        <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="hidden md:block text-sm font-medium">{user.name}</span>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <button 
                      className="w-full flex items-center cursor-pointer"
                      onClick={() => setLocation("/settings")}
                    >
                      Settings
                    </button>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <button
                      className="w-full flex items-center cursor-pointer text-red-600"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" /> 
                      Logout
                    </button>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

import { queryClient } from "@/lib/queryClient";
