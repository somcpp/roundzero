"use client";

import { Field, TextInput } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { CONTACT_FIELD } from "@/lib/intake-shape";

/**
 * Every project's fixed contact email, shown after the schema's fields on the
 * public submission form and the admin project drawer.
 */
export function ContactEmailInput({
  value,
  required,
  onChange,
}: {
  value: string;
  required?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Field
        label={
          <span className="flex items-center gap-1.5">
            <PixelIcon name="mail" size={10} />
            {CONTACT_FIELD.title}
            {required && <span className="text-danger">*</span>}
          </span>
        }
      >
        <TextInput
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          required={required}
          placeholder="team@example.com"
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
      <span className="text-xs text-muted">{CONTACT_FIELD.description}</span>
    </div>
  );
}
