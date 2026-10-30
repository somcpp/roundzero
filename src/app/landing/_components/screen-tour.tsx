"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo, type Variants } from "motion/react";
import Image, { type ImageLoader } from "next/image";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PixelIcon } from "@/components/pixel-icon";

/** One screenshot in the tour. */
export type Shot = {
  /** The file under uploads/ on the CDN, e.g. "01-schema.png". */
  file: string;
  /** The part of the app it's from. Neighboring shots with the same chapter share a label under the slider. */
  chapter: string;
  /** The headline printed on the image. */
  title: string;
  /** What the image shows, for screen readers. */
  alt: string;
};

// Bytescale's image API serves each upload as WebP at the width asked for. The
// originals are 3000×2000 and it upscales past that, so widths stop there.
const CDN = "https://upcdn.io/kW15bg4/image/uploads/";
const cdnLoader: ImageLoader = ({ src, width }) => `${CDN}${src}?f=webp&w=${Math.min(width, 3000)}`;

const RATIO = 3 / 2;

// The current slide takes 84% of the slider on phones and 80% above, so its
// neighbors peek out either side. Above 1152px the section stops growing.
const SLIDE_SIZES = "(min-width: 1152px) 884px, (min-width: 640px) 76vw, 84vw";

const pad = (n: number) => String(n).padStart(2, "0");

/** Runs of neighboring shots that share a chapter, in order. */
function chaptersOf(shots: Shot[]) {
  const chapters: { name: string; indexes: number[] }[] = [];
  shots.forEach((shot, i) => {
    const last = chapters.at(-1);
    if (last?.name === shot.chapter) last.indexes.push(i);
    else chapters.push({ name: shot.chapter, indexes: [i] });
  });
  return chapters;
}

/**
 * The app's screens in a sideways slider: the current one sits in the middle
 * with its neighbors peeking out. Opening it lifts it out of the slider and
 * zooms it into a lightbox, where the arrows, arrow keys or a swipe step
 * through the rest. Closing zooms it back into place.
 */
