"use client";

import { useState, type ReactNode } from "react";
import { Section, Demo } from "../demo";
import {
  Calendar,
  RangeCalendar,
  DateField,
  TimeField,
  DatePicker,
  DateRangePicker,
  ColorPicker,
  ColorArea,
  ColorSlider,
  ColorSwatch,
  ColorSwatchPicker,
  ColorField,
  Description,
  FieldError,
  IconCalendar,
  IconChevronDown,
  Label,
  parseColor,
  type Color,
  type DateValue,
} from "@heroui/react";
// Not re-exported from the package root; only available as subpath exports.
import { DateInputGroup } from "@heroui/react/date-input-group";
import { ColorInputGroup } from "@heroui/react/color-input-group";
import { BRAND_COLORS } from "@/lib/branding";

export const id = "pickers";
export const title = "Date & color";
export const components = [
  "Calendar",
  "RangeCalendar",
  "DateField",
  "TimeField",
  "DateInputGroup",
  "DatePicker",
  "DateRangePicker",
  "ColorPicker",
  "ColorArea",
  "ColorSlider",
  "ColorSwatch",
  "ColorSwatchPicker",
  "ColorField",
  "ColorInputGroup",
];

/*
 * Date values: HeroUI's date components take @internationalized/date objects
 * (CalendarDate etc.). That package is a peer dependency of @heroui/react but is
 * not a direct dependency of this app, and @heroui/react doesn't re-export
 * parseDate/today — so the date demos below show empty/placeholder states and
 * pick up a value once you interact. Colors accept plain strings.
 */

const BRAND = Object.entries(BRAND_COLORS) as [string, string][];

// Day-of-month based rules so they work in whatever month the calendar opens on.
const EVENT_DAYS = [3, 10, 17, 24];
const isJudgeBlackout = (date: DateValue) => date.day >= 12 && date.day <= 14;

/** Small caption above each variant inside a Demo. */
function V({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ?? "flex flex-col gap-2"}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}

/* ---------- Calendar compositions ---------- */

function CalendarParts({ yearPicker, indicators }: { yearPicker?: boolean; indicators?: boolean }) {
  return (
    <>
      <Calendar.Header>
        {yearPicker ? (
          <Calendar.YearPickerTrigger>
            <Calendar.YearPickerTriggerHeading />
            <Calendar.YearPickerTriggerIndicator />
          </Calendar.YearPickerTrigger>
        ) : (
          <Calendar.Heading />
        )}
        <Calendar.NavButton slot="previous" />
        <Calendar.NavButton slot="next" />
      </Calendar.Header>
      <Calendar.Grid>
        <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
        <Calendar.GridBody>
          {(date) =>
            indicators ? (
              <Calendar.Cell date={date}>
                {({ formattedDate }) => (
                  <>
                    {formattedDate}
                    {EVENT_DAYS.includes(date.day) && <Calendar.CellIndicator />}
                  </>
                )}
              </Calendar.Cell>
            ) : (
              <Calendar.Cell date={date} />
            )
          }
        </Calendar.GridBody>
      </Calendar.Grid>
      {yearPicker && (
        <Calendar.YearPickerGrid>
          <Calendar.YearPickerGridBody>{({ year }) => <Calendar.YearPickerCell year={year} />}</Calendar.YearPickerGridBody>
        </Calendar.YearPickerGrid>
      )}
    </>
  );
}

