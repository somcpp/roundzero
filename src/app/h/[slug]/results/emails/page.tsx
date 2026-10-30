import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PixelIcon } from "@/components/pixel-icon";
import { Badge, ButtonLink, PageHeader, Panel, cn } from "@/components/ui";
import { WinnerEmail, emailSender } from "@/components/winner-email";
import { getViewableHackathon } from "@/lib/hackathons";
import { getResults } from "@/lib/results";
import { getRewardEmail } from "@/lib/reward-emails";

export default async function EmailsPage({ params, searchParams }: PageProps<"/h/[slug]/results/emails">) {
  const { slug } = await params;
  const { to } = await searchParams;
  const hackathon = await getViewableHackathon(slug);
  if (!hackathon) notFound();

  // One email per project that wins anything, listing every tier it collects.
  const [results, email, h] = await Promise.all([getResults(hackathon), getRewardEmail(hackathon.id), headers()]);
  const recipients = results.winners;
  const selected = recipients.find((r) => r.project.id === to) ?? recipients[0];
  const total = results.ranking.length;
  // The emails link to the public winners page, at the address this app is served from.
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  return (
    <div className="flex flex-col">
      <PageHeader
        eyebrow="Results"
        title="Winner emails"
        hint={`${recipients.length} ${recipients.length === 1 ? "email" : "emails"} · sent from ${emailSender(hackathon, email)}${
          results.state === "final" ? "" : " · preview from the projected ranking"
        }`}
        // They're sent from Results › Winners, once the ranking is final.
        actions={
          results.state === "final" && (
            <ButtonLink href={`/h/${slug}/results`} variant="secondary">
              <PixelIcon name="mail" size={12} /> Send from Winners
            </ButtonLink>
          )
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[300px_1fr]">
        <ul className="flex flex-col gap-1">
          {recipients.map((r) => (
            <li key={r.project.id}>
              <Link
                href={`?to=${r.project.id}`}
                scroll={false}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  r === selected ? "bg-accent-soft text-accent-soft-foreground" : "text-muted hover:bg-surface-secondary",
                )}
              >
                <span className="w-6 font-pixel">{r.rank ?? "—"}</span>
                <span className="flex-1 truncate">{r.project.name}</span>
                <Badge>{r.tiers[0].name}</Badge>
              </Link>
            </li>
          ))}
        </ul>

        {!selected ? (
          <Panel className="flex flex-col items-start gap-3 p-8 text-sm text-muted">
            Nobody wins a reward yet, so there&apos;s nothing to send.
            <ButtonLink href={`/h/${slug}/judging/rewards`} variant="secondary">
              <PixelIcon name="gift" size={12} /> Set up rewards
            </ButtonLink>
          </Panel>
        ) : (
          <Panel className="overflow-hidden">
            <WinnerEmail
              hackathon={hackathon}
              email={email}
              projectName={selected.project.name}
              rank={selected.rank}
              total={total}
              tiers={selected.tiers}
              publicUrl={host ? `${proto}://${host}/w/${hackathon.slug}` : undefined}
            />
          </Panel>
        )}
      </div>
    </div>
  );
}
