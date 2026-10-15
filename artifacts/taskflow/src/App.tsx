import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { API_UNAUTHORIZED_EVENT } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { clerkAppearance, clerkLocalization } from "@/components/clerk-theme";

import { AuthGate, SignInPage, SignUpPage, authConfigured } from "@/components/auth";
import LandingPage from "@/pages/landing";
import AgentPage from "@/pages/agent";
import JarvisPage from "@/pages/jarvis";
import DashboardPage from "@/pages/dashboard";
import HistoryPage from "@/pages/history";
import TasksPage from "@/pages/tasks";
import NotFound from "@/pages/not-found";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const queryClient = new QueryClient();

function HomeRoute() {
  if (!authConfigured) return <LandingPage />;
  return <SignedInHomeRoute />;
}

function SignedInHomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setLocation("/dashboard", { replace: true });
    }
  }, [isLoaded, isSignedIn, setLocation]);

  return <LandingPage />;
}

function ProtectedDashboard() {
  return <AuthGate><DashboardPage /></AuthGate>;
}

function ProtectedTasks() {
  return <AuthGate><TasksPage /></AuthGate>;
}

function ProtectedHistory() {
  return <AuthGate><HistoryPage /></AuthGate>;
}

function ProtectedAgent() {
  return <AuthGate><AgentPage /></AuthGate>;
}

function ProtectedJarvis() {
  return <AuthGate><JarvisPage /></AuthGate>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener]);

  return null;
}

function Api401RedirectListener() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const redirectToSignIn = () => {
      const currentPath = stripBasePath(window.location.pathname);
      if (currentPath.startsWith("/sign-in") || currentPath.startsWith("/sign-up")) {
        return;
      }

      queryClient.clear();
      const returnTo = `${currentPath}${window.location.search}${window.location.hash}`;
      const query = new URLSearchParams({ returnTo });
      setLocation(`/sign-in?${query.toString()}`, { replace: true });
    };

    window.addEventListener(API_UNAUTHORIZED_EVENT, redirectToSignIn);
    return () => window.removeEventListener(API_UNAUTHORIZED_EVENT, redirectToSignIn);
  }, [setLocation]);

  return null;
}

function Routes() {
  return (
    <QueryClientProvider client={queryClient}>
      <Api401RedirectListener />
      {authConfigured && <ClerkQueryClientCacheInvalidator />}
      <Switch>
        <Route path="/" component={HomeRoute} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/dashboard" component={ProtectedDashboard} />
        <Route path="/tasks" component={ProtectedTasks} />
        <Route path="/history" component={ProtectedHistory} />
        <Route path="/agent" component={ProtectedAgent} />
        <Route path="/jarvis" component={ProtectedJarvis} />
        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

function stripBasePath(path: string) {
  if (!basePath) return path;
  if (path === basePath) return "/";
  if (path.startsWith(`${basePath}/`)) return path.slice(basePath.length) || "/";
  return path;
}

function RoutesWithClerk() {
  const [, setLocation] = useLocation();
  const routes = <Routes />;

  if (!authConfigured) return routes;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBasePath(to))}
      routerReplace={(to) => setLocation(stripBasePath(to), { replace: true })}
    >
      {routes}
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <RoutesWithClerk />
    </WouterRouter>
  );
}

export default App;
