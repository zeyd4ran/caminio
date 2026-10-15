import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, LayoutDashboard, Target } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">TaskFlow</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" data-testid="link-signin">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button data-testid="link-signup">Sign Up</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="max-w-3xl space-y-8">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-tight">
            Focus on what <span className="text-primary">matters.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A minimalist, high-performance task workspace designed to help you stay on top of your work, track progress, and feel in control of your day.
          </p>
          
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link href="/sign-up">
              <Button size="lg" className="h-12 px-8 text-base shadow-lg" data-testid="button-cta-signup">
                Start for free <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto w-full text-left">
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
            <Target className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Intentional Design</h3>
            <p className="text-muted-foreground">Every element has a purpose. No clutter, no distractions. Just your work, organized perfectly.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
            <CheckCircle2 className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Track Progress</h3>
            <p className="text-muted-foreground">Know exactly where you stand with clear status indicators and comprehensive dashboard stats.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
            <LayoutDashboard className="h-10 w-10 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Command Center</h3>
            <p className="text-muted-foreground">Your entire task landscape visible at a glance. Manage priorities and deadlines effortlessly.</p>
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-muted-foreground border-t border-border">
        <p>© {new Date().getFullYear()} TaskFlow. Built for focus.</p>
      </footer>
    </div>
  );
}