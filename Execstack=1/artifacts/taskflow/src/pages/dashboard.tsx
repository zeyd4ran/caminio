import Layout from "@/components/layout";
import { useGetTaskStats, getGetTaskStatsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Clock, AlertTriangle, ListTodo, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function DashboardPage() {
  const { data: stats, isLoading, isError } = useGetTaskStats({
    query: {
      enabled: true,
      queryKey: getGetTaskStatsQueryKey(),
    }
  });

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here is your current task landscape.</p>
        </div>
        <Link href="/tasks">
          <Button data-testid="button-add-task-quick">
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError || !stats ? (
        <div className="p-8 text-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
          <AlertTriangle className="h-8 w-8 mx-auto mb-3" />
          <h3 className="text-lg font-medium">Failed to load statistics</h3>
          <p className="text-sm mt-1">Please try refreshing the page.</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Top Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover-elevate shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
                <ListTodo className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold" data-testid="stat-total">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="hover-elevate shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-600" data-testid="stat-completed">{stats.completed}</div>
              </CardContent>
            </Card>
            <Card className="hover-elevate shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-600" data-testid="stat-pending">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card className="hover-elevate shadow-sm border-destructive/20">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-destructive">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive" data-testid="stat-overdue">{stats.overdue}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Priority Breakdown */}
            <Card className="lg:col-span-1 shadow-sm">
              <CardHeader>
                <CardTitle>By Priority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="font-medium">High</span>
                  </div>
                  <span className="font-bold" data-testid="stat-priority-high">{stats.byPriority.high}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="font-medium">Medium</span>
                  </div>
                  <span className="font-bold" data-testid="stat-priority-medium">{stats.byPriority.medium}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="font-medium">Low</span>
                  </div>
                  <span className="font-bold" data-testid="stat-priority-low">{stats.byPriority.low}</span>
                </div>
              </CardContent>
            </Card>

            {/* Recently Completed */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader>
                <CardTitle>Recently Completed</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentlyCompleted.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recently completed tasks.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.recentlyCompleted.map(task => (
                      <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 mb-2 sm:mb-0">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                          <div>
                            <p className="font-medium line-through text-muted-foreground">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs capitalize">{task.priority} Priority</Badge>
                            </div>
                          </div>
                        </div>
                        {task.updatedAt && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Done {format(new Date(task.updatedAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </Layout>
  );
}