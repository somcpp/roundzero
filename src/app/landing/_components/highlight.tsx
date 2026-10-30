import type { ReactNode } from "react";

const TOKEN_PATTERN = new RegExp(
  [
    String.raw`(?<comment>\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,
    String.raw`(?<string>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` +
      "`(?:[^`\\\\]|\\\\.)*`)",
    String.raw`(?<keyword>\b(?:import|export|from|const|let|var|function|return|async|await|new|try|catch|throw|type|interface|extends|default|if|else|for|of|in|null|undefined|true|false)\b)`,
    String.raw`(?<number>\b\d[\d_.]*\b)`,
    String.raw`(?<component>\b[A-Z][A-Za-z0-9]*\b)`,
    String.raw`(?<call>\b[a-z_$][A-Za-z0-9_$]*(?=\())`,
  ].join("|"),
  "g",
);

const GROUP_CLASS: Record<string, string> = {
  comment: "tok-cm",
  string: "tok-str",
  keyword: "tok-kw",
  number: "tok-num",
  component: "tok-tag",
  call: "tok-fn",
};

/** Tiny dependency-free highlighter for the TS/TSX samples on this page. */
export function highlight(code: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of code.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(code.slice(cursor, index));

    const groups = match.groups ?? {};
    const groupName = Object.keys(groups).find(
      (name) => groups[name] !== undefined,
    );
    nodes.push(
      <span key={key++} className={groupName ? GROUP_CLASS[groupName] : undefined}>
        {match[0]}
      </span>,
    );
    cursor = index + match[0].length;
  }

  if (cursor < code.length) nodes.push(code.slice(cursor));
  return nodes;
}
