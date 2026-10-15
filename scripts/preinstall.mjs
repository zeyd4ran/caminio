const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  process.stderr.write("Error: Use pnpm instead of npm or yarn.\n");
  process.exit(1);
}
