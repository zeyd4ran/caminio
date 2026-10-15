import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#001aff",
    colorForeground: "#0f172a",
    colorMutedForeground: "#64748b",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#0f172a",
    colorNeutral: "#cbd5e1",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-semibold tracking-tight text-slate-900",
    headerSubtitle: "text-slate-600",
    socialButtonsBlockButtonText: "font-medium text-slate-700",
    formFieldLabel: "font-medium text-slate-800",
    footerActionLink: "font-medium text-blue-700 hover:text-blue-800",
    footerActionText: "text-slate-600",
    dividerText: "text-slate-500",
    identityPreviewEditButton: "font-medium text-blue-700",
    formFieldSuccessText: "text-emerald-700",
    alertText: "text-rose-700",
    logoBox: "mb-2",
    logoImage: "h-10 w-10 rounded-xl",
    socialButtonsBlockButton: "border border-slate-200 bg-white hover:bg-slate-50",
    formButtonPrimary: "bg-blue-700 hover:bg-blue-800 text-white",
    formFieldInput: "border-slate-300 bg-white text-slate-900",
    footerAction: "border-0 bg-transparent",
    dividerLine: "bg-slate-200",
    alert: "border border-rose-200 bg-rose-50",
    otpCodeFieldInput: "border-slate-300 bg-white text-slate-900",
    formFieldRow: "text-slate-800",
    main: "text-slate-900",
  },
};

export const clerkLocalization = {
  signIn: {
    start: {
      title: "Welcome back",
      subtitle: "Sign in to access your TaskFlow workspace",
    },
  },
  signUp: {
    start: {
      title: "Create your TaskFlow account",
      subtitle: "Get started with your workspace",
    },
  },
};
