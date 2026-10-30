import { PixelIcon } from "@/components/pixel-icon";
import { Badge, Panel } from "@/components/ui";
import { blockTypes, type ProjectValue, type SchemaBlock } from "@/lib/data";
import { hasValue, isLinkType } from "@/lib/project-fields";

/** Every schema block's answer for a project, in order, one row each, then its contact email when given. */
export function Submission({
  blocks,
  values,
  skipBlockId,
  contactEmail,
}: {
  blocks: SchemaBlock[];
  values: Record<string, ProjectValue>;
  /** The block already shown as the heading (the project's name). */
  skipBlockId?: string | null;
  /** Admin only: where results emails go. Left out, the row isn't shown. */
  contactEmail?: string;
}) {
  return (
    <Panel className="divide-y divide-border">
      {blocks
        .filter((b) => b.id !== skipBlockId)
        .map((b) => (
          <BlockValue key={b.id} block={b} value={values[b.id]} />
        ))}
      {contactEmail !== undefined && (
        <div className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[160px_1fr] md:gap-6">
          <span className="flex items-center gap-2 text-muted">
            <PixelIcon name="mail" size={12} />
            Contact email
          </span>
          {contactEmail ? (
            <a href={`mailto:${contactEmail}`} className="min-w-0 break-all underline decoration-border-secondary underline-offset-4 hover:decoration-accent">
              {contactEmail}
            </a>
          ) : (
            <span className="text-muted">None yet, so results emails can&apos;t reach this team.</span>
          )}
        </div>
      )}
    </Panel>
  );
}

function BlockValue({ block: b, value }: { block: SchemaBlock; value: ProjectValue | undefined }) {
  const icon = blockTypes.find((t) => t.type === b.type)?.icon ?? "text";
  return (
    <div className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[160px_1fr] md:gap-6">
      <span className="flex items-center gap-2 text-muted">
        <PixelIcon name={icon} size={12} />
        {b.title}
      </span>
      <div className="min-w-0">{hasValue(value) ? <ValueView block={b} value={value} /> : <span className="text-muted">—</span>}</div>
    </div>
  );
}

function ValueView({ block: b, value }: { block: SchemaBlock; value: ProjectValue }) {
  if (Array.isArray(value)) {
    if (b.type === "team") {
      return (
        <div className="flex flex-wrap gap-1.5">
          {value.map((m) => (
            <Badge key={m}>{m}</Badge>
          ))}
        </div>
      );
    }
    if (b.type === "image") {
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((src) => (
            <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block">
              {/* Entrant-hosted links, not files we can optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="aspect-video w-full rounded-md border-2 border-border object-cover" />
            </a>
          ))}
        </div>
      );
    }
    return (
      <ul className="flex flex-col gap-1">
        {value.map((href) => (
          <li key={href}>
            <ExternalLink href={href} />
          </li>
        ))}
      </ul>
    );
  }
  if (isLinkType(b.type)) return <ExternalLink href={String(value)} />;
  if (b.type === "number") return <span className="font-pixel">{value}</span>;
  return <p className="whitespace-pre-wrap">{value}</p>;
}

function ExternalLink({ href }: { href: string }) {
  const safe = /^https?:\/\//i.test(href);
  const label = href.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
  if (!safe) return <span className="break-all">{href}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1.5 underline decoration-border-secondary underline-offset-4 hover:decoration-accent"
    >
      <span className="truncate">{label}</span>
      <PixelIcon name="external" size={10} />
    </a>
  );
}