export function ScreenTour({ shots, label }: { shots: Shot[]; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Where the arrows are headed while the track is still scrolling, so quick
  // repeat presses keep counting from there. Cleared once it settles.
  const headingRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  // The lightbox's shot, or null when it's closed.
  const [shown, setShown] = useState<number | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  // Where the zoom lands on close: back over the slide.
  const [closing, setClosing] = useState<Zoom | undefined>();
  // The slide whose copy is zoomed. It hides until the zoom lands back on it.
  const [lifted, setLifted] = useState<number | null>(null);
  const last = shots.length - 1;

  // The active slide is whichever sits nearest the middle of the track.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const measure = () => {
      const middle = track.getBoundingClientRect().left + track.clientWidth / 2;
      let nearest = 0;
      let gap = Infinity;
      slideRefs.current.forEach((slide, i) => {
        if (!slide) return;
        const r = slide.getBoundingClientRect();
        const g = Math.abs(r.left + r.width / 2 - middle);
        if (g < gap) [nearest, gap] = [i, g];
      });
      setActive(nearest);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
      clearTimeout(settle);
      settle = setTimeout(() => (headingRef.current = null), 150);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, []);

  /** Scrolls slide `i` to the middle of the track. */
  function center(i: number, behavior: ScrollBehavior = reduceMotion ? "instant" : "smooth") {
    const track = trackRef.current;
    const slide = slideRefs.current[i];
    if (!track || !slide) return;
    // Measured by centers: the smaller neighbors are scaled about theirs.
    const r = slide.getBoundingClientRect();
    const middle = track.getBoundingClientRect().left + track.clientWidth / 2;
    track.scrollTo({ left: track.scrollLeft + r.left + r.width / 2 - middle, behavior });
  }

  function goTo(i: number) {
    const next = Math.min(Math.max(i, 0), last);
    headingRef.current = next;
    center(next);
    return next;
  }

  const step = (delta: number) => goTo((headingRef.current ?? active) + delta);

  function onTrackKey(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, () => number> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      Home: () => goTo(0),
      End: () => goTo(last),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    slideRefs.current[move()]?.focus({ preventScroll: true });
  }

  function open(i: number) {
    const slide = slideRefs.current[i];
    if (!slide) return;
    const img = slide.querySelector("img");
    setOpened({
      index: i,
      rect: slide.getBoundingClientRect(),
      // The size the slider already has, to show while the full size loads.
      placeholder: img?.complete && img.currentSrc ? img.currentSrc : null,
      // Inside .landing so the page's styles reach it, and out of any
      // transformed ancestor that would trap position: fixed.
      container: slide.closest<HTMLElement>(".landing") ?? document.body,
    });
    setClosing(undefined);
    setLifted(i);
    setShown(i);
  }

  /** The lightbox moved to shot `i`: keep the slider under it in step. */
  function show(i: number) {
    setShown(i);
    setLifted(i);
    setActive(i);
    headingRef.current = null;
    center(i, "instant");
  }

  function close() {
    if (shown === null) return;
    const rect = slideRefs.current[shown]?.getBoundingClientRect();
    const onScreen = rect && rect.bottom > 0 && rect.top < window.innerHeight;
    setClosing({ rect: onScreen ? rect : null, box: fitBox(window.innerWidth, window.innerHeight) });
    setShown(null);
  }

  const chapters = chaptersOf(shots);
  const current = shots[active];

  return (
    <div className="@container -mx-6 sm:mx-0">
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        onKeyDown={onTrackKey}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[8cqw] pt-2 pb-10 [scrollbar-width:none] sm:gap-6 sm:px-[10cqw] sm:[mask-image:linear-gradient(to_right,transparent,#000_3%,#000_97%,transparent)] [&::-webkit-scrollbar]:hidden"
      >
        {shots.map((shot, i) => {
          const isActive = i === active;
          return (
            <div
              key={shot.file}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${shots.length}`}
              className={`w-[84cqw] shrink-0 snap-center transition-[scale,opacity] duration-500 ease-[cubic-bezier(0.22,0.8,0.2,1)] sm:w-[80cqw] ${isActive ? "" : "scale-95 opacity-55 hover:opacity-80"}`}
            >
              <button
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                type="button"
                tabIndex={isActive ? 0 : -1}
                aria-haspopup={isActive ? "dialog" : undefined}
                onClick={() => (isActive ? open(i) : goTo(i))}
                // The shadow stays inside the track's bottom padding, which clips anything past it.
                className={`group relative block aspect-[3/2] w-full overflow-hidden rounded-xl bg-[var(--violet-soft)] shadow-[0_1px_2px_rgba(46,22,88,0.06),0_16px_36px_-18px_rgba(76,29,149,0.45)] ring-1 ring-[var(--line-soft)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c026d3] focus-visible:outline-dashed ${isActive ? "cursor-zoom-in" : "cursor-pointer"} ${lifted === i ? "invisible" : ""}`}
              >
                <Image loader={cdnLoader} src={shot.file} alt={shot.alt} fill sizes={SLIDE_SIZES} draggable={false} className="object-cover" />
                {isActive ? (
                  <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-[rgba(21,12,46,0.82)] px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                    <PixelIcon name="search" size={11} />
                    View full size
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 px-6 sm:gap-8 sm:px-0">
        <button type="button" aria-label="Previous screen" disabled={active === 0} onClick={() => step(-1)} className={ARROW}>
          <PixelIcon name="arrow-left" size={12} />
        </button>
        {/* Wide screens get a pixel per shot, grouped under its chapter. Phones get a counter. */}
        <div className="hidden items-start gap-5 sm:flex">
          {chapters.map((chapter) => (
            <div key={chapter.name} className="flex flex-col items-start gap-1.5">
              <span
                className={`mono text-[0.65rem] font-semibold tracking-[0.18em] uppercase transition-colors ${chapter.indexes.includes(active) ? "text-[var(--violet)]" : "text-[var(--faint)]"}`}
              >
                {chapter.name}
              </span>
              {/* Each pixel's button is 14px wide and the active one 16px wider. Every chapter keeps room
                  for it, so the arrows either side don't shift as it moves between chapters. */}
              <div className="-mx-[3px] flex" style={{ minWidth: chapter.indexes.length * 14 + 16 }}>
                {chapter.indexes.map((i) => (
                  <button
                    key={i}
                    type="button"
                    // Arrow keys on the slide cover the keyboard; seventeen tab stops would be a chore.
                    tabIndex={-1}
                    aria-label={`Screen ${i + 1}: ${shots[i].title}`}
                    aria-current={i === active ? "true" : undefined}
                    onClick={() => goTo(i)}
                    className="group flex h-5 items-center px-[3px]"
                  >
                    <span
                      className={`block h-2 rounded-[2px] transition-[width,background-color] duration-300 ${i === active ? "w-6" : "w-2 bg-[var(--line)] group-hover:bg-[var(--violet)]"}`}
                      style={i === active ? { background: "var(--dusk)" } : undefined}
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mono m-0 min-w-40 text-center text-xs tracking-[0.14em] text-[var(--muted)] uppercase sm:hidden">
          {current.chapter} · {pad(active + 1)} / {pad(shots.length)}
        </p>
        <button type="button" aria-label="Next screen" disabled={active === last} onClick={() => step(1)} className={ARROW}>
          <PixelIcon name="arrow-right" size={12} />
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        Screen {active + 1} of {shots.length}: {current.title}
      </p>

      <AnimatePresence custom={closing} onExitComplete={() => setLifted(null)}>
        {shown !== null && opened ? (
          <Lightbox
            key="lightbox"
            shots={shots}
            index={shown}
            opened={opened}
            onShow={show}
            onClose={close}
            onClosed={(i) => slideRefs.current[i]?.focus({ preventScroll: true })}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const ARROW = "btn-arcade btn-arcade--light btn-arcade--sm !px-3.5 disabled:pointer-events-none disabled:opacity-40";

// ── Lightbox ───────────────────────────────────────────────────────────────

type Box = { left: number; top: number; width: number; height: number };

/** The slide the lightbox opened from. */
type Opened = { index: number; rect: DOMRect; placeholder: string | null; container: HTMLElement };

/** A slide's place on screen, and the lightbox box to zoom from or back to it. */
type Zoom = { rect: DOMRect | null; box: Box };

/** The lightbox's image box: as big as the viewport allows at 3:2, clear of the controls. */
function fitBox(vw: number, vh: number): Box {
  const phone = vw < 640;
  const short = vh < 600;
  const side = phone ? 12 : 88; // the side arrows
  const top = phone ? 64 : short ? 56 : 72; // the counter and close button
  const bottom = phone ? 88 : short ? 16 : 40; // phones put the arrows underneath
  const width = Math.max(0, Math.min(vw - side * 2, (vh - top - bottom) * RATIO, 1800));
  const height = width / RATIO;
  return { width, height, left: (vw - width) / 2, top: top + (vh - top - bottom - height) / 2 };
}

const ZOOM: Variants = {
  // Laid over the slide. Both are 3:2, so one scale fits it. With no slide on
  // screen to go back to, it fades instead.
  slide: ({ rect, box }: Zoom) =>
    rect
      ? {
          x: rect.left + rect.width / 2 - (box.left + box.width / 2),
          y: rect.top + rect.height / 2 - (box.top + box.height / 2),
          scale: rect.width / box.width,
          opacity: 1,
          transition: { type: "spring", bounce: 0, duration: 0.4 },
        }
      : { x: 0, y: 0, scale: 0.94, opacity: 0, transition: { duration: 0.2 } },
  full: { x: 0, y: 0, scale: 1, opacity: 1, transition: { type: "spring", bounce: 0, duration: 0.4 } },
};

// The next shot slides in from the side it was asked for.
const SLIDE: Variants = {
  enter: (direction: number) => ({ x: direction * 60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { x: { type: "spring", bounce: 0, duration: 0.35 }, opacity: { duration: 0.2 } } },
  exit: (direction: number) => ({ x: direction * -60, opacity: 0, transition: { duration: 0.18 } }),
};

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };

const ROUND =
  "pointer-events-auto grid size-11 place-items-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0abfc] focus-visible:outline-dashed disabled:pointer-events-none disabled:opacity-30 sm:size-12";

function Lightbox({
  shots,
  index,
  opened,
  onShow,
  onClose,
  onClosed,
}: {
  shots: Shot[];
  index: number;
  opened: Opened;
  onShow: (i: number) => void;
  onClose: () => void;
  onClosed: (i: number) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const [direction, setDirection] = useState(0);
  const box = fitBox(viewport.width, viewport.height);
  const sizes = `${Math.round(box.width)}px`;
  const shot = shots[index];
  const last = shots.length - 1;

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function step(delta: number) {
    const next = index + delta;
    if (next < 0 || next > last) return;
    setDirection(delta);
    onShow(next);
  }

  function onDragEnd(_: unknown, { offset, velocity }: PanInfo) {
    const swipe = offset.x + velocity.x * 0.2;
    if (swipe < -80) step(1);
    else if (swipe > 80) step(-1);
  }

  // Beside the image on wide screens, under it on phones.
  const prev = (
    <button type="button" aria-label="Previous screen" disabled={index === 0} onClick={() => step(-1)} className={ROUND}>
      <PixelIcon name="arrow-left" size={14} />
    </button>
  );
  const next = (
    <button type="button" aria-label="Next screen" disabled={index === last} onClick={() => step(1)} className={ROUND}>
      <PixelIcon name="arrow-right" size={14} />
    </button>
  );

  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal container={opened.container}>
        <Dialog.Overlay asChild>
          <motion.div className="fixed inset-0 z-[100] bg-[rgba(21,12,46,0.9)] backdrop-blur-md" {...FADE}>
            <div aria-hidden className="stars absolute inset-0 opacity-40" />
          </motion.div>
        </Dialog.Overlay>
        <Dialog.Content
          asChild
          // Focus the dialog itself rather than its first button, so stepping with the arrow keys doesn't
          // light up the close button. Tab still reaches every control.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed(index);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              step(e.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        >
          {/* Fills the screen, so a click that lands on nothing but the backdrop closes it. */}
          <div ref={contentRef} className="fixed inset-0 z-[101] outline-none" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <Dialog.Title className="sr-only">App screens</Dialog.Title>
            <Dialog.Description className="sr-only">Use the left and right arrow keys to step through them.</Dialog.Description>
            <p className="sr-only" aria-live="polite">
              Screen {index + 1} of {shots.length}: {shot.title}
            </p>

            <motion.div
              className="pointer-events-none fixed inset-x-0 top-0 flex items-center justify-between gap-4 px-3 pt-3 sm:px-5 sm:pt-4"
              {...FADE}
            >
              <p className="mono m-0 pl-1 text-xs tracking-[0.16em] text-[var(--on-dark-muted)] uppercase">
                {shot.chapter} · {pad(index + 1)} / {pad(shots.length)}
              </p>
              <Dialog.Close aria-label="Close" className={ROUND}>
                <PixelIcon name="x" size={14} />
              </Dialog.Close>
            </motion.div>

            <motion.div
              className="fixed overflow-hidden rounded-xl bg-white/5 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.75)] ring-1 ring-white/10"
              style={box}
              custom={{ rect: opened.rect, box } satisfies Zoom}
              variants={ZOOM}
              initial="slide"
              animate="full"
              exit="slide"
            >
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={index}
                  className="absolute inset-0 cursor-grab touch-pan-y touch-pinch-zoom active:cursor-grabbing"
                  custom={direction}
                  variants={SLIDE}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={onDragEnd}
                >
                  {index === opened.index && opened.placeholder ? (
                    <Image unoptimized src={opened.placeholder} alt="" fill draggable={false} className="object-cover" />
                  ) : null}
                  <Image
                    loader={cdnLoader}
                    src={shot.file}
                    alt={shot.alt}
                    fill
                    sizes={sizes}
                    loading="eager"
                    draggable={false}
                    className="object-cover"
                  />
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* The shots either side, fetched at this size so stepping to them is instant. */}
            <div aria-hidden className="pointer-events-none invisible fixed" style={box}>
              {[index - 1, index + 1]
                .filter((i) => i >= 0 && i <= last)
                .map((i) => (
                  <Image key={i} loader={cdnLoader} src={shots[i].file} alt="" fill sizes={sizes} loading="eager" />
                ))}
            </div>

            <motion.div className="pointer-events-none hidden sm:block" {...FADE}>
              <div className="fixed top-1/2 left-5 -translate-y-1/2">{prev}</div>
              <div className="fixed top-1/2 right-5 -translate-y-1/2">{next}</div>
            </motion.div>
            <motion.div
              className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:hidden"
              {...FADE}
            >
              {prev}
              {next}
            </motion.div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
