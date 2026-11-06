import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type SubmissionStatus =
  | "awaiting_rights"
  | "pending"
  | "approved"
  | "rejected"
  | "flagged"
  | "published";

export type User = {
  id: string;
  igsid: string | null;
  ig_user_id: string | null;
  handle: string | null;
  is_hunter: boolean;
};

export type Submission = {
  id: string;
  submitter_id: string;
  media_type: "image" | "video";
  media_url: string;
  storage_path: string;
  content_type: string | null;
  caption: string | null;
  athlete_handle: string | null;
  rights_confirmed: boolean;
  status: SubmissionStatus;
  screening_reason: string | null;
  round_id: number | null;
  vote_count: number;
  report_count: number;
  created_at: string;
  published_at: string | null;
  ig_media_id: string | null;
};

export type Round = {
  id: number;
  starts_at: string;
  ends_at: string;
  status: "open" | "closed";
  winner_submission_id: string | null;
};

export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
