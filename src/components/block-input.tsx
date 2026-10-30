"use client";

import { Field, TextArea, TextInput } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { blockTypes, type SchemaBlock } from "@/lib/data";
import { valueShape } from "@/lib/project-fields";

const PLACEHOLDER: Partial<Record<SchemaBlock["type"], string>> = {
  url: "https://…",
  "video url": "https://youtube.com/…",
  "repo url": "https://github.com/…",
  image: "One image link per line",
  file: "One file link per line",
  team: "One member per line",
};

/**
 * One project-schema block as a form input: a text area for long text and
 * lists (one entry per line), otherwise a single-line input. Used by the admin
 * project drawer and the public submission form.
 */
export function BlockInput({
  block: b,
  value,
  autoFocus,
  required,
  onChange,
}: {
  block: SchemaBlock;
  value: string;
  autoFocus?: boolean;
  required?: boolean;
  onChange: (v: string) => void;
}) {
  const info = blockTypes.find((t) => t.type === b.type);
  const shape = valueShape(b.type);
  const placeholder = PLACEHOLDER[b.type];
  const label = (
    <span className="flex items-center gap-1.5">
      {info && <PixelIcon name={info.icon} size={10} />}
      {b.title}
      {required && <span className="text-danger">*</span>}
    </span>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <Field label={label} hint={b.expected || undefined}>
        {b.type === "long text" || shape === "list" ? (
          <TextArea
            rows={b.type === "long text" ? 6 : 3}
            value={value}
            autoFocus={autoFocus}
            required={required}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <TextInput
            type={shape === "number" ? "number" : "text"}
            inputMode={b.type.endsWith("url") ? "url" : undefined}
            value={value}
            autoFocus={autoFocus}
            required={required}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </Field>
      {b.description && <span className="text-xs text-muted">{b.description}</span>}
    </div>
  );
}
