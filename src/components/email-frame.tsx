"use client";

import { createElement, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { cn } from "./ui";

/** How tall the email in a frame is (the body, since the document never measures smaller than the frame). */
const emailHeight = (frame: HTMLIFrameElement | null) => {
  const body = frame?.contentDocument?.body;
  return body ? Math.ceil(body.getBoundingClientRect().height) : null;
};

/**
 * A React Email template (src/emails) rendered in the browser and shown in a
 * sandboxed iframe: the exact HTML that gets sent. React Email's render needs
 * react-dom/server, which server components can't use, so previews render here.
 */
export function EmailFrame<P extends object>({
  template,
  props,
  width = "desktop",
  title,
  className,
}: {
  template: ComponentType<P>;
  /** Plain data (it's compared by value, so typing re-renders only once it changes). */
  props: P;
  width?: "desktop" | "phone";
  title: string;
  className?: string;
}) {
  const snapshot = JSON.stringify(props);
  const stable = useMemo(() => JSON.parse(snapshot) as P, [snapshot]);
  const [html, setHtml] = useState<string | null>(null);
  const [height, setHeight] = useState(640);
  const frame = useRef<HTMLIFrameElement>(null);
  const fit = () => setHeight((h) => emailHeight(frame.current) ?? h);

  useEffect(() => {
    let live = true;
    // Wait for a pause in typing; render is loaded on demand so it stays out of the page bundle.
    const timer = setTimeout(async () => {
      const { render } = await import("react-email");
      const out = await render(createElement(template, stable));
      // Links open in a new tab rather than inside the preview.
      if (live) setHtml(out.replace(/<head>/i, '<head><base target="_blank">'));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [template, stable]);

  // The email reflows at phone width, so measure again once the frame resizes.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setHeight((h) => emailHeight(frame.current) ?? h));
    return () => cancelAnimationFrame(raf);
  }, [width]);

  return (
    <div className={cn("flex justify-center bg-[#f7f7f9]", className)}>
      {html === null ? (
        <div className="grid h-[640px] w-full place-items-center font-pixel text-xs text-muted">Rendering…</div>
      ) : (
        <iframe
          ref={frame}
          title={title}
          srcDoc={html}
          // No scripts; same origin only so the frame can be measured to fit its email.
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          onLoad={fit}
          className="block border-0"
          style={{ width: width === "phone" ? 375 : "100%", height }}
        />
      )}
    </div>
  );
}
