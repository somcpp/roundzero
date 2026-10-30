import { tiersForRank, type Hackathon, type ProjectRecord, type RewardSettings, type RewardTier, type SchemaBlock } from "@/lib/data";
import { gateStatus, getGateFails, type GateStatus } from "@/lib/gates";
import { getDistribution, getJudgingActivity, listPhases, listProjects } from "@/lib/judging";
import { entrantsOf, placeRanking } from "@/lib/prize-places";
import { formatNumber, projectHeadline } from "@/lib/project-fields";
import { average, compareRank } from "@/lib/ranking";
import { getRewardSettings, listRewardTiers } from "@/lib/rewards";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

export type ResultProject = {
  id: string;
  number: number;
  name: string;
  pitch: string;
  /** Average of every submitted judge score, then the agent's, for suggestions. */
  score: number | null;
  disqualified: boolean;
  /** Gates that reviews failed, and whether that rules it out; null when none did. */
  gate: GateStatus | null;
};

export type RankedProject = ResultProject & {
  rank: number;
  /**
   * The place its rank tiers go by: the rank itself, or with one prize per
   * team, its place once teams that already won are skipped. Null when skipped.
   */
  prizePlace: number | null;
  /** With one prize per team: the better-ranked project of the same team that takes the team's prize. */
  blockedBy?: { number: number; name: string };
  /** Average judge score in the phase the ranking comes from. */
  phaseScore: number | null;
  /** Rank tiers this place collects. */
  tiers: RewardTier[];
};

export type AwardResult = {
  tier: RewardTier;
  /** The criterion whose scores suggest winners, when the award picks that way. */
  criterion: { id: string; title: string } | null;
  winners: ResultProject[];
  /**
   * Everyone who could win, best suggestion first. `criterionScore` is the
   * average judge score on the award's criterion, when it has one.
   */
  candidates: (ResultProject & { eligible: boolean; reason?: string; criterionScore: number | null })[];
};

export type Results = {
  /** "final" once the last phase closes; "projected" from the phase running now; "none" before judging. */
  state: "final" | "projected" | "none";
  sourcePhase: string | null;
  ranking: RankedProject[];
  awards: AwardResult[];
  /** Every project that wins anything, with all the tiers it collects. */
  winners: { project: ResultProject; rank: number | null; tiers: RewardTier[] }[];
};

/**
 * The rank tiers each project in a ranking collects, and with one prize per
 * team, which team each project is on (by shared members in Team fields).
 * The results page and a project's page both place prizes through here, so
 * they agree.
 */
function placeRankTiers(
  ranking: { id: string; rank: number }[],
  tiers: RewardTier[],
  settings: RewardSettings,
  projects: Pick<ProjectRecord, "id" | "values">[],
  blocks: SchemaBlock[],
) {
  const entrants = settings.oneWinPerEntrant
    ? entrantsOf(projects, blocks.filter((b) => b.type === "team").map((b) => b.id))
    : null;
  return { entrants, placed: placeRanking(ranking, (place) => tiersForRank(tiers, place), entrants) };
}

/**
 * Who's winning what. After the last phase closes this is the saved final
 * ranking; while judging runs it's projected from the phase in progress, the
 * same way closing it would rank.
 */
