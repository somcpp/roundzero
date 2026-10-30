"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ProjectValue, SchemaBlock } from "@/lib/data";
import { getHackathon } from "@/lib/hackathons";
import { indexProjectQuietly } from "@/lib/project-index";
import { listSchemaBlocks } from "@/lib/schema-blocks";
import { createClient } from "@/lib/supabase/server";

const SAMPLE_PROJECTS = [
  { name: "Repo Whisperer", pitch: "Ask any codebase anything", slug: "repo-whisperer", team: ["Ana P.", "Theo R.", "Kai M."] },
  { name: "Ledgerly", pitch: "Agentic bookkeeping for indie devs", slug: "ledgerly", team: ["Rin S.", "Omar B."] },
  { name: "Nightshift", pitch: "Overnight agent that fixes flaky tests", slug: "nightshift", team: ["Jules V."] },
  { name: "Cartographer", pitch: "Maps your infra from Terraform and logs", slug: "cartographer", team: ["Mo A.", "Lia K.", "Sven T.", "Ifeoma N."] },
  { name: "Pocket QA", pitch: "A QA agent that lives in your PRs", slug: "pocket-qa", team: ["Dev P.", "Hana Y."] },
  { name: "Standup Bot", pitch: "Writes your standup from yesterday's commits", slug: "standup-bot", team: ["Carla D.", "Ben W."] },
  { name: "Menu Mind", pitch: "Voice ordering agent for small restaurants", slug: "menu-mind", team: ["Tomas G.", "Aiko F.", "Raj L."] },
  { name: "Grant Scout", pitch: "Finds and drafts research grant applications", slug: "grant-scout", team: ["Noor H.", "Eli C."] },
  { name: "Changelog Crow", pitch: "Turns merged PRs into release notes", slug: "changelog-crow", team: ["Pia Z."] },
  { name: "Tripwire", pitch: "Watches prod and files good bug reports", slug: "tripwire", team: ["Sam O.", "Yusuf E.", "Greta J."] },
  { name: "Lease Lens", pitch: "Reads your lease and flags the traps", slug: "lease-lens", team: ["Maya R.", "Leo S."] },
  { name: "Shelf Life", pitch: "Pantry agent that plans meals before food expires", slug: "shelf-life", team: ["Ines Q.", "Tariq M."] },
];

const SAMPLE_JUDGES = [
  { name: "Priya Natarajan", title: "Staff Engineer" },
  { name: "Marcus Osei", title: "Developer Relations" },
  { name: "Lena Kowalski", title: "Partner, Seed Fund" },
  { name: "Sam Taylor", title: "Founder, Tiny Labs" },
  { name: "Ada Reyes", title: "ML Engineer" },
  { name: "Jonah Weiss", title: "Product Designer" },
];

/** A plausible value for one block of a sample project; undefined leaves it empty. */
function sampleValue(block: SchemaBlock, blocks: SchemaBlock[], p: (typeof SAMPLE_PROJECTS)[number], i: number): ProjectValue | undefined {
  const texts = blocks.filter((b) => b.type === "text" || b.type === "long text");
  const nameBlock = texts.find((b) => b.type === "text");
  const pitchBlock = texts.find((b) => b !== nameBlock);
  if (block === nameBlock) return p.name;
  if (block === pitchBlock) return p.pitch;
  switch (block.type) {
    case "text":
      return undefined;
    case "long text":
      return `${p.name}: ${p.pitch.toLowerCase()}.\n\nWe built it over the weekend with an agent loop that plans, calls tools and checks its own work. Next we want real users and better evals.`;
    case "video url":
      // Leave a couple without a video, so missing inputs show up.
      return i % 5 === 4 ? undefined : `https://youtube.com/watch?v=${p.slug}`;
    case "repo url":
      return `https://github.com/${p.slug}/${p.slug}`;
    case "url":
      return `https://${p.slug}.dev`;
    case "team":
      return p.team;
    case "number":
      return p.team.length;
    default:
      return undefined;
  }
}

export type SampleDataResult = { error: string } | { projects: number; judges: number };

/**
 * Add a dozen sample projects, filled in from the hackathon's schema, and six
 * sample judges if there are none yet.
 */
export async function addSampleData(slug: string): Promise<SampleDataResult> {
  const hackathon = await getHackathon(slug);
  if (!hackathon) return { error: "Hackathon not found, or your session expired." };
  if (hackathon.judgingStartedAt) return { error: "Judging has started. Reset it before adding sample data." };
  const supabase = await createClient();
  const blocks = await listSchemaBlocks(hackathon.id);
  if (blocks.length === 0) return { error: "Add some blocks to the project schema first." };

  let judges = 0;
  const { count } = await supabase
    .from("judges")
    .select("id", { count: "exact", head: true })
    .eq("hackathon_id", hackathon.id);
  if (!count) {
    const { error } = await supabase
      .from("judges")
      .insert(SAMPLE_JUDGES.map((j) => ({ ...j, hackathon_id: hackathon.id })));
    if (error) return { error: error.message };
    judges = SAMPLE_JUDGES.length;
  }

  // One at a time: each save takes the next project number.
  const saved: string[] = [];
  for (const [i, p] of SAMPLE_PROJECTS.entries()) {
    const values: Record<string, ProjectValue> = {};
    for (const b of blocks) {
      const v = sampleValue(b, blocks, p, i);
      if (v !== undefined) values[b.id] = v;
    }
    const id = crypto.randomUUID();
    const { error } = await supabase.rpc("save_project", {
      p_hackathon_id: hackathon.id,
      p_project: { id, values },
    });
    if (error) return { error: error.message };
    saved.push(id);
  }

  // Embed them for the chat's project search. Sample links go nowhere, so skip fetching them.
  after(async () => {
    for (const id of saved) await indexProjectQuietly(hackathon.id, id, { fetchLinks: false, blocks });
  });

  revalidatePath(`/h/${slug}`, "layout");
  return { projects: SAMPLE_PROJECTS.length, judges };
}
