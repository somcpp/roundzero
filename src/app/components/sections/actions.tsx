"use client";

import type { ReactNode } from "react";
import { Section, Demo } from "../demo";
import { PixelIcon } from "@/components/pixel-icon";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Chip,
  CloseButton,
  EmptyState,
  Kbd,
  Link,
  ScrollShadow,
  Separator,
  Skeleton,
  Spinner,
  Surface,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  Typography,
} from "@heroui/react";

export const id = "actions";
export const title = "Actions & display";
export const components = [
  "Button",
  "ButtonGroup",
  "ToggleButton",
  "ToggleButtonGroup",
  "CloseButton",
  "Link",
  "Chip",
  "Badge",
  "Avatar",
  "AvatarGroup",
  "Kbd",
  "Spinner",
  "Skeleton",
  "Separator",
  "Surface",
  "Card",
  "Typography",
  "EmptyState",
  "Tooltip",
  "Toolbar",
  "ScrollShadow",
];

/* ---------------------------------------------------------------- helpers */

const BUTTON_VARIANTS = ["primary", "secondary", "tertiary", "outline", "ghost", "danger", "danger-soft"] as const;
const GROUP_VARIANTS = ["primary", "secondary", "tertiary", "outline", "ghost", "danger"] as const;
const SIZES = ["sm", "md", "lg"] as const;
const COLORS = ["default", "accent", "success", "warning", "danger"] as const;
const CHIP_VARIANTS = ["primary", "secondary", "tertiary", "soft"] as const;
const BADGE_VARIANTS = ["primary", "secondary", "soft"] as const;
const PLACEMENTS = ["top-right", "top-left", "bottom-right", "bottom-left"] as const;
const SURFACE_VARIANTS = ["default", "secondary", "tertiary", "transparent"] as const;

const AVATAR = (c: string) => `https://heroui-assets.nyc3.cdn.digitaloceanspaces.com/avatars/${c}.jpg`;
const JUDGES = [
  { name: "Ada Park", img: AVATAR("blue") },
  { name: "Kofi Mensah", img: AVATAR("green") },
  { name: "Lena Ortiz", img: AVATAR("purple") },
  { name: "Sam Rivera", img: AVATAR("orange") },
  { name: "Mia Chen", img: AVATAR("red") },
  { name: "Noah Kim", img: "" },
];
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("");

/** A labelled row: tiny muted label on the left, specimens on the right. */
function Row({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="w-24 shrink-0 font-mono text-xs text-muted">{label}</span>
      <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>{children}</div>
    </div>
  );
}

/** A specimen with a caption underneath. */
function Captioned({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {children}
      <span className="font-mono text-xs text-muted">{caption}</span>
    </div>
  );
}

function JudgeAvatar({ name, img }: { name: string; img: string }) {
  return (
    <Avatar>
      {img && <Avatar.Image alt={name} src={img} />}
      <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
    </Avatar>
  );
}

/* ---------------------------------------------------------------- section */

