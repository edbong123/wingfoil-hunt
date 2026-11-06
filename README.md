# Wingfoil Hunt

Product Hunt for wingfoiling. Hunters DM a photo or video to the Wingfoil Instagram, Claude screens it, it goes on a public voting page, and the top-voted entry each 24h round is posted to the Wingfoil feed with credit.

## Flow

1. **Intake**: `POST /api/webhook/instagram` (signature checked). Media is downloaded to Supabase Storage right away because Meta URLs expire.
2. **Bot**: no attachment or a question gets a Claude-written reply. Shared posts/reels (links only) get asked for the raw file.
3. **Rights**: bot asks for `YES` (+ optional `@rider` and caption). Confirmation is stored on the submission.
4. **Screening**: Claude vision returns approve / reject / flag. Videos always go to manual review (no frame extraction yet). Rejections are DM'd with the reason.
5. **Voting**: `/` lists the current round. Instagram Login, one vote per person per round, capped per IP per round, report button (auto-flags after `REPORTS_TO_FLAG`).
6. **Nightly publish**: Vercel Cron hits `/api/cron/close-round` at `ROUND_CLOSE_HOUR_UTC`. Picks the top approved entry, publishes via the Content Publishing API (tags the photographer, mentions the rider), DMs the winner, marks them a hunter, opens the next round.
7. **Hunters**: `is_hunter` flag + badge.

`/admin` (Basic auth, password = `ADMIN_PASSWORD`): review queue, top candidates with a remove button, close-round-now, a DM simulator that runs the full bot flow without Meta, message log, publish log.

## Safe testing

- `DRY_RUN=true` (default): the cron logs the caption and payload to `publish_log` instead of posting.
- DM simulator in `/admin`: sender ids start with `sim_`, replies are logged, never sent.
- `DEV_LOGIN=true`: `/api/auth/dev?handle=alice` logs in a fake voter. Turn off in production.

## Stack

Next.js 15 (App Router) on Vercel, Supabase Postgres + Storage, Claude via `@anthropic-ai/sdk`, official Instagram Platform API only.

Schema: `supabase/migrations/0001_init.sql`. RLS is on with no policies: only the server (service role) touches data.

## Setup

1. Supabase: run the migration (already applied on the `wingfoil-hunt` project).
2. Vercel: import this repo, connect the Supabase project (Storage tab) so `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected, add the rest from `.env.example`.
3. Meta:
   - Instagram professional account (linked to a Facebook Page).
   - Meta app with the **Instagram API with Instagram Login** product. Permissions: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_content_publish`.
   - Webhook callback `https://<site>/api/webhook/instagram`, verify token = `IG_WEBHOOK_VERIFY_TOKEN`, subscribe to `messages`.
   - Generate a long-lived token for the Wingfoil account -> `IG_ACCESS_TOKEN`, its id -> `IG_USER_ID`. Long-lived tokens last 60 days; refresh them.
   - OAuth redirect URI: `https://<site>/api/auth/instagram/callback`.
   - Until App Review passes, it only works for accounts added as testers in the app.

## Known limits

- **Instagram Login only works for professional (Business/Creator) accounts.** Personal-account voters can't sign in. Options: add Facebook Login or email magic links before launch.
- The Meta 24h messaging window: winner DMs are skipped (and logged) if the winner hasn't messaged in 24h.
- Videos need manual approval.
- `CARRY_OVER=true` moves non-winning approved entries to the next round with votes reset.
