import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import CalendarPage from "@/pages/calendar";
import MeetingsPage from "@/pages/meetings";
import SocialPostsPage from "@/pages/social-posts";
import AutomationsPage from "@/pages/automations";
import SettingsPage from "@/pages/settings";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import GoogleLogin from "@/components/GoogleLogin";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['/api/user'],
    retry: false,
    queryFn: getQueryFn({ on401: 'returnNull' })
  });
  
  useEffect(() => {
    if (!isLoading && !user && !isError) {
      setLocation("/");
    }
  }, [user, isLoading, isError, setLocation]);
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent"></div>
    </div>;
  }
  
  if (!user) {
    return <GoogleLogin />;
  }
  
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <GoogleLogin />
      </Route>
      <Route path="/calendar">
        <RequireAuth>
          <Layout>
            <CalendarPage />
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/meetings">
        <RequireAuth>
          <Layout>
            <MeetingsPage />
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/meetings/:id">
        <RequireAuth>
          <Layout>
            <MeetingsPage />
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/social-posts">
        <RequireAuth>
          <Layout>
            <SocialPostsPage />
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/automations">
        <RequireAuth>
          <Layout>
            <AutomationsPage />
          </Layout>
        </RequireAuth>
      </Route>
      <Route path="/settings">
        <RequireAuth>
          <Layout>
            <SettingsPage />
          </Layout>
        </RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

import { getQueryFn } from "@/lib/queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