export async function getResults(hackathon: Hackathon): Promise<Results> {
  const supabase = await createClient();
  const [projects, blocks, phases, activity, tiers, settings, gateFails, distribution, awardRows, scoreRows, criteriaRows] =
    await Promise.all([
      listProjects(hackathon.id),
      listSchemaBlocks(hackathon.id),
      listPhases(hackathon.id),
      getJudgingActivity(hackathon.id),
      listRewardTiers(hackathon.id),
      getRewardSettings(hackathon.id),
      getGateFails(hackathon.id),
      getDistribution(hackathon.id),
      supabase
        .from("award_winners")
        .select("tier_id, project_id, position, reward_tiers!inner(hackathon_id)")
        .eq("reward_tiers.hackathon_id", hackathon.id)
        .order("position")
        .returns<{ tier_id: string; project_id: string }[]>(),
      supabase
        .from("judge_scores")
        .select("criterion_id, score, passed, judge_assignments!inner(project_id, judging_phases!inner(hackathon_id))")
        .eq("judge_assignments.judging_phases.hackathon_id", hackathon.id)
        .returns<{ criterion_id: string; score: number | null; passed: boolean | null; judge_assignments: { project_id: string } }[]>(),
      supabase.from("criteria").select("id, title").eq("hackathon_id", hackathon.id).returns<{ id: string; title: string }[]>(),
    ]);
  const error = awardRows.error ?? scoreRows.error ?? criteriaRows.error;
  if (error) throw new Error(`Couldn't load award winners: ${error.message}`);

  // Each project's judge scores per criterion, from every phase. A pass
  // counts 10 and a fail 0, the same as in a review's total.
  const byCriterion = new Map<string, number[]>();
  for (const s of scoreRows.data!) {
    const key = `${s.judge_assignments.project_id}:${s.criterion_id}`;
    byCriterion.set(key, [...(byCriterion.get(key) ?? []), s.score ?? (s.passed ? 10 : 0)]);
  }
  const onCriterion = (projectId: string, criterionId: string) => average(byCriterion.get(`${projectId}:${criterionId}`) ?? []);

  const agent = new Map(activity.agentReviews.map((r) => [r.projectId, r]));
  const scoresFor = (projectId: string, phaseId?: string) =>
    activity.assignments
      .filter((a) => a.projectId === projectId && a.score !== null && (!phaseId || a.phaseId === phaseId))
      .map((a) => a.score!);

  const lite = new Map<string, ResultProject>(
    projects.map((p) => {
      const { name, pitch } = projectHeadline(p, blocks);
      return [
        p.id,
        {
          id: p.id,
          number: p.number,
          name,
          pitch,
          score: average(scoresFor(p.id)) ?? agent.get(p.id)?.total ?? null,
          disqualified: p.status === "disqualified",
          gate: gateStatus(gateFails.get(p.id), distribution),
        },
      ];
    }),
  );
  const ruledOut = (id: string) => !!lite.get(id)?.gate?.ruledOut;

  // ── Ranking ──
  const lastPhase = phases.at(-1);
  const running = phases.find((p) => p.startedAt && !p.closedAt);
  const final = projects.some((p) => p.finalRank !== null);
  const sourcePhase = final ? lastPhase : running;
  let ordered: { id: string; rank: number }[] = [];
  if (final) {
    ordered = projects
      .filter((p) => p.finalRank !== null)
      .sort((a, b) => a.finalRank! - b.finalRank!)
      .map((p) => ({ id: p.id, rank: p.finalRank! }));
  } else if (running) {
    ordered = projects
      .filter((p) => p.phaseId === running.id && p.status === "active")
      .map((p) => ({
        id: p.id,
        number: p.number,
        avg: average(scoresFor(p.id, running.id)),
        agentTotal: agent.get(p.id)?.total ?? null,
        gateFailed: agent.get(p.id)?.gatePassed === false || ruledOut(p.id),
      }))
      .sort(compareRank)
      .map((p, i) => ({ id: p.id, rank: i + 1 }));
  }
  const { entrants, placed } = placeRankTiers(ordered, tiers, settings, projects, blocks);
  const ranking: RankedProject[] = ordered.map(({ id, rank }) => {
    const { prizePlace, blockedBy, tiers: won } = placed.get(id)!;
    const by = blockedBy ? lite.get(blockedBy) : undefined;
    return {
      ...lite.get(id)!,
      rank,
      prizePlace,
      ...(by && { blockedBy: { number: by.number, name: by.name } }),
      phaseScore: sourcePhase ? average(scoresFor(id, sourcePhase.id)) : null,
      tiers: won,
    };
  });
  const rankOf = new Map(ranking.map((r) => [r.id, r.rank]));
  const hasRankPrize = new Set(ranking.filter((r) => r.tiers.length).map((r) => r.id));
  const awardTiers = tiers.filter((t) => t.recipients === "award");

  // With one prize per team: what each team already wins, rank prizes first,
  // then awards, as the project that wins it and the tier.
  const teamOf = (id: string) => entrants?.get(id) ?? id;
  const teamWins = new Map<string, { projectId: string; tier: RewardTier }[]>();
  const addTeamWin = (projectId: string, tier: RewardTier) =>
    teamWins.set(teamOf(projectId), [...(teamWins.get(teamOf(projectId)) ?? []), { projectId, tier }]);
  if (entrants) {
    for (const r of ranking) if (r.tiers.length) addTeamWin(r.id, r.tiers[0]);
    for (const w of awardRows.data!) {
      const tier = awardTiers.find((t) => t.id === w.tier_id);
      if (tier && lite.has(w.project_id)) addTeamWin(w.project_id, tier);
    }
  }
  /** Why `p` can't take `tier` under one prize per team: its team already wins something else. */
  const teamAlreadyWins = (p: ResultProject, tier: RewardTier) => {
    const win = teamWins.get(teamOf(p.id))?.find((w) => !(w.projectId === p.id && w.tier.id === tier.id));
    if (!win) return undefined;
    if (win.projectId === p.id) return `Already wins ${win.tier.name}`;
    return `Team already wins ${win.tier.name} with ${formatNumber(lite.get(win.projectId)!.number)}`;
  };

  // ── Awards ──
  const awards: AwardResult[] = awardTiers.map((tier) => {
    const winners = awardRows.data!
      .filter((w) => w.tier_id === tier.id)
      .map((w) => lite.get(w.project_id))
      .filter((p): p is ResultProject => !!p);
    const criterion = (tier.pick === "criterion" && criteriaRows.data!.find((c) => c.id === tier.criterionId)) || null;
    const candidates = [...lite.values()]
      .filter((p) => !p.disqualified)
      .map((p) => {
        // A failed gate makes a project ineligible for everything.
        const reason =
          agent.get(p.id)?.gatePassed === false
            ? "Failed an agent gate"
            : ruledOut(p.id)
              ? "Ruled out by judges on a gate"
              : tier.exclusive && hasRankPrize.has(p.id)
                ? `Already wins a rank prize (#${rankOf.get(p.id)})`
                : teamAlreadyWins(p, tier);
        return { ...p, eligible: !reason, reason, criterionScore: criterion ? onCriterion(p.id, criterion.id) : null };
      })
      .sort(
        (a, b) =>
          Number(b.eligible) - Number(a.eligible) ||
          (b.criterionScore ?? -1) - (a.criterionScore ?? -1) ||
          (b.score ?? -1) - (a.score ?? -1) ||
          a.number - b.number,
      );
    return { tier, criterion, winners, candidates };
  });

  // ── Everyone who wins something ──
  const byProject = new Map<string, { project: ResultProject; rank: number | null; tiers: RewardTier[] }>();
  const add = (p: ResultProject, t: RewardTier) => {
    const entry = byProject.get(p.id) ?? { project: p, rank: rankOf.get(p.id) ?? null, tiers: [] };
    entry.tiers.push(t);
    byProject.set(p.id, entry);
  };
  for (const r of ranking) for (const t of r.tiers) add(r, t);
  for (const a of awards) for (const w of a.winners) add(w, a.tier);
  const winners = [...byProject.values()].sort(
    (a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || a.project.number - b.project.number,
  );

  return {
    state: final ? "final" : running ? "projected" : "none",
    sourcePhase: sourcePhase?.name ?? null,
    ranking,
    awards,
    winners,
  };
}

export type ProjectWins = {
  /** Final rank, or null until the last phase closes. */
  rank: number | null;
  /** How many projects the final ranking has. */
  ranked: number;
  /** Rank tiers its place collects, then the awards it was picked for. Empty if it won nothing. */
  tiers: RewardTier[];
};

/** What one project wins, the same way the results page counts it. */
export async function getProjectWins(
  hackathonId: string,
  project: Pick<ProjectRecord, "id" | "finalRank">,
): Promise<ProjectWins> {
  const supabase = await createClient();
  const [tiers, settings, awardRows, ranked] = await Promise.all([
    listRewardTiers(hackathonId),
    getRewardSettings(hackathonId),
    supabase.from("award_winners").select("tier_id").eq("project_id", project.id).returns<{ tier_id: string }[]>(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("hackathon_id", hackathonId)
      .not("final_rank", "is", null),
  ]);
  const error = awardRows.error ?? ranked.error;
  if (error) throw new Error(`Couldn't load what this project won: ${error.message}`);
  const awarded = new Set(awardRows.data!.map((w) => w.tier_id));
  const rank = project.finalRank;

  // With one prize per team, its place depends on every finalist and their teams.
  let rankTiers: RewardTier[] = [];
  if (rank !== null) {
    const [projects, blocks] = settings.oneWinPerEntrant
      ? await Promise.all([listProjects(hackathonId), listSchemaBlocks(hackathonId)])
      : [[], []];
    const finalists = settings.oneWinPerEntrant
      ? projects.filter((p) => p.finalRank !== null).map((p) => ({ id: p.id, rank: p.finalRank! }))
      : [{ id: project.id, rank }];
    rankTiers = placeRankTiers(finalists, tiers, settings, projects, blocks).placed.get(project.id)?.tiers ?? [];
  }

  return {
    rank,
    ranked: ranked.count ?? 0,
    tiers: [...rankTiers, ...tiers.filter((t) => t.recipients === "award" && awarded.has(t.id))],
  };
}
