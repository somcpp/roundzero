"use server";

import { revalidatePath } from "next/cache";
import { listCriteria } from "@/lib/criteria";
import { mechanisms as allMechanisms, type Criterion } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { createClient } from "@/lib/supabase/server";

export type SaveCriteriaResult = { error: string } | { items: Criterion[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MECHANISMS = new Set<string>(allMechanisms.map((m) => m.id));
const TIERS = new Set<string>(["quick", "balanced", "deep"]);
const DOUBLE_CHECKS = new Set<string>(["off", "auto", "always"]);

function clean(items: Criterion[]): { rows: Record<string, unknown>[]; error?: string } {
  const rows: Record<string, unknown>[] = [];
  for (const c of items) {
    const title = String(c.title ?? "").trim();
    if (!title) return { rows, error: "Every criterion needs a title." };
    if (title.length > 120) return { rows, error: `Keep "${title.slice(0, 24)}…" under 120 characters.` };
    const description = String(c.description ?? "").trim();
    if (description.length > 2000) return { rows, error: `Keep the description on "${title}" under 2000 characters.` };
    if (c.scale !== "score" && c.scale !== "pass_fail") return { rows, error: `"${title}" has an unknown scale.` };
    if (c.ifMissing !== "judge" && c.ifMissing !== "zero") return { rows, error: `"${title}" has an unknown missing-input rule.` };
    if (!c.mechanisms.every((m) => MECHANISMS.has(m))) return { rows, error: `"${title}" has an unknown mechanism.` };
    const weight = Math.round(Number(c.weight));
    if (!(weight >= 0 && weight <= 100)) return { rows, error: `Weight for "${title}" must be 0–100%.` };
    if (!UUID.test(c.id) || !c.inputs.every((id) => UUID.test(id))) {
      return { rows, error: "A criterion has an invalid id. Reload and try again." };
    }
    const agentGuidance = String(c.agentGuidance ?? "").trim();
    if (agentGuidance.length > 4000) return { rows, error: `Keep the agent guidance on "${title}" under 4000 characters.` };
    if (!TIERS.has(c.agentModel)) return { rows, error: `"${title}" has an unknown model.` };
    if (!DOUBLE_CHECKS.has(c.doubleCheck)) return { rows, error: `"${title}" has an unknown double-check setting.` };
    const lookFor = [...new Set((c.lookFor ?? []).map((x) => String(x).trim()).filter(Boolean))];
    if (lookFor.length > 30) return { rows, error: `"${title}" can look for up to 30 things.` };
    if (lookFor.join("").length > 2000 || lookFor.some((x) => x.length > 200)) {
      return { rows, error: `Keep what "${title}" looks for shorter.` };
    }
    const sandboxCommands = String(c.sandboxCommands ?? "").trim();
    if (sandboxCommands.length > 2000) return { rows, error: `Keep the sandbox commands on "${title}" under 2000 characters.` };
    rows.push({
      id: c.id,
      title,
      scale: c.scale,
      description,
      mechanisms: [...new Set(c.mechanisms)],
      weight,
      if_missing: c.ifMissing,
      // Only pass/fail criteria can gate eligibility.
      gate: c.scale === "pass_fail" && Boolean(c.gate),
      inputs: [...new Set(c.inputs)],
      agent_guidance: agentGuidance,
      agent_model: c.agentModel,
      look_for: lookFor,
      sandbox_commands: sandboxCommands,
      double_check: c.doubleCheck,
    });
  }
  return { rows };
}

/** Replace the hackathon's judging criteria with `items`, in order. */
export async function saveCriteria(slug: string, items: Criterion[]): Promise<SaveCriteriaResult> {
  const { rows, error } = clean(items);
  if (error) return { error };

  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };
  // Once judging starts only titles can change: reviews already in were scored against everything else.
  if (hackathon.judgingStartedAt) {
    const shape = (rs: Record<string, unknown>[]) =>
      JSON.stringify(
        rs.map((r) => ({
          ...r,
          title: null,
          inputs: [...(r.inputs as string[])].sort(),
          mechanisms: [...(r.mechanisms as string[])].sort(),
        })),
      );
    if (shape(rows) !== shape(clean(await listCriteria(hackathon.id)).rows)) {
      return { error: "Judging has started, so only criterion titles can change. Reset judging to change the rest." };
    }
  }

  const supabase = await createClient();
  const { error: saveError } = await supabase.rpc("save_criteria", {
    p_hackathon_id: hackathon.id,
    p_criteria: rows,
  });
  if (saveError) return { error: saveError.message };

  revalidatePath(`/h/${slug}`, "layout");
  return { items: await listCriteria(hackathon.id) };
}
