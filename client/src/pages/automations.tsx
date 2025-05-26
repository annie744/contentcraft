import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAutomations, createAutomation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import AutomationItem from "@/components/AutomationItem";
import { socialPlatforms } from "@/lib/social-platforms";

const automationSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  platform: z.string().min(1, "Platform is required"),
  prompt: z.string().min(10, "Prompt must be at least 10 characters"),
  isActive: z.boolean().default(true),
});

type AutomationFormValues = z.infer<typeof automationSchema>;

export default function AutomationsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: automations, isLoading } = useQuery({
    queryKey: ['/api/automations']
  });
  
  const form = useForm<AutomationFormValues>({
    resolver: zodResolver(automationSchema),
    defaultValues: {
      name: "",
      platform: "",
      prompt: "",
      isActive: true,
    },
  });
  
  const createMutation = useMutation({
    mutationFn: (values: AutomationFormValues) => 
      createAutomation(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/automations'] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Automation created",
        description: "Your automation has been created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Creation failed",
        description: "Failed to create automation",
        variant: "destructive"
      });
    }
  });
  
  const onSubmit = (values: AutomationFormValues) => {
    createMutation.mutate(values);
  };
  
  const getDefaultPromptForPlatform = (platform: string) => {
    if (platform === 'linkedin') {
      return `You are a professional social media content creator specializing in LinkedIn. 
Create an engaging LinkedIn post based on the meeting transcript provided. 
The post should be professional, highlight key insights, and include relevant hashtags.
Follow these guidelines:
- Keep it professional and business-focused
- Include 3-5 hashtags
- Aim for 150-200 words
- Focus on value and insights from the meeting
- Include a call to action`;
    }
    
    if (platform === 'facebook') {
      return `You are a social media content creator specializing in Facebook. 
Create an engaging Facebook post based on the meeting transcript provided. 
The post should be conversational, relatable, and encourage engagement.
Follow these guidelines:
- Use a more casual, conversational tone
- Include a question to encourage comments
- Aim for 100-150 words
- Focus on the most interesting points from the meeting
- Add 2-3 relevant hashtags`;
    }
    
    return "";
  };
  
  const handlePlatformChange = (platform: string) => {
    form.setValue("platform", platform);
    form.setValue("prompt", getDefaultPromptForPlatform(platform));
  };
  
  // Group automations by platform
  const groupedAutomations = automations ? automations.reduce((acc, automation) => {
    if (!acc[automation.platform]) {
      acc[automation.platform] = [];
    }
    acc[automation.platform].push(automation);
    return acc;
  }, {} as Record<string, typeof automations>) : {};
  
  return (
    <div className="py-6 md:py-8">
      <div className="px-4 sm:px-6 md:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">Automations</h1>
            <p className="mt-1 text-sm text-gray-500">Configure how your social media content is generated</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Automation
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-lg" />
            ))}
          </div>
        ) : automations?.length ? (
          <div className="mt-8">
            {/* Display automations grouped by platform */}
            {Object.entries(groupedAutomations).map(([platform, platformAutomations]) => (
              <div key={platform} className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {socialPlatforms.find(p => p.id === platform)?.name || platform}
                </h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {platformAutomations.map(automation => (
                    <AutomationItem key={automation.id} automation={automation} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 text-center py-12 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No automations found</h3>
            <p className="text-gray-500 mb-6">
              Create your first automation to automatically generate social media posts from your meetings.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Automation
            </Button>
          </div>
        )}
      </div>
      
      {/* Create Automation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Automation</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. LinkedIn Professional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select 
                      onValueChange={handlePlatformChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {socialPlatforms.map(platform => (
                          <SelectItem key={platform.id} value={platform.id}>
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prompt</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Instructions for generating content..." 
                        className="min-h-32"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Automatically generate posts for new meetings
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Automation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
