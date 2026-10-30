import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { SiteHeader } from "@/components/site-header";
import { docsNav } from "@/lib/docs";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <>
      <SiteHeader section="docs" />
      <div className="mx-auto grid w-full max-w-7xl flex-1 content-start px-4 sm:px-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <DocsSidebar nav={docsNav()} />
        {children}
      </div>
    </>
  );
}
