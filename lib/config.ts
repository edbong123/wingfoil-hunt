function bool(v: string | undefined, d: boolean) {
  if (v === undefined || v === "") return d;
  return v === "true" || v === "1";
}
function int(v: string | undefined, d: number) {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : d;
}

export const config = {
  siteUrl: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  sessionSecret: process.env.SESSION_SECRET ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  igAppId: process.env.IG_APP_ID ?? "",
  igAppSecret: process.env.IG_APP_SECRET ?? "",
  igVerifyToken: process.env.IG_WEBHOOK_VERIFY_TOKEN ?? "",
  igUserId: process.env.IG_USER_ID ?? "",
  igAccessToken: process.env.IG_ACCESS_TOKEN ?? "",
  graphVersion: process.env.GRAPH_VERSION || "v23.0",
  dryRun: bool(process.env.DRY_RUN, true),
  devLogin: bool(process.env.DEV_LOGIN, false),
  roundCloseHourUtc: int(process.env.ROUND_CLOSE_HOUR_UTC, 18),
  votesPerIpPerRound: int(process.env.VOTES_PER_IP_PER_ROUND, 3),
  minVoterFollowers: int(process.env.MIN_VOTER_FOLLOWERS, 0),
  minVoterMedia: int(process.env.MIN_VOTER_MEDIA, 1),
  minVotesToWin: int(process.env.MIN_VOTES_TO_WIN, 1),
  reportsToFlag: int(process.env.REPORTS_TO_FLAG, 3),
  carryOver: bool(process.env.CARRY_OVER, true),
  cronSecret: process.env.CRON_SECRET ?? "",
};