export default function ActionsSection() {
  return (
    <Section id={id} title={title}>
      {/* Button ------------------------------------------------------------ */}
      <Demo name="Button" hint="variants · sizes · icon · icon-only · pending · disabled · full width" className="flex-col">
        <Row label="variant">
          {BUTTON_VARIANTS.map((v) => (
            <Button key={v} variant={v}>
              {v === "danger" || v === "danger-soft" ? "Disqualify" : "Submit score"}
            </Button>
          ))}
        </Row>
        <Row label="size">
          {SIZES.map((s) => (
            <Button key={s} size={s}>
              Submit ({s})
            </Button>
          ))}
        </Row>
        <Row label="with icon">
          <Button>
            <PixelIcon name="plus" />
            Add criterion
          </Button>
          <Button variant="secondary">
            <PixelIcon name="users" />
            Invite judges
          </Button>
          <Button variant="tertiary">
            Next project
            <PixelIcon name="arrow-right" />
          </Button>
        </Row>
        <Row label="isIconOnly">
          {SIZES.map((s) => (
            <Button key={s} isIconOnly size={s} variant="secondary" aria-label="Settings">
              <PixelIcon name="gear" />
            </Button>
          ))}
          <Button isIconOnly variant="ghost" aria-label="Search">
            <PixelIcon name="search" />
          </Button>
          <Button isIconOnly variant="danger" aria-label="Remove">
            <PixelIcon name="x" />
          </Button>
        </Row>
        <Row label="isPending">
          {(["primary", "secondary", "tertiary"] as const).map((v) => (
            <Button key={v} isPending variant={v}>
              {({ isPending }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  Scoring…
                </>
              )}
            </Button>
          ))}
        </Row>
        <Row label="isDisabled">
          {BUTTON_VARIANTS.map((v) => (
            <Button key={v} isDisabled variant={v}>
              Locked
            </Button>
          ))}
        </Row>
        <Row label="fullWidth" className="w-80">
          <Button fullWidth>Publish results</Button>
        </Row>
      </Demo>

      {/* ButtonGroup ------------------------------------------------------- */}
      <Demo name="ButtonGroup" hint="variants · sizes · orientation · disabled · full width" className="flex-col">
        {GROUP_VARIANTS.map((v) => (
          <Row key={v} label={v}>
            <ButtonGroup variant={v}>
              <Button>Draft</Button>
              <Button>
                <ButtonGroup.Separator />
                Review
              </Button>
              <Button>
                <ButtonGroup.Separator />
                Final
              </Button>
            </ButtonGroup>
          </Row>
        ))}
        <Row label="size">
          {SIZES.map((s) => (
            <ButtonGroup key={s} size={s} variant="secondary">
              <Button>{s}</Button>
              <Button>
                <ButtonGroup.Separator />
                Prev
              </Button>
              <Button>
                <ButtonGroup.Separator />
                Next
              </Button>
            </ButtonGroup>
          ))}
        </Row>
        <Row label="orientation">
          <ButtonGroup variant="tertiary">
            <Button isIconOnly aria-label="Grid view">
              <PixelIcon name="grid" />
            </Button>
            <Button isIconOnly aria-label="List view">
              <ButtonGroup.Separator />
              <PixelIcon name="list" />
            </Button>
          </ButtonGroup>
          <ButtonGroup orientation="vertical" variant="tertiary">
            <Button isIconOnly aria-label="Move up">
              <PixelIcon name="arrow-up" />
            </Button>
            <Button isIconOnly aria-label="Move down">
              <ButtonGroup.Separator />
              <PixelIcon name="arrow-down" />
            </Button>
          </ButtonGroup>
        </Row>
        <Row label="isDisabled">
          <ButtonGroup isDisabled variant="secondary">
            <Button>Approve</Button>
            <Button>
              <ButtonGroup.Separator />
              Reject
            </Button>
          </ButtonGroup>
        </Row>
        <Row label="fullWidth" className="w-96">
          <ButtonGroup fullWidth variant="outline">
            <Button>Round 1</Button>
            <Button>
              <ButtonGroup.Separator />
              Round 2
            </Button>
            <Button>
              <ButtonGroup.Separator />
              Finals
            </Button>
          </ButtonGroup>
        </Row>
      </Demo>

      {/* ToggleButton ------------------------------------------------------ */}
      <Demo name="ToggleButton" hint="variants · sizes · selected · icon-only · disabled" className="flex-col">
        <Row label="default">
          <ToggleButton>
            <PixelIcon name="flag" />
            Flag
          </ToggleButton>
          <ToggleButton defaultSelected>
            <PixelIcon name="flag" />
            Flagged
          </ToggleButton>
        </Row>
        <Row label="ghost">
          <ToggleButton variant="ghost">
            <PixelIcon name="eye" />
            Watch
          </ToggleButton>
          <ToggleButton variant="ghost" defaultSelected>
            <PixelIcon name="eye" />
            Watching
          </ToggleButton>
        </Row>
        <Row label="size">
          {SIZES.map((s) => (
            <ToggleButton key={s} size={s}>
              Shortlist ({s})
            </ToggleButton>
          ))}
        </Row>
        <Row label="isIconOnly">
          {SIZES.map((s) => (
            <ToggleButton key={s} isIconOnly size={s} aria-label="Favourite">
              <PixelIcon name="trophy" />
            </ToggleButton>
          ))}
          <ToggleButton isIconOnly defaultSelected aria-label="Favourite">
            <PixelIcon name="trophy" />
          </ToggleButton>
          <ToggleButton isIconOnly variant="ghost" aria-label="Favourite">
            <PixelIcon name="trophy" />
          </ToggleButton>
        </Row>
        <Row label="isDisabled">
          <ToggleButton isDisabled>Flag</ToggleButton>
          <ToggleButton isDisabled defaultSelected>
            Flagged
          </ToggleButton>
        </Row>
      </Demo>

      {/* ToggleButtonGroup ------------------------------------------------- */}
      <Demo name="ToggleButtonGroup" hint="single · multiple · sizes · detached · vertical · disabled" className="flex-col">
        <Row label="single">
          <ToggleButtonGroup aria-label="Status filter" selectionMode="single" defaultSelectedKeys={["all"]}>
            <ToggleButton id="all">All</ToggleButton>
            <ToggleButton id="scored">
              <ToggleButtonGroup.Separator />
              Scored
            </ToggleButton>
            <ToggleButton id="pending">
              <ToggleButtonGroup.Separator />
              Pending
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="multiple">
          <ToggleButtonGroup aria-label="Tracks" selectionMode="multiple" defaultSelectedKeys={["ai", "web"]}>
            <ToggleButton id="ai">AI</ToggleButton>
            <ToggleButton id="web">
              <ToggleButtonGroup.Separator />
              Web
            </ToggleButton>
            <ToggleButton id="hw">
              <ToggleButtonGroup.Separator />
              Hardware
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="size">
          {SIZES.map((s) => (
            <ToggleButtonGroup key={s} aria-label="View" size={s} selectionMode="single" defaultSelectedKeys={["grid"]}>
              <ToggleButton id="grid" isIconOnly aria-label="Grid">
                <PixelIcon name="grid" />
              </ToggleButton>
              <ToggleButton id="list" isIconOnly aria-label="List">
                <ToggleButtonGroup.Separator />
                <PixelIcon name="list" />
              </ToggleButton>
            </ToggleButtonGroup>
          ))}
        </Row>
        <Row label="isDetached">
          <ToggleButtonGroup aria-label="Tracks" isDetached selectionMode="multiple" defaultSelectedKeys={["ai"]}>
            <ToggleButton id="ai">AI</ToggleButton>
            <ToggleButton id="web">Web</ToggleButton>
            <ToggleButton id="hw">Hardware</ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="vertical">
          <ToggleButtonGroup aria-label="Sort" orientation="vertical" selectionMode="single" defaultSelectedKeys={["score"]}>
            <ToggleButton id="score">By score</ToggleButton>
            <ToggleButton id="name">
              <ToggleButtonGroup.Separator />
              By name
            </ToggleButton>
            <ToggleButton id="time">
              <ToggleButtonGroup.Separator />
              By time
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="isDisabled">
          <ToggleButtonGroup aria-label="Status" isDisabled selectionMode="single" defaultSelectedKeys={["open"]}>
            <ToggleButton id="open">Open</ToggleButton>
            <ToggleButton id="closed">
              <ToggleButtonGroup.Separator />
              Closed
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
        <Row label="fullWidth" className="w-96">
          <ToggleButtonGroup aria-label="Round" fullWidth selectionMode="single" defaultSelectedKeys={["r1"]}>
            <ToggleButton id="r1">Round 1</ToggleButton>
            <ToggleButton id="r2">
              <ToggleButtonGroup.Separator />
              Round 2
            </ToggleButton>
          </ToggleButtonGroup>
        </Row>
      </Demo>

      {/* CloseButton ------------------------------------------------------- */}
      <Demo name="CloseButton" hint="default · custom icon · disabled">
        <Captioned caption="default">
          <CloseButton aria-label="Dismiss" />
        </Captioned>
        <Captioned caption="custom icon">
          <CloseButton aria-label="Remove judge">
            <PixelIcon name="x" size={12} />
          </CloseButton>
        </Captioned>
        <Captioned caption="isDisabled">
          <CloseButton aria-label="Dismiss" isDisabled />
        </Captioned>
        <Captioned caption="in context">
          <div className="flex items-center gap-2 rounded-lg border border-border py-1 pr-1 pl-3 text-sm">
            New submission from Team Nova
            <CloseButton aria-label="Dismiss" />
          </div>
        </Captioned>
      </Demo>

      {/* Link -------------------------------------------------------------- */}
      <Demo name="Link" hint="no variants · icon end/start · custom icon · underline · disabled" className="flex-col">
        <Row label="default">
          <Link href="#">View rubric</Link>
          <Link href="#">
            Open demo
            <Link.Icon />
          </Link>
          <Link className="gap-1" href="#">
            <Link.Icon />
            Icon at start
          </Link>
          <Link href="#">
            Repository
            <Link.Icon className="size-3">
              <PixelIcon name="branch" size={12} />
            </Link.Icon>
          </Link>
        </Row>
        <Row label="decoration">
          <Link className="underline" href="#">
            Always underlined
          </Link>
          <Link className="no-underline" href="#">
            Never underlined
          </Link>
          <Link className="underline decoration-dashed underline-offset-4" href="#">
            Dashed
          </Link>
        </Row>
        <Row label="isDisabled">
          <Link isDisabled href="#">
            Results (locked)
            <Link.Icon />
          </Link>
        </Row>
        <Row label="inline">
          <p className="text-sm">
            Scores are final once the <Link href="#">judging window</Link> closes.
          </p>
        </Row>
      </Demo>

      {/* Chip -------------------------------------------------------------- */}
      <Demo name="Chip" hint="variant × color · sizes · icons" className="flex-col">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="w-24 shrink-0" />
            {COLORS.map((c) => (
              <span key={c} className="w-24 shrink-0 text-center font-mono text-xs text-muted">
                {c}
              </span>
            ))}
          </div>
          {CHIP_VARIANTS.map((v) => (
            <div key={v} className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-xs text-muted">{v}</span>
              {COLORS.map((c) => (
                <span key={c} className="flex w-24 shrink-0 justify-center">
                  <Chip color={c} variant={v}>
                    Finalist
                  </Chip>
                </span>
              ))}
            </div>
          ))}
        </div>
        <Separator />
        <Row label="size">
          {SIZES.map((s) => (
            <Chip key={s} size={s} color="accent">
              AI track ({s})
            </Chip>
          ))}
        </Row>
        <Row label="with icons">
          <Chip color="success">
            <PixelIcon name="check" size={10} />
            <Chip.Label>Scored</Chip.Label>
          </Chip>
          <Chip color="warning">
            <PixelIcon name="dot" size={10} />
            <Chip.Label>Pending</Chip.Label>
          </Chip>
          <Chip color="danger">
            <PixelIcon name="x" size={10} />
            <Chip.Label>Disqualified</Chip.Label>
          </Chip>
          <Chip>
            <PixelIcon name="tag" size={10} />
            <Chip.Label>Web</Chip.Label>
          </Chip>
        </Row>
      </Demo>

      {/* Badge ------------------------------------------------------------- */}
      <Demo name="Badge" hint="variant × color · sizes · placements · dot · content" className="flex-col">
        {BADGE_VARIANTS.map((v) => (
          <Row key={v} label={v} className="gap-6">
            {COLORS.map((c) => (
              <Badge.Anchor key={c}>
                <Avatar color={c}>
                  <Avatar.Fallback>{c.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                </Avatar>
                <Badge color={c} size="sm" variant={v}>
                  3
                </Badge>
              </Badge.Anchor>
            ))}
          </Row>
        ))}
        <Row label="size" className="gap-6">
          {SIZES.map((s) => (
            <Badge.Anchor key={s}>
              <Avatar size={s}>
                <Avatar.Image alt="Ada Park" src={AVATAR("blue")} />
                <Avatar.Fallback>AP</Avatar.Fallback>
              </Avatar>
              <Badge color="danger" size={s}>
                5
              </Badge>
            </Badge.Anchor>
          ))}
        </Row>
        <Row label="placement" className="gap-6">
          {PLACEMENTS.map((p) => (
            <Captioned key={p} caption={p}>
              <Badge.Anchor>
                <Avatar>
                  <Avatar.Image alt="Kofi Mensah" src={AVATAR("green")} />
                  <Avatar.Fallback>KM</Avatar.Fallback>
                </Avatar>
                <Badge color="accent" placement={p} size="sm" />
              </Badge.Anchor>
            </Captioned>
          ))}
        </Row>
        <Row label="content" className="gap-6">
          <Badge.Anchor>
            <Button isIconOnly variant="secondary" aria-label="Messages">
              <PixelIcon name="chat" />
            </Button>
            <Badge color="danger" size="sm">
              12
            </Badge>
          </Badge.Anchor>
          <Badge.Anchor>
            <Button isIconOnly variant="secondary" aria-label="Inbox">
              <PixelIcon name="mail" />
            </Button>
            <Badge color="danger" size="sm">
              99+
            </Badge>
          </Badge.Anchor>
          <Badge.Anchor>
            <Button variant="secondary">Submissions</Button>
            <Badge color="accent" size="sm">
              New
            </Badge>
          </Badge.Anchor>
          <Badge.Anchor>
            <Avatar>
              <Avatar.Image alt="Lena Ortiz" src={AVATAR("purple")} />
              <Avatar.Fallback>LO</Avatar.Fallback>
            </Avatar>
            <Badge color="success" placement="bottom-right" size="sm" />
          </Badge.Anchor>
        </Row>
      </Demo>

      {/* Avatar ------------------------------------------------------------ */}
      <Demo name="Avatar" hint="sizes · colors · variants · image / text / icon fallback" className="flex-col">
        <Row label="size">
          {SIZES.map((s) => (
            <Avatar key={s} size={s}>
              <Avatar.Image alt="Ada Park" src={AVATAR("blue")} />
              <Avatar.Fallback>AP</Avatar.Fallback>
            </Avatar>
          ))}
        </Row>
        <Row label="color">
          {COLORS.map((c) => (
            <Avatar key={c} color={c}>
              <Avatar.Fallback>{c.slice(0, 2).toUpperCase()}</Avatar.Fallback>
            </Avatar>
          ))}
        </Row>
        <Row label="variant=soft">
          {COLORS.map((c) => (
            <Avatar key={c} color={c} variant="soft">
              <Avatar.Fallback>{c.slice(0, 2).toUpperCase()}</Avatar.Fallback>
            </Avatar>
          ))}
        </Row>
        <Row label="icon fallback">
          {COLORS.map((c) => (
            <Avatar key={c} color={c}>
              <Avatar.Fallback>
                <PixelIcon name="user" />
              </Avatar.Fallback>
            </Avatar>
          ))}
        </Row>
        <Row label="image">
          {["blue", "green", "purple", "orange", "red"].map((c) => (
            <Avatar key={c}>
              <Avatar.Image alt={`Judge ${c}`} src={AVATAR(c)} />
              <Avatar.Fallback>J</Avatar.Fallback>
            </Avatar>
          ))}
          <Avatar>
            <Avatar.Image alt="Broken image" src="https://invalid.example/nope.jpg" />
            <Avatar.Fallback delayMs={400}>NA</Avatar.Fallback>
          </Avatar>
        </Row>
      </Demo>

      {/* AvatarGroup ------------------------------------------------------- */}
      <Demo name="AvatarGroup" hint="max · count · sizes · overlap · grid · color/variant" className="flex-col">
        <Row label="default">
          <AvatarGroup>
            {JUDGES.slice(0, 4).map((j) => (
              <JudgeAvatar key={j.name} {...j} />
            ))}
          </AvatarGroup>
        </Row>
        <Row label="max={3}">
          <AvatarGroup max={3}>
            {JUDGES.map((j) => (
              <JudgeAvatar key={j.name} {...j} />
            ))}
          </AvatarGroup>
        </Row>
        <Row label="Count">
          <AvatarGroup>
            {JUDGES.slice(0, 3).map((j) => (
              <JudgeAvatar key={j.name} {...j} />
            ))}
            <AvatarGroup.Count>+9</AvatarGroup.Count>
          </AvatarGroup>
        </Row>
        <Row label="size">
          {SIZES.map((s) => (
            <AvatarGroup key={s} size={s}>
              {JUDGES.slice(0, 4).map((j) => (
                <JudgeAvatar key={j.name} {...j} />
              ))}
            </AvatarGroup>
          ))}
        </Row>
        <Row label="overlap">
          <Captioned caption="clip">
            <AvatarGroup overlap="clip">
              {JUDGES.slice(0, 4).map((j) => (
                <JudgeAvatar key={j.name} {...j} />
              ))}
            </AvatarGroup>
          </Captioned>
          <Captioned caption="ring">
            <AvatarGroup overlap="ring">
              {JUDGES.slice(0, 4).map((j) => (
                <JudgeAvatar key={j.name} {...j} />
              ))}
            </AvatarGroup>
          </Captioned>
        </Row>
        <Row label="isGrid">
          <AvatarGroup isGrid size="sm">
            {JUDGES.map((j) => (
              <JudgeAvatar key={j.name} {...j} />
            ))}
          </AvatarGroup>
        </Row>
        <Row label="color · soft">
          <AvatarGroup color="accent" variant="soft" max={3}>
            {JUDGES.map((j) => (
              <Avatar key={j.name}>
                <Avatar.Fallback>{initials(j.name)}</Avatar.Fallback>
              </Avatar>
            ))}
          </AvatarGroup>
        </Row>
      </Demo>

      {/* Kbd --------------------------------------------------------------- */}
      <Demo name="Kbd" hint="default · light · modifiers · named keys" className="flex-col">
        <Row label="default">
          <Kbd>
            <Kbd.Abbr keyValue="command" />
            <Kbd.Content>K</Kbd.Content>
          </Kbd>
          <Kbd>
            <Kbd.Abbr keyValue="command" />
            <Kbd.Abbr keyValue="shift" />
            <Kbd.Content>S</Kbd.Content>
          </Kbd>
          <Kbd>
            <Kbd.Abbr keyValue="enter" />
          </Kbd>
          <Kbd>
            <Kbd.Content>J</Kbd.Content>
          </Kbd>
        </Row>
        <Row label="light">
          <Kbd variant="light">
            <Kbd.Abbr keyValue="command" />
            <Kbd.Content>K</Kbd.Content>
          </Kbd>
          <Kbd variant="light">
            <Kbd.Abbr keyValue="ctrl" />
            <Kbd.Abbr keyValue="option" />
            <Kbd.Content>N</Kbd.Content>
          </Kbd>
          <Kbd variant="light">
            <Kbd.Abbr keyValue="escape" />
          </Kbd>
        </Row>
        <Row label="nav keys">
          {(["up", "down", "left", "right", "tab", "space", "delete"] as const).map((k) => (
            <Kbd key={k}>
              <Kbd.Abbr keyValue={k} />
            </Kbd>
          ))}
        </Row>
        <Row label="in text">
          <p className="text-sm text-muted">
            Press{" "}
            <Kbd>
              <Kbd.Content>J</Kbd.Content>
            </Kbd>{" "}
            /{" "}
            <Kbd>
              <Kbd.Content>K</Kbd.Content>
            </Kbd>{" "}
            to move between submissions.
          </p>
        </Row>
      </Demo>

      {/* Spinner ----------------------------------------------------------- */}
      <Demo name="Spinner" hint="colors · sizes" className="flex-col">
        <Row label="color" className="gap-6">
          {(["accent", "current", "success", "warning", "danger"] as const).map((c) => (
            <Captioned key={c} caption={c}>
              <Spinner color={c} />
            </Captioned>
          ))}
        </Row>
        <Row label="size" className="gap-6">
          {(["sm", "md", "lg", "xl"] as const).map((s) => (
            <Captioned key={s} caption={s}>
              <Spinner size={s} />
            </Captioned>
          ))}
        </Row>
      </Demo>

      {/* Skeleton ---------------------------------------------------------- */}
      <Demo name="Skeleton" hint="animationType: shimmer · pulse · none · single shimmer">
        {(["shimmer", "pulse", "none"] as const).map((a) => (
          <div key={a} className="flex w-56 flex-col gap-2">
            <span className="font-mono text-xs text-muted">{a}</span>
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <Skeleton animationType={a} className="size-10 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton animationType={a} className="h-3 w-4/5 rounded" />
                  <Skeleton animationType={a} className="h-3 w-3/5 rounded" />
                </div>
              </div>
              <Skeleton animationType={a} className="h-20 rounded-lg" />
            </div>
          </div>
        ))}
        <div className="flex w-56 flex-col gap-2">
          <span className="font-mono text-xs text-muted">parent .skeleton--shimmer</span>
          <div className="skeleton--shimmer relative grid grid-cols-3 gap-3 overflow-hidden rounded-xl">
            <Skeleton animationType="none" className="h-24 rounded-lg" />
            <Skeleton animationType="none" className="h-24 rounded-lg" />
            <Skeleton animationType="none" className="h-24 rounded-lg" />
          </div>
        </div>
      </Demo>

      {/* Separator --------------------------------------------------------- */}
      <Demo name="Separator" hint="variants · orientation · on surfaces">
        <div className="flex w-64 flex-col gap-3">
          {(["default", "secondary", "tertiary"] as const).map((v) => (
            <div key={v} className="flex flex-col gap-1.5">
              <span className="font-mono text-xs text-muted">{v}</span>
              <Separator variant={v} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs text-muted">vertical</span>
          <div className="flex h-5 items-center gap-4 text-sm">
            <span>Rubric</span>
            <Separator orientation="vertical" />
            <span>Judges</span>
            <Separator orientation="vertical" />
            <span>Results</span>
          </div>
        </div>
        {(["default", "secondary", "tertiary"] as const).map((v) => (
          <Surface key={v} variant={v} className="flex w-44 flex-col gap-2 rounded-xl p-4">
            <span className="text-sm font-medium">Surface {v}</span>
            <Separator variant={v} />
            <span className="text-xs text-muted">Separator {v}</span>
          </Surface>
        ))}
      </Demo>

      {/* Surface ----------------------------------------------------------- */}
      <Demo name="Surface" hint="default · secondary · tertiary · transparent">
        {SURFACE_VARIANTS.map((v) => (
          <Surface
            key={v}
            variant={v}
            className={`flex w-52 flex-col gap-1 rounded-2xl p-5 ${v === "transparent" ? "border border-border" : ""}`}
          >
            <span className="font-mono text-xs text-muted">{v}</span>
            <span className="text-sm font-medium">Team Nova</span>
            <span className="text-xs text-muted">Submitted 2h ago</span>
          </Surface>
        ))}
      </Demo>

      {/* Card -------------------------------------------------------------- */}
      <Demo name="Card" hint="variants · Header/Title/Description/Content/Footer">
        {SURFACE_VARIANTS.map((v) => (
          <Card key={v} variant={v} className="w-64">
            <Card.Header>
              <Card.Title>Team Nova</Card.Title>
              <Card.Description>
                <span className="font-mono">variant=&quot;{v}&quot;</span>
              </Card.Description>
            </Card.Header>
            <Card.Content>
              <p className="text-sm">Voice-first triage agent for ER intake. AI track.</p>
            </Card.Content>
            <Card.Footer className="flex gap-2">
              <Button size="sm">Score</Button>
              <Button size="sm" variant="tertiary">
                Details
              </Button>
            </Card.Footer>
          </Card>
        ))}
        <Card className="w-full items-stretch md:flex-row">
          <div className="grid h-28 w-full shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent md:w-28">
            <PixelIcon name="trophy" size={40} />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <Card.Header className="gap-1">
              <Card.Title className="pe-8">Grand prize: $5,000</Card.Title>
              <Card.Description>Horizontal layout with a dismiss button and footer actions.</Card.Description>
              <CloseButton aria-label="Dismiss" className="absolute end-3 top-3" />
            </Card.Header>
            <Card.Footer className="mt-auto flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Judging closes Oct 10</span>
              <Button size="sm">View rubric</Button>
            </Card.Footer>
          </div>
        </Card>
      </Demo>

      {/* Typography -------------------------------------------------------- */}
      <Demo name="Typography" hint="type scale · color · weight · align · truncate · primitives" className="flex-col">
        <div className="flex w-full flex-col divide-y divide-border">
          {(["h1", "h2", "h3", "h4", "h5", "h6", "body", "body-sm", "body-xs", "code"] as const).map((t) => (
            <div key={t} className="grid grid-cols-[6rem_1fr] items-center gap-4 py-2">
              <span className="font-mono text-xs text-muted">{t}</span>
              <Typography type={t}>{t === "code" ? "pnpm judge --round finals" : "Hackathon judging, simplified"}</Typography>
            </div>
          ))}
        </div>
        <Row label="color">
          <Typography type="body-sm">default</Typography>
          <Typography type="body-sm" color="muted">
            muted
          </Typography>
        </Row>
        <Row label="weight">
          {(["normal", "medium", "semibold", "bold"] as const).map((w) => (
            <Typography key={w} type="body-sm" weight={w}>
              {w}
            </Typography>
          ))}
        </Row>
        <Row label="align" className="w-80 flex-col items-stretch gap-1">
          {(["start", "center", "end"] as const).map((a) => (
            <Typography key={a} type="body-sm" align={a} className="rounded bg-surface-secondary px-2">
              {a}
            </Typography>
          ))}
        </Row>
        <Row label="truncate" className="w-64">
          <Typography type="body-sm" truncate className="w-64">
            An extremely long project title that will definitely not fit on one line
          </Typography>
        </Row>
        <Row label="primitives" className="flex-col items-start gap-1">
          <Typography.Heading level={3}>Typography.Heading level=3</Typography.Heading>
          <Typography.Paragraph size="sm">Typography.Paragraph size=&quot;sm&quot;</Typography.Paragraph>
          <Typography.Paragraph size="xs" color="muted">
            Typography.Paragraph size=&quot;xs&quot; color=&quot;muted&quot;
          </Typography.Paragraph>
          <Typography.Code>Typography.Code</Typography.Code>
        </Row>
        <Row label="Prose" className="max-w-xl">
          <Typography.Prose>
            <h3>Judging criteria</h3>
            <p>
              Each project is scored on <strong>impact</strong>, <em>execution</em>, and <a href="#">originality</a>.
              Use <code>1–10</code> for every criterion.
            </p>
            <ul>
              <li>Watch the demo video</li>
              <li>Skim the repository</li>
            </ul>
          </Typography.Prose>
        </Row>
      </Demo>

      {/* EmptyState -------------------------------------------------------- */}
      <Demo name="EmptyState" hint="root only (no variants) · default text · composed content">
        <div className="flex w-56 flex-col gap-2">
          <span className="font-mono text-xs text-muted">no children</span>
          <div className="rounded-xl border border-border">
            <EmptyState />
          </div>
        </div>
        <div className="flex w-72 flex-col gap-2">
          <span className="font-mono text-xs text-muted">composed</span>
          <EmptyState className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
            <PixelIcon name="trophy" size={28} />
            <span className="font-medium text-foreground">No submissions yet</span>
            <span>Projects appear here once teams submit.</span>
            <Button size="sm" variant="secondary">
              Share submit link
            </Button>
          </EmptyState>
        </div>
      </Demo>

      {/* Tooltip ----------------------------------------------------------- */}
      <Demo name="Tooltip" hint="hover or focus · placements · arrow · custom trigger">
        <Tooltip delay={0}>
          <Button variant="secondary">No arrow</Button>
          <Tooltip.Content>
            <p>Saves your draft score</p>
          </Tooltip.Content>
        </Tooltip>
        {(["top", "right", "bottom", "left"] as const).map((p) => (
          <Tooltip key={p} delay={0}>
            <Button variant="tertiary">{p}</Button>
            <Tooltip.Content showArrow placement={p}>
              <Tooltip.Arrow />
              <p>placement=&quot;{p}&quot;</p>
            </Tooltip.Content>
          </Tooltip>
        ))}
        <Tooltip delay={0}>
          <Button isIconOnly variant="ghost" aria-label="Scoring help">
            <PixelIcon name="spark" />
          </Button>
          <Tooltip.Content showArrow offset={12}>
            <Tooltip.Arrow />
            <p>offset=12</p>
          </Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Tooltip.Trigger aria-label="Ada Park">
            <Avatar size="sm">
              <Avatar.Image alt="Ada Park" src={AVATAR("blue")} />
              <Avatar.Fallback>AP</Avatar.Fallback>
            </Avatar>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            <div className="flex flex-col py-1">
              <p className="font-semibold">Ada Park</p>
              <p className="text-xs text-muted">Lead judge · 14 scored</p>
            </div>
          </Tooltip.Content>
        </Tooltip>
      </Demo>

      {/* Toolbar ----------------------------------------------------------- */}
      <Demo name="Toolbar" hint="horizontal · isAttached · vertical" className="flex-col">
        <Row label="default">
          <ScoringToolbar />
        </Row>
        <Row label="isAttached">
          <ScoringToolbar isAttached />
        </Row>
        <Row label="vertical">
          <ScoringToolbar orientation="vertical" />
        </Row>
      </Demo>

      {/* ScrollShadow ------------------------------------------------------ */}
      <Demo name="ScrollShadow" hint="vertical · horizontal · size · hideScrollBar">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-muted">vertical (default)</span>
          <Card className="w-64 p-0">
            <ScrollShadow className="max-h-48 p-4">
              <ScrollList />
            </ScrollShadow>
          </Card>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs text-muted">size=80 · hideScrollBar</span>
          <Card className="w-64 p-0">
            <ScrollShadow className="max-h-48 p-4" size={80} hideScrollBar>
              <ScrollList />
            </ScrollShadow>
          </Card>
        </div>
        <div className="flex w-full flex-col gap-2">
          <span className="font-mono text-xs text-muted">horizontal</span>
          <Card className="w-full max-w-xl p-0">
            <ScrollShadow className="p-4" orientation="horizontal">
              <div className="flex gap-3">
                {Array.from({ length: 10 }, (_, i) => (
                  <Surface key={i} variant="secondary" className="flex min-w-40 flex-col gap-1 rounded-xl p-3">
                    <span className="text-sm font-medium">Project #{i + 1}</span>
                    <span className="text-xs text-muted">Score {(9.4 - i * 0.3).toFixed(1)}</span>
                  </Surface>
                ))}
              </div>
            </ScrollShadow>
          </Card>
        </div>
      </Demo>
    </Section>
  );
}

function ScrollList() {
  return (
    <ol className="flex flex-col gap-3 text-sm">
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-2">
          <span>Team {["Nova", "Orbit", "Pixel", "Quark", "Relay", "Sonic"][i % 6]} {i + 1}</span>
          <span className="font-mono text-xs text-muted">{(9.6 - i * 0.4).toFixed(1)}</span>
        </li>
      ))}
    </ol>
  );
}

function ScoringToolbar({
  isAttached,
  orientation,
}: {
  isAttached?: boolean;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <Toolbar aria-label="Scoring tools" isAttached={isAttached} orientation={orientation}>
      <ToggleButtonGroup aria-label="Marks" selectionMode="multiple" defaultSelectedKeys={["flag"]}>
        <ToggleButton isIconOnly aria-label="Flag" id="flag">
          <PixelIcon name="flag" />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Shortlist" id="shortlist">
          <ToggleButtonGroup.Separator />
          <PixelIcon name="trophy" />
        </ToggleButton>
        <ToggleButton isIconOnly aria-label="Watch" id="watch">
          <ToggleButtonGroup.Separator />
          <PixelIcon name="eye" />
        </ToggleButton>
      </ToggleButtonGroup>
      <Separator />
      <ButtonGroup variant="tertiary">
        <Button isIconOnly aria-label="Previous">
          <PixelIcon name="arrow-left" />
        </Button>
        <Button isIconOnly aria-label="Next">
          <ButtonGroup.Separator />
          <PixelIcon name="arrow-right" />
        </Button>
      </ButtonGroup>
    </Toolbar>
  );
}
