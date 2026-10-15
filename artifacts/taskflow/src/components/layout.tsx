import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, CheckSquare, Bot, LogOut, Cpu, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authConfigured } from "@/components/auth";

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-sidebar flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-sidebar-primary tracking-tight">TaskFlow</h1>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <Link href="/dashboard">
            <Button
              variant={location === "/dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start font-medium"
              data-testid="link-dashboard"
            >
              <LayoutDashboard className="mr-2 h-5 w-5" />
              Dashboard
            </Button>
          </Link>
          <Link href="/tasks">
            <Button
              variant={location === "/tasks" ? "secondary" : "ghost"}
              className="w-full justify-start font-medium"
              data-testid="link-tasks"
            >
              <CheckSquare className="mr-2 h-5 w-5" />
              Tasks
            </Button>
          </Link>
          <Link href="/agent">
            <Button
              variant={location === "/agent" ? "secondary" : "ghost"}
              className="w-full justify-start font-medium"
              data-testid="link-agent"
            >
              <Bot className="mr-2 h-5 w-5" />
              Agent Lab
            </Button>
          </Link>
          <Link href="/jarvis">
            <Button
              variant={location === "/jarvis" ? "secondary" : "ghost"}
              className="w-full justify-start font-medium"
              data-testid="link-jarvis"
            >
              <Cpu className="mr-2 h-5 w-5" />
              Jarvis
            </Button>
          </Link>
          <Link href="/history">
            <Button
              variant={location === "/history" ? "secondary" : "ghost"}
              className="w-full justify-start font-medium"
              data-testid="link-history"
            >
              <History className="mr-2 h-5 w-5" />
              History
            </Button>
          </Link>
        </nav>

        {authConfigured && <SidebarAccount />}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden max-h-screen">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarAccount() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const queryClient = useQueryClient();

  if (!isLoaded) return null;

  if (!user) {
    return (
      <div className="border-t border-border p-4">
        <Link href="/sign-in">
          <Button variant="outline" className="w-full">Sign in</Button>
        </Link>
      </div>
    );
  }

  const displayName = user.fullName || user.primaryEmailAddress?.emailAddress || "TaskFlow user";
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TF";

  async function handleSignOut() {
    queryClient.clear();
    await signOut({ redirectUrl: import.meta.env.BASE_URL || "/" });
  }

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={user.imageUrl} alt="" />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={displayName}>{displayName}</p>
          {user.primaryEmailAddress?.emailAddress && (
            <p className="truncate text-xs text-muted-foreground">
              {user.primaryEmailAddress.emailAddress}
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        className="w-full justify-start"
        onClick={() => void handleSignOut()}
        data-testid="button-signout"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}