function RangeCalendarParts({ yearPicker }: { yearPicker?: boolean }) {
  return (
    <>
      <RangeCalendar.Header>
        {yearPicker ? (
          <RangeCalendar.YearPickerTrigger>
            <RangeCalendar.YearPickerTriggerHeading />
            <RangeCalendar.YearPickerTriggerIndicator />
          </RangeCalendar.YearPickerTrigger>
        ) : (
          <RangeCalendar.Heading />
        )}
        <RangeCalendar.NavButton slot="previous" />
        <RangeCalendar.NavButton slot="next" />
      </RangeCalendar.Header>
      <RangeCalendar.Grid>
        <RangeCalendar.GridHeader>
          {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
        </RangeCalendar.GridHeader>
        <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
      </RangeCalendar.Grid>
      {yearPicker && (
        <RangeCalendar.YearPickerGrid>
          <RangeCalendar.YearPickerGridBody>
            {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
          </RangeCalendar.YearPickerGridBody>
        </RangeCalendar.YearPickerGrid>
      )}
    </>
  );
}

/* ---------- Field inputs ---------- */

function DateSegments() {
  return <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>;
}

function TimeSegments() {
  return <TimeField.Input>{(segment) => <TimeField.Segment segment={segment} />}</TimeField.Input>;
}

function PickerSuffix() {
  return (
    <DateField.Suffix>
      <DatePicker.Trigger>
        <DatePicker.TriggerIndicator />
      </DatePicker.Trigger>
    </DateField.Suffix>
  );
}

function PickerPopover() {
  return (
    <DatePicker.Popover>
      <Calendar aria-label="Choose date">
        <CalendarParts yearPicker />
      </Calendar>
    </DatePicker.Popover>
  );
}

function RangeGroup({ variant }: { variant?: "primary" | "secondary" }) {
  return (
    <DateField.Group fullWidth variant={variant}>
      <DateField.InputContainer>
        <DateField.Input slot="start">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateRangePicker.RangeSeparator />
        <DateField.Input slot="end">{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
      </DateField.InputContainer>
      <DateField.Suffix>
        <DateRangePicker.Trigger>
          <DateRangePicker.TriggerIndicator />
        </DateRangePicker.Trigger>
      </DateField.Suffix>
    </DateField.Group>
  );
}

function RangePopover() {
  return (
    <DateRangePicker.Popover>
      <RangeCalendar aria-label="Choose hackathon dates">
        <RangeCalendarParts yearPicker />
      </RangeCalendar>
    </DateRangePicker.Popover>
  );
}

/* ---------- Color helpers ---------- */

function PickerPanel() {
  return (
    <>
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
    </>
  );
}

function SliderParts({ label }: { label?: string }) {
  return (
    <>
      {label && <Label>{label}</Label>}
      {label && <ColorSlider.Output className="text-muted" />}
      <ColorSlider.Track>
        <ColorSlider.Thumb />
      </ColorSlider.Track>
    </>
  );
}

function BrandSwatchItems({ disabledFrom }: { disabledFrom?: number }) {
  return BRAND.map(([name, hex], i) => (
    <ColorSwatchPicker.Item key={name} color={hex} isDisabled={disabledFrom !== undefined && i >= disabledFrom}>
      <ColorSwatchPicker.Swatch />
      <ColorSwatchPicker.Indicator />
    </ColorSwatchPicker.Item>
  ));
}

export default function PickersSection() {
  const [brandColor, setBrandColor] = useState<Color | null>(() => parseColor(BRAND_COLORS.purple));

  return (
    <Section id={id} title={title}>
      <Demo name="Calendar" hint="Default · year picker · cell indicators · unavailable · invalid · disabled · read-only">
        <V label="Default">
          <Calendar aria-label="Judging opens">
            <CalendarParts />
          </Calendar>
        </V>
        <V label="Year picker header">
          <Calendar aria-label="Hackathon date">
            <CalendarParts yearPicker />
          </Calendar>
        </V>
        <V label="Cell indicators (demo days)">
          <Calendar aria-label="Demo days">
            <CalendarParts indicators />
          </Calendar>
        </V>
        <V label="Unavailable (12th–14th)">
          <Calendar aria-label="Judge availability" isDateUnavailable={isJudgeBlackout}>
            <CalendarParts />
          </Calendar>
        </V>
        <V label="Invalid">
          <Calendar aria-label="Results date" isInvalid>
            <CalendarParts />
          </Calendar>
        </V>
        <V label="Disabled">
          <Calendar aria-label="Judging closes" isDisabled>
            <CalendarParts />
          </Calendar>
        </V>
        <V label="Read-only">
          <Calendar aria-label="Judging opens" isReadOnly>
            <CalendarParts />
          </Calendar>
        </V>
      </Demo>

      <Demo name="RangeCalendar" hint="Default · year picker · unavailable · invalid · disabled · read-only">
        <V label="Default (drag to select)">
          <RangeCalendar aria-label="Hackathon dates">
            <RangeCalendarParts />
          </RangeCalendar>
        </V>
        <V label="Year picker header">
          <RangeCalendar aria-label="Submission window">
            <RangeCalendarParts yearPicker />
          </RangeCalendar>
        </V>
        <V label="Unavailable (12th–14th)">
          <RangeCalendar aria-label="Judging window" isDateUnavailable={isJudgeBlackout}>
            <RangeCalendarParts />
          </RangeCalendar>
        </V>
        <V label="Invalid">
          <RangeCalendar aria-label="Hackathon dates" isInvalid>
            <RangeCalendarParts />
          </RangeCalendar>
        </V>
        <V label="Disabled">
          <RangeCalendar aria-label="Hackathon dates" isDisabled>
            <RangeCalendarParts />
          </RangeCalendar>
        </V>
        <V label="Read-only">
          <RangeCalendar aria-label="Hackathon dates" isReadOnly>
            <RangeCalendarParts />
          </RangeCalendar>
        </V>
      </Demo>

      <Demo name="DateField" hint="Group variant primary/secondary · prefix/suffix · granularity · required · invalid · disabled · read-only">
        <DateField className="w-64" name="judging-opens">
          <Label>Judging opens</Label>
          <DateField.Group variant="primary">
            <DateSegments />
          </DateField.Group>
          <Description>Primary group (default)</Description>
        </DateField>
        <DateField className="w-64" name="judging-closes">
          <Label>Judging closes</Label>
          <DateField.Group variant="secondary">
            <DateSegments />
          </DateField.Group>
          <Description>Secondary group (for surfaces)</Description>
        </DateField>
        <DateField className="w-64" name="kickoff">
          <Label>Kickoff</Label>
          <DateField.Group>
            <DateField.Prefix>
              <IconCalendar className="size-4 text-muted" />
            </DateField.Prefix>
            <DateSegments />
            <DateField.Suffix>
              <IconChevronDown className="size-4 text-muted" />
            </DateField.Suffix>
          </DateField.Group>
          <Description>With prefix &amp; suffix</Description>
        </DateField>
        <DateField className="w-64" name="deadline" granularity="minute">
          <Label>Submission deadline</Label>
          <DateField.Group>
            <DateSegments />
          </DateField.Group>
          <Description>granularity=&quot;minute&quot;</Description>
        </DateField>
        <DateField className="w-64" name="results" isRequired>
          <Label>Results announced</Label>
          <DateField.Group>
            <DateSegments />
          </DateField.Group>
          <Description>Required</Description>
        </DateField>
        <DateField className="w-64" name="demo-day" isInvalid>
          <Label>Demo day</Label>
          <DateField.Group>
            <DateSegments />
          </DateField.Group>
          <FieldError>Demo day must be after judging closes</FieldError>
        </DateField>
        <DateField className="w-64" name="archived" isDisabled>
          <Label>Archived on</Label>
          <DateField.Group>
            <DateSegments />
          </DateField.Group>
          <Description>Disabled</Description>
        </DateField>
        <DateField className="w-64" name="created" isReadOnly>
          <Label>Created on</Label>
          <DateField.Group>
            <DateSegments />
          </DateField.Group>
          <Description>Read-only</Description>
        </DateField>
      </Demo>

      <Demo name="TimeField" hint="Primary/secondary · 24h · seconds · required · invalid · disabled · read-only">
        <TimeField className="w-56" name="pitch-start">
          <Label>Pitches start</Label>
          <TimeField.Group>
            <TimeSegments />
          </TimeField.Group>
          <Description>Primary group</Description>
        </TimeField>
        <TimeField className="w-56" name="pitch-end">
          <Label>Pitches end</Label>
          <TimeField.Group variant="secondary">
            <TimeSegments />
          </TimeField.Group>
          <Description>Secondary group</Description>
        </TimeField>
        <TimeField className="w-56" name="checkin" hourCycle={24}>
          <Label>Check-in</Label>
          <TimeField.Group>
            <TimeField.Prefix>
              <IconCalendar className="size-4 text-muted" />
            </TimeField.Prefix>
            <TimeSegments />
          </TimeField.Group>
          <Description>24-hour · with prefix</Description>
        </TimeField>
        <TimeField className="w-56" name="slot-length" granularity="second">
          <Label>Pitch timer</Label>
          <TimeField.Group>
            <TimeSegments />
          </TimeField.Group>
          <Description>granularity=&quot;second&quot;</Description>
        </TimeField>
        <TimeField className="w-56" name="judging-call" isRequired>
          <Label>Judges&apos; call</Label>
          <TimeField.Group>
            <TimeSegments />
          </TimeField.Group>
          <Description>Required</Description>
        </TimeField>
        <TimeField className="w-56" name="awards" isInvalid>
          <Label>Awards</Label>
          <TimeField.Group>
            <TimeSegments />
          </TimeField.Group>
          <FieldError>Awards must start after pitches end</FieldError>
        </TimeField>
        <TimeField className="w-56" name="doors" isDisabled>
          <Label>Doors open</Label>
          <TimeField.Group>
            <TimeSegments />
          </TimeField.Group>
          <Description>Disabled</Description>
        </TimeField>
        <TimeField className="w-56" name="livestream" isReadOnly>
          <Label>Livestream</Label>
          <TimeField.Group>
            <TimeSegments />
          </TimeField.Group>
          <Description>Read-only</Description>
        </TimeField>
      </Demo>

      <Demo
        name="DateInputGroup"
        hint="The shell behind DateField.Group / TimeField.Group — variant · fullWidth · prefix/suffix; must sit inside a DateField/TimeField"
      >
        <DateField aria-label="Judging opens" className="w-64">
          <DateInputGroup variant="primary">
            <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
          </DateInputGroup>
        </DateField>
        <DateField aria-label="Judging closes" className="w-64">
          <DateInputGroup variant="secondary">
            <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
          </DateInputGroup>
        </DateField>
        <DateField aria-label="Kickoff" className="w-64">
          <DateInputGroup>
            <DateInputGroup.Prefix>
              <IconCalendar className="size-4 text-muted" />
            </DateInputGroup.Prefix>
            <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
            <DateInputGroup.Suffix>
              <span className="text-xs text-muted">UTC</span>
            </DateInputGroup.Suffix>
          </DateInputGroup>
        </DateField>
        <TimeField aria-label="Pitches start" className="w-64">
          <DateInputGroup>
            <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
          </DateInputGroup>
        </TimeField>
        <div className="w-full max-w-md">
          <DateField aria-label="Submission deadline" fullWidth granularity="minute">
            <DateInputGroup fullWidth>
              <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
            </DateInputGroup>
          </DateField>
        </div>
        <DateField aria-label="Invalid date" className="w-64" isInvalid>
          <DateInputGroup>
            <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
          </DateInputGroup>
        </DateField>
        <DateField aria-label="Disabled date" className="w-64" isDisabled>
          <DateInputGroup>
            <DateInputGroup.Input>{(segment) => <DateInputGroup.Segment segment={segment} />}</DateInputGroup.Input>
          </DateInputGroup>
        </DateField>
      </Demo>

      <Demo name="DatePicker" hint="Primary/secondary group · required · invalid · disabled · read-only (click the calendar icon)">
        <DatePicker className="w-72" name="judging-opens-picker">
          <Label>Judging opens</Label>
          <DateField.Group fullWidth>
            <DateSegments />
            <PickerSuffix />
          </DateField.Group>
          <Description>Primary group</Description>
          <PickerPopover />
        </DatePicker>
        <DatePicker className="w-72" name="judging-closes-picker">
          <Label>Judging closes</Label>
          <DateField.Group fullWidth variant="secondary">
            <DateSegments />
            <PickerSuffix />
          </DateField.Group>
          <Description>Secondary group</Description>
          <PickerPopover />
        </DatePicker>
        <DatePicker className="w-72" name="results-picker" isRequired>
          <Label>Results announced</Label>
          <DateField.Group fullWidth>
            <DateSegments />
            <PickerSuffix />
          </DateField.Group>
          <Description>Required</Description>
          <PickerPopover />
        </DatePicker>
        <DatePicker className="w-72" name="demo-day-picker" isInvalid>
          <Label>Demo day</Label>
          <DateField.Group fullWidth>
            <DateSegments />
            <PickerSuffix />
          </DateField.Group>
          <FieldError>Pick a date after judging closes</FieldError>
          <PickerPopover />
        </DatePicker>
        <DatePicker className="w-72" name="archived-picker" isDisabled>
          <Label>Archived on</Label>
          <DateField.Group fullWidth>
            <DateSegments />
            <PickerSuffix />
          </DateField.Group>
          <Description>Disabled</Description>
          <PickerPopover />
        </DatePicker>
        <DatePicker className="w-72" name="created-picker" isReadOnly>
          <Label>Created on</Label>
          <DateField.Group fullWidth>
            <DateSegments />
            <PickerSuffix />
          </DateField.Group>
          <Description>Read-only</Description>
          <PickerPopover />
        </DatePicker>
      </Demo>

      <Demo name="DateRangePicker" hint="Primary/secondary group · required · invalid · disabled · read-only">
        <DateRangePicker className="w-80" startName="starts" endName="ends">
          <Label>Hackathon dates</Label>
          <RangeGroup />
          <Description>Primary group</Description>
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker className="w-80" startName="judging-starts" endName="judging-ends">
          <Label>Judging window</Label>
          <RangeGroup variant="secondary" />
          <Description>Secondary group</Description>
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker className="w-80" startName="sub-starts" endName="sub-ends" isRequired>
          <Label>Submission window</Label>
          <RangeGroup />
          <Description>Required</Description>
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker className="w-80" startName="bad-starts" endName="bad-ends" isInvalid>
          <Label>Hackathon dates</Label>
          <RangeGroup />
          <FieldError>End date must be after the start date</FieldError>
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker className="w-80" startName="old-starts" endName="old-ends" isDisabled>
          <Label>Past hackathon</Label>
          <RangeGroup />
          <Description>Disabled</Description>
          <RangePopover />
        </DateRangePicker>
        <DateRangePicker className="w-80" startName="ro-starts" endName="ro-ends" isReadOnly>
          <Label>Locked dates</Label>
          <RangeGroup />
          <Description>Read-only</Description>
          <RangePopover />
        </DateRangePicker>
      </Demo>

      <Demo name="ColorPicker" hint="Trigger + popover composition · with brand swatches & hex field · disabled trigger">
        <ColorPicker defaultValue={BRAND_COLORS.purple}>
          <ColorPicker.Trigger>
            <ColorSwatch size="lg" />
            <Label>Brand color</Label>
          </ColorPicker.Trigger>
          <ColorPicker.Popover>
            <PickerPanel />
          </ColorPicker.Popover>
        </ColorPicker>
        <ColorPicker defaultValue={BRAND_COLORS.teal}>
          <ColorPicker.Trigger>
            <ColorSwatch size="lg" shape="square" />
            <Label>Accent (presets + hex)</Label>
          </ColorPicker.Trigger>
          <ColorPicker.Popover className="gap-2">
            <ColorSwatchPicker className="justify-center pt-2" size="xs">
              <BrandSwatchItems />
            </ColorSwatchPicker>
            <PickerPanel />
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
        <ColorPicker defaultValue={BRAND_COLORS.zinc}>
          <ColorPicker.Trigger isDisabled>
            <ColorSwatch size="lg" />
            <Label>Locked color</Label>
          </ColorPicker.Trigger>
          <ColorPicker.Popover>
            <PickerPanel />
          </ColorPicker.Popover>
        </ColorPicker>
      </Demo>

      <Demo name="ColorArea" hint="Default · showDots · HSL lightness axis · RGB channels · disabled">
        <V label="Default (HSB)">
          <ColorArea aria-label="Brand color" defaultValue={BRAND_COLORS.purple}>
            <ColorArea.Thumb />
          </ColorArea>
        </V>
        <V label="showDots">
          <ColorArea aria-label="Accent color" defaultValue={BRAND_COLORS.blue} showDots>
            <ColorArea.Thumb />
          </ColorArea>
        </V>
        <V label="HSL · saturation × lightness">
          <ColorArea aria-label="Accent color" colorSpace="hsl" defaultValue={BRAND_COLORS.teal} xChannel="saturation" yChannel="lightness">
            <ColorArea.Thumb />
          </ColorArea>
        </V>
        <V label="RGB · blue × green">
          <ColorArea aria-label="Accent color" colorSpace="rgb" defaultValue={BRAND_COLORS.orange} xChannel="blue" yChannel="green">
            <ColorArea.Thumb />
          </ColorArea>
        </V>
        <V label="Disabled">
          <ColorArea aria-label="Locked color" defaultValue={BRAND_COLORS.rose} isDisabled>
            <ColorArea.Thumb />
          </ColorArea>
        </V>
      </Demo>

      <Demo name="ColorSlider" hint="Channels (hue, saturation, lightness, alpha, RGB) · vertical · disabled">
        <div className="flex w-72 flex-col gap-4">
          <ColorSlider channel="hue" colorSpace="hsl" defaultValue={BRAND_COLORS.purple}>
            <SliderParts label="Hue" />
          </ColorSlider>
          <ColorSlider channel="saturation" colorSpace="hsl" defaultValue={BRAND_COLORS.purple}>
            <SliderParts label="Saturation" />
          </ColorSlider>
          <ColorSlider channel="lightness" colorSpace="hsl" defaultValue={BRAND_COLORS.purple}>
            <SliderParts label="Lightness" />
          </ColorSlider>
          <ColorSlider channel="alpha" defaultValue="rgba(110, 86, 231, 0.6)">
            <SliderParts label="Alpha" />
          </ColorSlider>
        </div>
        <div className="flex w-72 flex-col gap-4">
          <ColorSlider channel="red" colorSpace="rgb" defaultValue={BRAND_COLORS.orange}>
            <SliderParts label="Red" />
          </ColorSlider>
          <ColorSlider channel="green" colorSpace="rgb" defaultValue={BRAND_COLORS.orange}>
            <SliderParts label="Green" />
          </ColorSlider>
          <ColorSlider channel="blue" colorSpace="rgb" defaultValue={BRAND_COLORS.orange}>
            <SliderParts label="Blue" />
          </ColorSlider>
          <ColorSlider channel="hue" colorSpace="hsl" defaultValue={BRAND_COLORS.rose} isDisabled>
            <SliderParts label="Hue (disabled)" />
          </ColorSlider>
        </div>
        <V label="Vertical (no label)">
          <div className="flex h-48 gap-4">
            <ColorSlider aria-label="Hue" channel="hue" colorSpace="hsl" defaultValue={BRAND_COLORS.teal} orientation="vertical">
              <SliderParts />
            </ColorSlider>
            <ColorSlider aria-label="Saturation" channel="saturation" colorSpace="hsl" defaultValue={BRAND_COLORS.teal} orientation="vertical">
              <SliderParts />
            </ColorSlider>
            <ColorSlider aria-label="Lightness" channel="lightness" colorSpace="hsl" defaultValue={BRAND_COLORS.teal} orientation="vertical">
              <SliderParts />
            </ColorSlider>
          </div>
        </V>
      </Demo>

      <Demo name="ColorSwatch" hint="Sizes xs–xl · circle/square · transparency · brand presets" className="flex-col">
        <V label="Sizes (xs, sm, md, lg, xl)" className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
              <ColorSwatch key={size} color={BRAND_COLORS.purple} colorName={`Purple ${size}`} size={size} />
            ))}
          </div>
        </V>
        <V label="Shapes (circle, square)">
          <div className="flex items-center gap-3">
            <ColorSwatch color={BRAND_COLORS.blue} shape="circle" size="lg" />
            <ColorSwatch color={BRAND_COLORS.blue} shape="square" size="lg" />
          </div>
        </V>
        <V label="Transparency (100% → 0%)">
          <div className="flex items-center gap-3">
            {[1, 0.75, 0.5, 0.25, 0].map((a) => (
              <ColorSwatch key={a} aria-label={`${a * 100}% opacity`} color={`rgba(110, 86, 231, ${a})`} size="lg" />
            ))}
          </div>
        </V>
        <V label="Brand presets">
          <div className="flex flex-wrap items-center gap-3">
            {BRAND.map(([name, hex]) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <ColorSwatch color={hex} colorName={name} shape="square" size="lg" />
                <span className="font-mono text-[10px] text-muted">{name}</span>
              </div>
            ))}
          </div>
        </V>
      </Demo>

      <Demo name="ColorSwatchPicker" hint="variant circle/square · sizes xs–xl · layout grid/stack · selected · disabled items" className="flex-col">
        <V label="Circle (default) · selected">
          <ColorSwatchPicker aria-label="Brand color" defaultValue={BRAND_COLORS.purple}>
            <BrandSwatchItems />
          </ColorSwatchPicker>
        </V>
        <V label="Square">
          <ColorSwatchPicker aria-label="Brand color" defaultValue={BRAND_COLORS.teal} variant="square">
            <BrandSwatchItems />
          </ColorSwatchPicker>
        </V>
        <V label="Sizes">
          <div className="flex flex-col gap-3">
            {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
              <div key={size} className="flex items-center gap-4">
                <span className="w-6 font-mono text-xs text-muted">{size}</span>
                <ColorSwatchPicker aria-label={`Brand color ${size}`} defaultValue={BRAND_COLORS.blue} size={size}>
                  <BrandSwatchItems />
                </ColorSwatchPicker>
              </div>
            ))}
          </div>
        </V>
        <V label="Stack layout">
          <ColorSwatchPicker aria-label="Brand color" defaultValue={BRAND_COLORS.rose} layout="stack">
            <BrandSwatchItems />
          </ColorSwatchPicker>
        </V>
        <V label="Disabled items (last 4)">
          <ColorSwatchPicker aria-label="Brand color" defaultValue={BRAND_COLORS.green}>
            <BrandSwatchItems disabledFrom={6} />
          </ColorSwatchPicker>
        </V>
      </Demo>

      <Demo name="ColorField" hint="Group primary/secondary · swatch prefix · channel fields · required · invalid · disabled · read-only">
        <ColorField className="w-64" name="brand-color" value={brandColor} onChange={setBrandColor}>
          <Label>Brand color</Label>
          <ColorField.Group>
            <ColorField.Prefix>
              <ColorSwatch color={brandColor ?? undefined} size="xs" />
            </ColorField.Prefix>
            <ColorField.Input />
          </ColorField.Group>
          <Description>Controlled · swatch prefix</Description>
        </ColorField>
        <ColorField className="w-64" defaultValue={BRAND_COLORS.blue} name="accent-color">
          <Label>Accent color</Label>
          <ColorField.Group variant="secondary">
            <ColorField.Input />
          </ColorField.Group>
          <Description>Secondary group</Description>
        </ColorField>
        <div className="flex gap-3">
          {(["hue", "saturation", "lightness"] as const).map((channel) => (
            <ColorField
              key={channel}
              channel={channel}
              className="w-24"
              colorSpace="hsl"
              value={brandColor}
              onChange={setBrandColor}
            >
              <Label className="capitalize">{channel}</Label>
              <ColorField.Group>
                <ColorField.Input />
                {channel !== "hue" && (
                  <ColorField.Suffix>
                    <span className="text-sm text-muted">%</span>
                  </ColorField.Suffix>
                )}
              </ColorField.Group>
            </ColorField>
          ))}
        </div>
        <ColorField className="w-64" isRequired name="badge-color">
          <Label>Badge color</Label>
          <ColorField.Group>
            <ColorField.Input placeholder="#6e56e7" />
          </ColorField.Group>
          <Description>Required · placeholder</Description>
        </ColorField>
        <ColorField className="w-64" defaultValue="#f4f4f5" isInvalid name="bad-color">
          <Label>Background color</Label>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
          <FieldError>Too light: fails contrast on white</FieldError>
        </ColorField>
        <ColorField className="w-64" defaultValue={BRAND_COLORS.zinc} isDisabled name="locked-color">
          <Label>Locked color</Label>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
          <Description>Disabled</Description>
        </ColorField>
        <ColorField className="w-64" defaultValue={BRAND_COLORS.pink} isReadOnly name="ro-color">
          <Label>Theme color</Label>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
          <Description>Read-only</Description>
        </ColorField>
      </Demo>

      <Demo
        name="ColorInputGroup"
        hint="The shell behind ColorField.Group — variant · fullWidth · prefix/suffix; must sit inside a ColorField"
      >
        <ColorField aria-label="Brand color" className="w-64" defaultValue={BRAND_COLORS.purple}>
          <ColorInputGroup variant="primary">
            <ColorInputGroup.Input />
          </ColorInputGroup>
        </ColorField>
        <ColorField aria-label="Accent color" className="w-64" defaultValue={BRAND_COLORS.sky}>
          <ColorInputGroup variant="secondary">
            <ColorInputGroup.Input />
          </ColorInputGroup>
        </ColorField>
        <ColorField aria-label="Highlight color" className="w-64" defaultValue={BRAND_COLORS.amber}>
          <ColorInputGroup>
            <ColorInputGroup.Prefix>
              <ColorSwatch size="xs" />
            </ColorInputGroup.Prefix>
            <ColorInputGroup.Input />
            <ColorInputGroup.Suffix>
              <span className="text-xs text-muted">HEX</span>
            </ColorInputGroup.Suffix>
          </ColorInputGroup>
        </ColorField>
        <div className="w-full max-w-md">
          <ColorField aria-label="Full-width color" defaultValue={BRAND_COLORS.green} fullWidth>
            <ColorInputGroup fullWidth>
              <ColorInputGroup.Input />
            </ColorInputGroup>
          </ColorField>
        </div>
        <ColorField aria-label="Invalid color" className="w-64" defaultValue="#f4f4f5" isInvalid>
          <ColorInputGroup>
            <ColorInputGroup.Input />
          </ColorInputGroup>
        </ColorField>
        <ColorField aria-label="Disabled color" className="w-64" defaultValue={BRAND_COLORS.zinc} isDisabled>
          <ColorInputGroup>
            <ColorInputGroup.Input />
          </ColorInputGroup>
        </ColorField>
      </Demo>
    </Section>
  );
}
