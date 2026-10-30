"use client";

import { useActionState, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  Label,
  type Color,
} from "@heroui/react";
import { ConfirmButton } from "@/components/confirm-button";
import { Field, FieldLabel, TextInput } from "@/components/controls";
import { PixelIcon } from "@/components/pixel-icon";
import { useReadOnly } from "@/components/read-only";
import { Eyebrow, LogoMark, PageHeader, Panel, PixelCover, Segments, cn } from "@/components/ui";
import { BRAND_COLORS } from "@/lib/branding";
import type { Hackathon } from "@/lib/data";
import { initials } from "@/lib/format-hackathon";
import { updateHackathon, type HackathonFormState } from "@/lib/hackathon-actions";
import { discardHackathonBanner, hackathonBannerUrl, uploadHackathonBanner } from "@/lib/hackathon-banners";
import { discardHackathonLogo, hackathonLogoUrl, uploadHackathonLogo } from "@/lib/hackathon-logos";

const SWATCHES = Object.values(BRAND_COLORS);

/** The 6-digit hex the server accepts. */
const toHex = (c: Color) => c.toString("hex").toLowerCase();

export function BrandingEditor({ hackathon }: { hackathon: Hackathon }) {
  const [name, setName] = useState(hackathon.name);
  const [logo, setLogo] = useState(hackathon.logo);
  const [color, setColor] = useState(hackathon.color);
  const logoImage = useImage(hackathon.id, hackathon.logoPath, uploadHackathonLogo, discardHackathonLogo);
  const banner = useImage(hackathon.id, hackathon.bannerPath, uploadHackathonBanner, discardHackathonBanner);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const readOnly = useReadOnly();

  const [state, formAction, pending] = useActionState(
    async (prev: HackathonFormState, formData: FormData) => {
      const result = await updateHackathon(hackathon.slug, prev, formData);
      if (result?.saved) {
        logoImage.setSaved((formData.get("logo_path") as string) || null);
        if (formData.has("banner_path")) banner.setSaved((formData.get("banner_path") as string) || null);
      }
      return result;
    },
    undefined,
  );

  const logoUrl = hackathonLogoUrl(logoImage.path);
  const bannerUrl = hackathonBannerUrl(banner.path);
  const mark = logo || initials(name) || "?";
  const uploading = logoImage.uploading || banner.uploading;
  const error = logoImage.error ?? banner.error ?? state?.error;

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col">
        <PageHeader title="Branding" />

        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="logo_path" value={logoImage.path ?? ""} />
          {/* Only sent when it changed, so saves still work before the banner
              column exists (migrations/*_hackathon_banners.sql). */}
          {banner.changed && <input type="hidden" name="banner_path" value={banner.path ?? ""} />}
          <Field label="Hackathon name">
            <TextInput name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <div className="flex flex-col gap-2">
            <FieldLabel>Logo</FieldLabel>
            <div className="flex items-center gap-4">
              <DropZone
                label={logoUrl ? "Replace logo" : "Upload logo"}
                uploading={logoImage.uploading}
                onBrowse={() => logoInput.current?.click()}
                onFile={logoImage.pick}
                className="shrink-0"
              >
                <LogoMark text={mark} src={logoUrl} color={color} size={64} className="rounded-lg" />
              </DropZone>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="secondary" isDisabled={readOnly || logoImage.uploading} onPress={() => logoInput.current?.click()}>
                    <PixelIcon name="image" size={12} />
                    {logoImage.uploading ? "Uploading…" : logoUrl ? "Replace" : "Upload logo"}
                  </Button>
                  {logoUrl && (
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      title="Remove the logo image?"
                      description="Your initials show on the brand color instead once you save."
                      confirmLabel="Remove logo"
                      onConfirm={logoImage.remove}
                    >
                      Remove
                    </ConfirmButton>
                  )}
                </div>
                <span className="text-xs text-muted">PNG, JPEG or SVG. Square logos look best.</span>
              </div>
              <FileInput ref={logoInput} onFile={logoImage.pick} />
            </div>
          </div>

          {!logoUrl && (
            <Field label="Initials" hint="shown until you upload a logo">
              <TextInput
                name="logo"
                value={logo}
                maxLength={3}
                onChange={(e) => setLogo(e.target.value.toUpperCase())}
                placeholder={initials(name) || "AB"}
              />
            </Field>
          )}

          <div className="flex flex-col gap-3">
            <FieldLabel>Primary color</FieldLabel>
            <ColorSwatchPicker
              aria-label="Preset colors"
              value={color}
              onChange={(c) => setColor(toHex(c))}
              size="lg"
              className="grid w-fit grid-cols-5 gap-3"
            >
              {SWATCHES.map((hex) => (
                <ColorSwatchPicker.Item key={hex} color={hex}>
                  <ColorSwatchPicker.Swatch />
                  <ColorSwatchPicker.Indicator />
                </ColorSwatchPicker.Item>
              ))}
            </ColorSwatchPicker>
            <ColorPicker value={color} onChange={(c) => setColor(toHex(c))}>
              <ColorPicker.Trigger>
                <ColorSwatch size="lg" />
                <Label className="text-sm">Custom color</Label>
                <span className="font-mono text-sm text-muted">{color}</span>
              </ColorPicker.Trigger>
              <ColorPicker.Popover className="gap-2">
                <ColorSwatchPicker aria-label="Preset colors" className="justify-center pt-2" size="xs">
                  {SWATCHES.map((hex) => (
                    <ColorSwatchPicker.Item key={hex} color={hex}>
                      <ColorSwatchPicker.Swatch />
                      <ColorSwatchPicker.Indicator />
                    </ColorSwatchPicker.Item>
                  ))}
                </ColorSwatchPicker>
                <ColorArea aria-label="Saturation and brightness" className="max-w-full" colorSpace="hsb" xChannel="saturation" yChannel="brightness">
                  <ColorArea.Thumb />
                </ColorArea>
                <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
                  <Label>Hue</Label>
                  <ColorSlider.Output className="text-muted" />
                  <ColorSlider.Track>
                    <ColorSlider.Thumb />
                  </ColorSlider.Track>
                </ColorSlider>
                <ColorField aria-label="Hex value">
                  <ColorField.Group variant="secondary">
                    <ColorField.Prefix>
                      <ColorSwatch size="xs" />
                    </ColorField.Prefix>
                    <ColorField.Input />
                  </ColorField.Group>
                </ColorField>
              </ColorPicker.Popover>
            </ColorPicker>
          </div>

          <div className="flex flex-col gap-2">
            <FieldLabel>Banner</FieldLabel>
            <DropZone
              label={bannerUrl ? "Replace banner" : "Upload banner"}
              uploading={banner.uploading}
              onBrowse={() => bannerInput.current?.click()}
              onFile={banner.pick}
              className="block w-full"
            >
              <PixelCover seed={name} color={color} image={bannerUrl} className="rounded-lg border border-border">
                <span className="grid aspect-[8/3] place-items-center">
                  {!bannerUrl && (
                    <span className="flex items-center gap-1.5 rounded bg-surface/90 px-2 py-1 text-xs font-medium text-muted">
                      <PixelIcon name="image" size={10} />
                      Drop a wide image or click
                    </span>
                  )}
                </span>
              </PixelCover>
            </DropZone>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" isDisabled={readOnly || banner.uploading} onPress={() => bannerInput.current?.click()}>
                <PixelIcon name="image" size={12} />
                {banner.uploading ? "Uploading…" : bannerUrl ? "Replace" : "Upload banner"}
              </Button>
              {bannerUrl && (
                <ConfirmButton
                  variant="ghost"
                  size="sm"
                  title="Remove the banner?"
                  description="The pixel-art cover shows instead once you save."
                  confirmLabel="Remove banner"
                  onConfirm={banner.remove}
                >
                  Remove
                </ConfirmButton>
              )}
            </div>
            <span className="text-xs text-muted">
              Replaces the pixel-art cover on the hackathon card and public page. Wide images work best: it&apos;s cropped
              to 8:3.
            </span>
            <FileInput ref={bannerInput} onFile={banner.pick} />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
              {error}
            </p>
          )}
          <Button type="submit" isDisabled={readOnly || pending || uploading || !name.trim()}>
            {pending ? "Saving…" : state?.saved ? "Saved" : "Save branding"}
          </Button>
        </form>
      </div>

      <div className="brand flex flex-col gap-6" style={{ "--brand": color } as CSSProperties}>
        <Eyebrow>Live preview</Eyebrow>

        <Panel className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <LogoMark text={mark} src={logoUrl} color={color} size={22} />
            <span className="font-pixel text-sm">{name}</span>
            <span className="ml-auto text-xs text-muted">Project 3 / 22</span>
          </div>
          <div className="grid grid-cols-[1fr_200px]">
            <div className="flex flex-col gap-3 p-5">
              <span className="font-pixel text-lg">Repo Whisperer</span>
              <div className="dither h-24 rounded-md border border-border" />
              <div className="h-2 w-3/4 rounded bg-surface-tertiary" />
              <div className="h-2 w-1/2 rounded bg-surface-tertiary" />
            </div>
            <div className="flex flex-col gap-3 border-l border-border p-5">
              <Eyebrow>Your scores</Eyebrow>
              {[7, 8, 5].map((v, i) => (
                <Segments key={i} value={v} max={10} count={10} />
              ))}
              <span className="mt-2 rounded-md bg-accent py-2 text-center text-xs text-accent-foreground">
                Submit &amp; next →
              </span>
            </div>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PixelCover seed={name} color={color} image={bannerUrl} className="h-36">
            <div className="flex h-36 flex-col items-center justify-center gap-2">
              <LogoMark text={mark} src={logoUrl} color={color} size={36} />
              <span className="rounded bg-surface/90 px-2 py-1 font-pixel text-base">{name} — Winners</span>
            </div>
          </PixelCover>
          <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted">
            <PixelIcon name="globe" size={10} />
            /w/{hackathon.slug}
          </div>
        </Panel>
      </div>
    </div>
  );
}

