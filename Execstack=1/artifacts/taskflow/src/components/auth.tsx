import { useEffect, type ReactNode } from "react";
import { SignIn, SignUp, useAuth } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const authConfigured = Boolean(
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim(),
);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBasePath(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function currentPathWithoutBase() {
  return `${stripBasePath(window.location.pathname)}${window.location.search}${window.location.hash}`;
}

function getSafeRedirectUrl() {
  const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
  if (!requestedPath || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return `${basePath}/dashboard`;
  }

  const target = new URL(requestedPath, window.location.origin);
  if (target.origin !== window.location.origin) return `${basePath}/dashboard`;
  return `${basePath}${stripBasePath(target.pathname)}${target.search}${target.hash}`;
}

export function AuthNotConfigured() {
  return (
    <main className="min-h-screen bg-background px-4 py-16 flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <ShieldAlert className="mb-4 h-9 w-9 text-amber-600" aria-hidden="true" />
        <h1 className="text-2xl font-bold tracking-tight">Authentication isn’t configured</h1>
        <p className="mt-3 text-muted-foreground">
          Sign-in is required to use TaskFlow. Configure{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_CLERK_PUBLISHABLE_KEY</code>{" "}
          for the frontend and{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">CLERK_SECRET_KEY</code>{" "}
          for the API.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/">
            <Button variant="outline">Back to home</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}

function AuthLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>Checking your sign-in…</span>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  if (!authConfigured) return <AuthNotConfigured />;
  return <ClerkAuthGate>{children}</ClerkAuthGate>;
}

function ClerkAuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const query = new URLSearchParams({ returnTo: currentPathWithoutBase() });
      setLocation(`/sign-in?${query.toString()}`, { replace: true });
    }
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <AuthLoading />;
  return children;
}

function AuthPageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-4 py-12 flex flex-col items-center justify-center">
      <Link href="/" className="mb-6 text-lg font-bold tracking-tight">
        TaskFlow
      </Link>
      {children}
    </main>
  );
}

export function SignInPage() {
  if (!authConfigured) return <AuthNotConfigured />;

  return (
    <AuthPageFrame>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={getSafeRedirectUrl()}
      />
    </AuthPageFrame>
  );
}

export function SignUpPage() {
  if (!authConfigured) return <AuthNotConfigured />;

  return (
    <AuthPageFrame>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={getSafeRedirectUrl()}
      />
    </AuthPageFrame>
  );
}
