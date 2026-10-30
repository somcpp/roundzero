import { gateStatus, type GateFail, type GateStatus } from "@/lib/gate-status";
import { getDistribution } from "@/lib/judging";
import { createClient } from "@/lib/supabase/server";

// Gates that judges' reviews failed, read the way public.judge_gate_fails()
// and public.judge_gate_failed() (migrations/*_judge_gate_rule.sql) count
// them: submitted reviews, every phase, per gate criterion.

export { describeGateFails, gateStatus, type GateFail, type GateRule, type GateStatus } from "@/lib/gate-status";

type Row = {
  criterion_id: string;
  passed: boolean;
  criteria: { title: string; position: number };
  judge_assignments: { project_id: string };
};

/** Project id → the gates its submitted reviews failed. Projects with no failed gate are left out. */
export async function getGateFails(hackathonId: string): Promise<Map<string, GateFail[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("judge_scores")
    .select(
      "criterion_id, passed, criteria!inner(title, position, gate), judge_assignments!inner(project_id, submitted_at, judging_phases!inner(hackathon_id))",
    )
    .eq("criteria.gate", true)
    .not("passed", "is", null)
    .not("judge_assignments.submitted_at", "is", null)
    .eq("judge_assignments.judging_phases.hackathon_id", hackathonId)
    .returns<Row[]>();
  if (error) throw new Error(`Couldn't load gate results: ${error.message}`);

  const counts = new Map<string, GateFail & { position: number; projectId: string }>();
  for (const r of data) {
    const key = `${r.judge_assignments.project_id}:${r.criterion_id}`;
    const c = counts.get(key) ?? {
      projectId: r.judge_assignments.project_id,
      criterionId: r.criterion_id,
      title: r.criteria.title,
      position: r.criteria.position,
      fails: 0,
      reviews: 0,
    };
    c.reviews += 1;
    if (!r.passed) c.fails += 1;
    counts.set(key, c);
  }

  const byProject = new Map<string, GateFail[]>();
  for (const c of [...counts.values()].filter((c) => c.fails > 0).sort((a, b) => a.position - b.position)) {
    byProject.set(c.projectId, [
      ...(byProject.get(c.projectId) ?? []),
      { criterionId: c.criterionId, title: c.title, fails: c.fails, reviews: c.reviews },
    ]);
  }
  return byProject;
}

/** One project's gate status under its hackathon's rule, for the project page. */
export async function getProjectGateStatus(hackathonId: string, projectId: string): Promise<GateStatus | null> {
  const [fails, rule] = await Promise.all([getGateFails(hackathonId), getDistribution(hackathonId)]);
  return gateStatus(fails.get(projectId), rule);
}
