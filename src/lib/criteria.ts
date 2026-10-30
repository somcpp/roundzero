import { mechanisms as allMechanisms, type Criterion, type DoubleCheck, type Mechanism, type ModelTier, type Scale } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

/** Mechanisms that still exist. Retired ones (graphic_reviewer) drop out of old rows, so those criteria still save. */
const KNOWN_MECHANISMS = new Set<string>(allMechanisms.map((m) => m.id));

/** A row of public.criteria (supabase/migrations/*_create_criteria.sql) with its inputs embedded. */
type CriterionRow = {
  id: string;
  title: string;
  scale: Scale;
  description: string;
  mechanisms: Mechanism[];
  weight: number;
  if_missing: Criterion["ifMissing"];
  gate: boolean;
  agent_guidance: string;
  agent_model: ModelTier;
  look_for: string[];
  sandbox_commands: string;
  double_check: DoubleCheck;
  criterion_inputs: { block_id: string }[];
};

const COLUMNS =
  "id, title, scale, description, mechanisms, weight, if_missing, gate, agent_guidance, agent_model, look_for, sandbox_commands, double_check, criterion_inputs(block_id)";

function toCriterion(row: CriterionRow): Criterion {
  return {
    id: row.id,
    title: row.title,
    scale: row.scale,
    description: row.description,
    inputs: row.criterion_inputs.map((i) => i.block_id),
    mechanisms: row.mechanisms.filter((m) => KNOWN_MECHANISMS.has(m)),
    weight: row.weight,
    ifMissing: row.if_missing,
    gate: row.gate,
    agentGuidance: row.agent_guidance,
    agentModel: row.agent_model,
    lookFor: row.look_for,
    sandboxCommands: row.sandbox_commands,
    doubleCheck: row.double_check,
  };
}

/** A hackathon's judging criteria, in rubric order. RLS limits it to the owner. */
export async function listCriteria(hackathonId: string): Promise<Criterion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("criteria")
    .select(COLUMNS)
    .eq("hackathon_id", hackathonId)
    .order("position")
    .returns<CriterionRow[]>();
  if (error) throw new Error(`Couldn't load the judging criteria: ${error.message}`);
  return data.map(toCriterion);
}
