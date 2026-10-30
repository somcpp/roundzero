"use client";

import type { ComponentProps } from "react";
import { DateField, DateRangePicker, Label, RangeCalendar } from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { fieldLabelClass } from "./controls";
import { cn } from "./ui";

type RangeChange = NonNullable<ComponentProps<typeof DateRangePicker>["onChange"]>;

/**
 * Start/end date picker. Submits ISO dates (yyyy-mm-dd) under `startName` and
 * `endName`, so server actions read them like plain date inputs.
 */
export function DateRangeField({
  label,
  startName,
  endName,
  defaultStart,
  defaultEnd,
  onChange,
  className,
}: {
  label: string;
  startName: string;
  endName: string;
  defaultStart?: string | null;
  defaultEnd?: string | null;
  onChange?: (start: string, end: string) => void;
  className?: string;
}) {
  const start = defaultStart ?? defaultEnd;
  const end = defaultEnd ?? defaultStart;
  const handleChange: RangeChange = (value) => onChange?.(value?.start.toString() ?? "", value?.end.toString() ?? "");

  return (
    <DateRangePicker
      className={cn("flex flex-col gap-1.5", className)}
      startName={startName}
      endName={endName}
      defaultValue={start && end ? { start: parseDate(start), end: parseDate(end) } : null}
      onChange={handleChange}
    >
      <Label className={fieldLabelClass}>{label}</Label>
      <DateField.Group fullWidth>
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
      <DateRangePicker.Popover>
        <RangeCalendar aria-label={label}>
          <RangeCalendar.Header>
            <RangeCalendar.YearPickerTrigger>
              <RangeCalendar.YearPickerTriggerHeading />
              <RangeCalendar.YearPickerTriggerIndicator />
            </RangeCalendar.YearPickerTrigger>
            <RangeCalendar.NavButton slot="previous" />
            <RangeCalendar.NavButton slot="next" />
          </RangeCalendar.Header>
          <RangeCalendar.Grid>
            <RangeCalendar.GridHeader>
              {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
            </RangeCalendar.GridHeader>
            <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
          </RangeCalendar.Grid>
          <RangeCalendar.YearPickerGrid>
            <RangeCalendar.YearPickerGridBody>
              {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
            </RangeCalendar.YearPickerGridBody>
          </RangeCalendar.YearPickerGrid>
        </RangeCalendar>
      </DateRangePicker.Popover>
    </DateRangePicker>
  );
}
