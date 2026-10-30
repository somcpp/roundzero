import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";

const ALIASES: Record<string, string> = { sh: "bash", shell: "bash", zsh: "bash", env: "dotenv" };

async function highlight(code: string, lang: string) {
  try {
    return await codeToHtml(code, { lang: ALIASES[lang] ?? lang, theme: "github-light" });
  } catch {
    // Unknown language: render it as plain text rather than failing the page.
    return codeToHtml(code, { lang: "text", theme: "github-light" });
  }
}

/** A fenced code block, highlighted on the server, with a copy button. */
export async function CodeBlock({ code, lang = "text" }: { code: string; lang?: string }) {
  const html = await highlight(code, lang);
  return (
    <div className="group relative my-6 overflow-hidden rounded-xl border-2 border-border bg-surface shadow-block-sm">
      {lang !== "text" && (
        <div className="border-b-2 border-border bg-surface-secondary px-4 py-1.5 font-pixel text-[11px] uppercase tracking-[0.08em] text-muted">
          {lang}
        </div>
      )}
      <div
        className="overflow-x-auto text-[13.5px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:px-4 [&_pre]:py-3.5 [&_code]:font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <CopyButton text={code} className="absolute right-2 bottom-2 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" />
    </div>
  );
}
