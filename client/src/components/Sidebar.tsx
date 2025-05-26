import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Video, 
  Share2, 
  Zap, 
  Settings
} from "lucide-react";
import UpcomingMeeting from "./UpcomingMeeting";
import { useQuery } from "@tanstack/react-query";

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  
  // Get upcoming meetings for the sidebar
  const { data: calendarEvents } = useQuery({
    queryKey: ['/api/calendar-events'],
    refetchInterval: 5 * 60 * 1000 // Refetch every 5 minutes
  });
  
  // Find the next upcoming meeting with recording enabled
  const upcomingMeeting = calendarEvents
    ?.filter(event => event.isRecordingEnabled && new Date(event.startTime) > new Date())
    ?.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];
  
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
  
  return (
    <aside className={cn("", className)}>
      <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto sidebar-height">
          <div className="flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.path}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
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
                </Link>
              ))}
            </nav>
          </div>
          
          {upcomingMeeting && (
            <div className="mt-6 p-4">
              <UpcomingMeeting meeting={upcomingMeeting} />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
