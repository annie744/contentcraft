import { Link, useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  Calendar, 
  Video, 
  Share2, 
  Zap, 
  Settings,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileNav({ open, onClose }: MobileNavProps) {
  const [location] = useLocation();
  
  const navItems = [
    {
      name: 'Calendar',
      path: '/calendar',
      icon: Calendar,
      current: location === '/calendar'
    },
    {
      name: 'Meetings',
      path: '/meetings',
      icon: Video,
      current: location === '/meetings'
    },
    {
      name: 'Social Posts',
      path: '/social-posts',
      icon: Share2,
      current: location === '/social-posts'
    },
    {
      name: 'Automations',
      path: '/automations',
      icon: Zap,
      current: location === '/automations'
    },
    {
      name: 'Settings',
      path: '/settings',
      icon: Settings,
      current: location === '/settings'
    }
  ];
  
  const handleNavigation = (path: string) => {
    onClose();
    window.location.href = path; // Using window.location for full page reload to avoid state issues
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0" closeButton={false}>
        <div className="bg-white h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="text-primary-600 font-bold text-xl">ContentCraft</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <nav className="flex flex-col p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.path)}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-md",
                  item.current
                    ? "bg-primary-50 text-primary-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5",
                    item.current
                      ? "text-primary-500"
                      : "text-gray-400 group-hover:text-gray-500"
                  )}
                />
                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </DialogContent>
    </Dialog>
  );
}
