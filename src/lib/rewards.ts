import {
  defaultRewardSettings,
  type AwardPick,
  type RewardItem,
  type RewardKind,
  type RewardRecipients,
  type RewardSettings,
  type RewardTier,
} from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** A row of public.reward_tiers (supabase/migrations/*_create_rewards.sql) with its items embedded. */
type RewardTierRow = {
  id: string;
  name: string;
  description: string;
  recipients: RewardRecipients;
  rank_from: number | null;
  rank_to: number | null;
  winner_count: number | null;
  pick: AwardPick | null;
  criterion_id: string | null;
  exclusive: boolean;
  image_path: string | null;
  reward_items: { id: string; position: number; kind: RewardKind; label: string; detail: string }[];
};

const COLUMNS =
  "id, name, description, recipients, rank_from, rank_to, winner_count, pick, criterion_id, exclusive, image_path, reward_items(id, position, kind, label, detail)";

function toTier(row: RewardTierRow): RewardTier {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    recipients: row.recipients,
    rankFrom: row.rank_from,
    rankTo: row.rank_to,
    winnerCount: row.winner_count,
    pick: row.pick,
    criterionId: row.criterion_id,
    exclusive: row.exclusive,
    imagePath: row.image_path,
    items: [...row.reward_items]
      .sort((a, b) => a.position - b.position)
      .map((i): RewardItem => ({ id: i.id, kind: i.kind, label: i.label, detail: i.detail })),
  };
}

/** A hackathon's reward tiers, in display order. RLS limits it to the owner. */
export async function listRewardTiers(hackathonId: string): Promise<RewardTier[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_tiers")
    .select(COLUMNS)
    .eq("hackathon_id", hackathonId)
    .order("position")
    .returns<RewardTierRow[]>();
  if (error) throw new Error(`Couldn't load the rewards: ${error.message}`);
  return data.map(toTier);
}

/** Postgres and PostgREST codes for a table that doesn't exist (yet). */
export const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

/**
 * A hackathon's reward rules (supabase/migrations/*_reward_settings.sql), or
 * the defaults if never saved. Also the defaults while that migration hasn't
 * been applied, so pages keep working. RLS limits it to the owner.
 */
export async function getRewardSettings(hackathonId: string): Promise<RewardSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reward_settings")
    .select("one_win_per_entrant")
    .eq("hackathon_id", hackathonId)
    .maybeSingle<{ one_win_per_entrant: boolean }>();
  if (error && MISSING_TABLE.has(error.code)) return defaultRewardSettings;
  if (error) throw new Error(`Couldn't load the reward settings: ${error.message}`);
  if (!data) return defaultRewardSettings;
  return { oneWinPerEntrant: data.one_win_per_entrant };
}
