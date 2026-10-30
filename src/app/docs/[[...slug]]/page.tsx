import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocsToc } from "@/components/docs/docs-toc";
import { PixelIcon } from "@/components/pixel-icon";
import { Eyebrow } from "@/components/ui";
import { brand } from "@/lib/branding";
import { allDocSlugs, docHref, findDoc } from "@/lib/docs";

// Every page is known at build time; anything else under /docs is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return allDocSlugs().map((slug) => ({ slug: slug ? slug.split("/") : [] }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[[...slug]]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = findDoc(slug?.join("/") ?? "");
  if (!doc) return {};
  return {
    title: doc.page.slug ? `${doc.page.title} · ${brand.name} Docs` : `${brand.name} Docs`,
    description: doc.page.description,
  };
}

export default async function DocPage({ params }: PageProps<"/docs/[[...slug]]">) {
  const { slug } = await params;
  const doc = findDoc(slug?.join("/") ?? "");
  if (!doc) notFound();
  const { page, prev, next } = doc;
  const { default: Content } = await page.load();

  return (
    <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-12">
      <article className="min-w-0 max-w-3xl py-8 sm:py-10">
        <Eyebrow>{page.section}</Eyebrow>
        <h1 className="mt-2 text-3xl leading-tight sm:text-4xl">{page.title}</h1>
        <p className="mt-3 text-lg leading-8 text-muted">{page.description}</p>

        <div id="doc-content" className="mt-8">
          <Content />
        </div>

        <nav aria-label="Pagination" className="mt-14 grid gap-3 border-t-2 border-dashed border-border pt-8 sm:grid-cols-2">
          {prev ? <PagerLink href={docHref(prev.slug)} label="Previous" title={prev.title} /> : <span />}
          {next && <PagerLink href={docHref(next.slug)} label="Next" title={next.title} align="end" />}
        </nav>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-18 max-h-[calc(100dvh-4.5rem)] overflow-y-auto py-10">
          <DocsToc />
        </div>
      </aside>
    </div>
  );
}

function PagerLink({ href, label, title, align }: { href: string; label: string; title: string; align?: "end" }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-1 rounded-xl border-2 border-border bg-surface px-4 py-3 shadow-block-sm transition hover:border-accent/50 ${align === "end" ? "items-end text-right" : ""}`}
    >
      <span className="flex items-center gap-1.5 font-pixel text-xs uppercase tracking-[0.08em] text-muted">
        {align !== "end" && <PixelIcon name="arrow-left" size={10} />}
        {label}
        {align === "end" && <PixelIcon name="arrow-right" size={10} />}
      </span>
      <span className="font-semibold group-hover:text-accent">{title}</span>
    </Link>
  );
}