type Upload = (hackathonId: string, file: File) => Promise<{ path: string } | { error: string }>;

/**
 * An uploaded image (logo or banner): its current path, and the path last
 * saved to the hackathon. Anything else in `path` is a fresh upload, dropped
 * from the bucket if it's replaced or removed before saving.
 */
function useImage(hackathonId: string, initial: string | null, upload: Upload, discard: (path: string) => Promise<void>) {
  const [path, setPath] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const fresh = path && path !== saved ? path : null;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(undefined);
    const result = await upload(hackathonId, file);
    setUploading(false);
    if ("error" in result) return setError(result.error);
    if (fresh) void discard(fresh);
    setPath(result.path);
  };

  const remove = () => {
    if (fresh) void discard(fresh);
    setPath(null);
  };

  return { path, changed: path !== saved, uploading, error, pick, remove, setSaved };
}

/** Opens the file picker on click, and uploads an image dropped onto it. */
function DropZone({
  label,
  uploading,
  onBrowse,
  onFile,
  className,
  children,
}: {
  label: string;
  uploading: boolean;
  onBrowse: () => void;
  onFile: (file: File | undefined) => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const readOnly = useReadOnly();
  return (
    <button
      type="button"
      aria-label={label}
      disabled={readOnly}
      onClick={onBrowse}
      onDragOver={(e) => {
        e.preventDefault();
        if (!readOnly) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!readOnly) void onFile(e.dataTransfer.files[0]);
      }}
      className={cn(
        "relative cursor-pointer rounded-lg ring-offset-2 ring-offset-background transition disabled:cursor-default",
        dragging ? "ring-4 ring-accent" : "enabled:hover:ring-2 enabled:hover:ring-border-secondary",
        className,
      )}
    >
      {children}
      {uploading && (
        <span className="absolute inset-0 grid place-items-center rounded-lg bg-background/70 font-pixel text-xs">…</span>
      )}
    </button>
  );
}

function FileInput({ ref, onFile }: { ref: Ref<HTMLInputElement>; onFile: (file: File | undefined) => Promise<void> }) {
  return (
    <input
      ref={ref}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/svg+xml"
      hidden
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
}
