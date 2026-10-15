import { useState } from "react";
import Layout from "@/components/layout";
import { 
  useListTasks, 
  useCreateTask, 
  useUpdateTask, 
  useDeleteTask, 
  useToggleTaskComplete,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Plus, Search, FilterX, Trash2, Edit, CalendarDays } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.date().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export default function TasksPage() {
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<TaskPriority | "all">("all");
  const [search, setSearch] = useState("");
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params = {
    ...(filterStatus !== "all" && { status: filterStatus }),
    ...(filterPriority !== "all" && { priority: filterPriority }),
  };

  const { data: tasks, isLoading } = useListTasks(params, {
    query: {
      enabled: true,
      queryKey: getListTasksQueryKey(params),
    }
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
  };

  const createMutation = useCreateTask({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task created", description: "Your task has been added successfully." });
        setIsCreateOpen(false);
        invalidateQueries();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
      }
    }
  });

  const updateMutation = useUpdateTask({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task updated" });
        setEditingTask(null);
        invalidateQueries();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
      }
    }
  });

  const deleteMutation = useDeleteTask({
    mutation: {
      onSuccess: () => {
        toast({ title: "Task deleted" });
        invalidateQueries();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
      }
    }
  });

  const toggleMutation = useToggleTaskComplete({
    mutation: {
      onSuccess: () => {
        invalidateQueries();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update task status", variant: "destructive" });
      }
    }
  });

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
    },
  });

  const handleCreateOpen = () => {
    form.reset({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
    });
    setIsCreateOpen(true);
  };

  const handleEditOpen = (task: any) => {
    form.reset({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate) : null,
    });
    setEditingTask(task);
  };

  const onSubmit = (values: TaskFormValues) => {
    const submitData = {
      ...values,
      dueDate: values.dueDate ? format(values.dueDate, "yyyy-MM-dd") : null,
    };

    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: submitData });
    } else {
      createMutation.mutate({ data: submitData });
    }
  };

  const filteredTasks = tasks?.filter(task => 
    task.title.toLowerCase().includes(search.toLowerCase()) || 
    (task.description && task.description.toLowerCase().includes(search.toLowerCase()))
  );

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case "high": return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
      case "medium": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "low": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      default: return "";
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "done": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "in_progress": return "bg-primary/10 text-primary border-primary/20";
      case "todo": return "bg-muted text-muted-foreground border-border";
      default: return "";
    }
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and organize your work.</p>
        </div>
        
        <Button onClick={handleCreateOpen} data-testid="button-create-task">
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-tasks"
            />
          </div>
          
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterPriority} onValueChange={(v: any) => setFilterPriority(v)}>
              <SelectTrigger className="w-[140px]" data-testid="select-filter-priority">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            {(filterStatus !== "all" || filterPriority !== "all" || search) && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setFilterStatus("all");
                  setFilterPriority("all");
                  setSearch("");
                }}
                title="Clear Filters"
              >
                <FilterX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !filteredTasks || filteredTasks.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl bg-muted/20">
          <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
            <CheckSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">No tasks found</h3>
          <p className="text-muted-foreground mb-4">
            {search || filterStatus !== "all" || filterPriority !== "all" 
              ? "Try adjusting your filters or search query." 
              : "You have no tasks yet. Create one to get started."}
          </p>
          {!(search || filterStatus !== "all" || filterPriority !== "all") && (
            <Button onClick={handleCreateOpen} variant="outline">
              Create your first task
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
          {filteredTasks.map(task => (
            <Card 
              key={task.id} 
              className={cn(
                "hover-elevate shadow-sm transition-all duration-200 flex flex-col",
                task.status === "done" && "opacity-75 bg-muted/50"
              )}
              data-testid={`task-card-${task.id}`}
            >
              <div className="p-5 flex-1">
                <div className="flex items-start gap-3 mb-3">
                  <Checkbox 
                    checked={task.status === "done"}
                    onCheckedChange={() => toggleMutation.mutate({ id: task.id })}
                    disabled={toggleMutation.isPending}
                    className="mt-1 transition-transform active:scale-90"
                    data-testid={`checkbox-toggle-${task.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "font-semibold text-lg leading-tight mb-1",
                      task.status === "done" && "line-through text-muted-foreground"
                    )}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="px-4 py-2 bg-muted/30 border-t flex flex-wrap items-center gap-2 mt-auto">
                <Badge variant="outline" className={cn("capitalize text-xs font-medium px-2 py-0.5", getStatusColor(task.status))}>
                  {task.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={cn("capitalize text-xs font-medium px-2 py-0.5", getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
                {task.dueDate && (
                  <Badge variant="outline" className="text-xs bg-transparent border-border text-muted-foreground font-normal px-2 py-0.5 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {format(new Date(task.dueDate), "MMM d")}
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {confirmDeleteId === task.id ? (
                    <>
                      <span className="text-xs text-destructive font-medium mr-1">Delete?</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          deleteMutation.mutate({ id: task.id });
                          setConfirmDeleteId(null);
                        }}
                        data-testid={`button-delete-${task.id}`}
                      >
                        {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleEditOpen(task)}
                        data-testid={`button-edit-${task.id}`}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDeleteId(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingTask} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingTask(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="What needs to be done?" {...field} data-testid="input-task-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any extra details..." 
                        className="resize-none" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-task-desc"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-task-priority">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="button-task-date"
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-task-submit"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingTask ? "Save Changes" : "Create Task"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}

// Ensure the CheckSquare icon is imported at the top
import { CheckSquare } from "lucide-react";