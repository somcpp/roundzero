"use server";

import { revalidatePath } from "next/cache";
import { getHackathon } from "@/lib/hackathons";
import { getResults } from "@/lib/results";
import { createClient } from "@/lib/supabase/server";

export type ResultsActionResult = { error: string } | { ok: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = { error: "Hackathon not found, or your session expired." };

function done(slug: string): ResultsActionResult {
  revalidatePath(`/h/${slug}`, "layout");
  return { ok: true };
}

/** Reorder the final ranking: `ids` get ranks 1…n in order. */
export async function setFinalRanking(slug: string, ids: string[]): Promise<ResultsActionResult> {
  if (!ids.every((id) => UUID.test(id)) || new Set(ids).size !== ids.length) return { error: "Invalid ranking. Reload and try again." };
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_final_ranking", { p_hackathon_id: hackathon.id, p_project_ids: ids });
  if (error) return { error: error.message };
  return done(slug);
}

/** Replace an award's winners with `ids`, in order. */
export async function setAwardWinners(slug: string, tierId: string, ids: string[]): Promise<ResultsActionResult> {
  if (!UUID.test(tierId) || !ids.every((id) => UUID.test(id)) || new Set(ids).size !== ids.length) {
    return { error: "Invalid pick. Reload and try again." };
  }
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;

  // Exclusive awards can't go to a project that already wins a rank prize.
  const results = await getResults(hackathon);
  const award = results.awards.find((a) => a.tier.id === tierId);
  if (!award) return { error: "Award not found. Reload and try again." };
  const blocked = award.candidates.find((c) => ids.includes(c.id) && !c.eligible);
  if (blocked) return { error: `${blocked.name} can't win ${award.tier.name}: ${blocked.reason?.toLowerCase()}.` };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_award_winners", {
    p_hackathon_id: hackathon.id,
    p_tier_id: tierId,
    p_project_ids: ids,
  });
  if (error) return { error: error.message };
  return done(slug);
}

/** Make the winners page public, or take it down again. Emails aren't sent yet. */
export async function publishResults(slug: string, published: boolean): Promise<ResultsActionResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return NOT_FOUND;
  if (published && hackathon.stage !== "results") return { error: "Close the last judging phase before publishing." };
  const supabase = await createClient();
  const { error } = await supabase.from("hackathons").update({ published }).eq("id", hackathon.id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return done(slug);
}
