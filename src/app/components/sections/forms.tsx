"use client";

import { useState, type ReactNode } from "react";
import { Section, Demo } from "../demo";
import {
  Autocomplete,
  Button,
  Checkbox,
  CheckboxGroup,
  ComboBox,
  Description,
  EmptyState,
  ErrorMessage,
  FieldError,
  Fieldset,
  Form,
  Header,
  Input,
  InputGroup,
  InputOTP,
  Label,
  ListBox,
  NumberField,
  Radio,
  RadioGroup,
  SearchField,
  Select,
  Separator,
  Slider,
  Switch,
  SwitchGroup,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  useFilter,
} from "@heroui/react";

export const id = "forms";
export const title = "Forms";
export const components = [
  "TextField",
  "Input",
  "TextArea",
  "InputGroup",
  "SearchField",
  "NumberField",
  "InputOTP",
  "Label",
  "Description",
  "FieldError",
  "ErrorMessage",
  "Fieldset",
  "Form",
  "Checkbox",
  "CheckboxGroup",
  "Radio",
  "RadioGroup",
  "Switch",
  "SwitchGroup",
  "Slider",
  "Select",
  "ComboBox",
  "Autocomplete",
  "ListBox",
];

/* ------------------------------------------------------------------ */
/* Shared sample data + tiny layout helpers                            */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  { id: "ai", name: "Best use of AI" },
  { id: "design", name: "Best design" },
  { id: "technical", name: "Most technical" },
  { id: "impact", name: "Social impact" },
  { id: "pitch", name: "Best pitch" },
];

const TRACKS = [
  { id: "agents", name: "Agents & automation" },
  { id: "infra", name: "AI infrastructure" },
  { id: "devtools", name: "Developer tools" },
  { id: "consumer", name: "Consumer apps" },
];

/** Small caption above a variant/state cell. */
function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

function CategoryItems() {
  return CATEGORIES.map((c) => (
    <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
      {c.name}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  ));
}

function OtpSlots() {
  return (
    <>
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        <InputOTP.Slot index={3} />
        <InputOTP.Slot index={4} />
        <InputOTP.Slot index={5} />
      </InputOTP.Group>
    </>
  );
}

/** InputOTP (input-otp) warns on `defaultValue`, so pre-filled states are controlled. */
function FilledOtp({ initial, ...props }: { initial: string; isInvalid?: boolean; "aria-describedby"?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <InputOTP maxLength={6} value={value} onChange={setValue} {...props}>
      <OtpSlots />
    </InputOTP>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} className="size-3">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export default function FormsSection() {
  return (
    <Section id={id} title={title}>
      {/* ---------------------------------------------------------- */}
      <Demo name="TextField" hint="variant primary | secondary · description · required · invalid · disabled · read-only">
        <TextField className="w-64" name="project">
          <Label>Project name</Label>
          <Input placeholder="e.g. JudgeBot" />
          <Description>Shown on the leaderboard</Description>
        </TextField>
        <TextField className="w-64" name="project-2" variant="secondary">
          <Label>Project name (secondary)</Label>
          <Input placeholder="e.g. JudgeBot" />
          <Description>Lower-emphasis, for surfaces</Description>
        </TextField>
        <TextField isRequired className="w-64" defaultValue="Team Nebula" name="team">
          <Label>Team name</Label>
          <Input />
          <Description>Required · filled</Description>
        </TextField>
        <TextField isInvalid className="w-64" defaultValue="judge@" name="email" type="email">
          <Label>Judge email</Label>
          <Input />
          <FieldError>Enter a valid email address</FieldError>
        </TextField>
        <TextField isDisabled className="w-64" defaultValue="HACK-2026-042" name="submission">
          <Label>Submission ID</Label>
          <Input />
          <Description>Disabled</Description>
        </TextField>
        <TextField isReadOnly className="w-64" defaultValue="https://github.com/nebula/judgebot" name="repo">
          <Label>Repository</Label>
          <Input />
          <Description>Read-only</Description>
        </TextField>
        <TextField className="w-64" name="notes">
          <Label>Judge notes</Label>
          <TextArea placeholder="What stood out?" rows={3} />
          <Description>TextField + TextArea</Description>
        </TextField>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Input" hint="standalone · variant primary | secondary · placeholder · filled · disabled · fullWidth">
        <Cell label="primary">
          <Input aria-label="Project name" className="w-64" placeholder="Project name" />
        </Cell>
        <Cell label="secondary">
          <Input aria-label="Project name" className="w-64" placeholder="Project name" variant="secondary" />
        </Cell>
        <Cell label="filled">
          <Input aria-label="Project name" className="w-64" defaultValue="JudgeBot" />
        </Cell>
        <Cell label="disabled">
          <Input disabled aria-label="Project name" className="w-64" defaultValue="JudgeBot" />
        </Cell>
        <Cell label="fullWidth" className="w-full">
          <Input fullWidth aria-label="Demo URL" placeholder="https://your-demo.vercel.app" />
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="TextArea" hint="standalone · variant primary | secondary · filled · invalid · disabled">
        <Cell label="primary">
          <TextArea aria-label="Feedback" className="w-64" placeholder="Feedback for the team…" rows={3} />
        </Cell>
        <Cell label="secondary">
          <TextArea aria-label="Feedback" className="w-64" placeholder="Feedback for the team…" rows={3} variant="secondary" />
        </Cell>
        <Cell label="filled">
          <TextArea
            aria-label="Feedback"
            className="w-64"
            defaultValue="Great demo. The agent loop was clear, but latency hurt the live run."
            rows={3}
          />
        </Cell>
        <Cell label="invalid (in TextField)">
          <TextField isInvalid className="w-64" defaultValue="Nice" name="feedback">
            <Label>Feedback</Label>
            <TextArea rows={3} />
            <FieldError>At least 20 characters</FieldError>
          </TextField>
        </Cell>
        <Cell label="disabled">
          <TextArea disabled aria-label="Feedback" className="w-64" defaultValue="Locked after scoring closed." rows={3} />
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="InputGroup" hint="prefix · suffix · variant primary | secondary · invalid · disabled · TextArea">
        <TextField className="w-64" name="demo-url">
          <Label>Demo URL</Label>
          <InputGroup>
            <InputGroup.Prefix>https://</InputGroup.Prefix>
            <InputGroup.Input placeholder="judgebot.dev" />
          </InputGroup>
        </TextField>
        <TextField className="w-64" name="demo-url-2">
          <Label>Demo URL (secondary)</Label>
          <InputGroup variant="secondary">
            <InputGroup.Prefix>https://</InputGroup.Prefix>
            <InputGroup.Input placeholder="judgebot.dev" />
          </InputGroup>
        </TextField>
        <TextField className="w-64" defaultValue="250" name="prize">
          <Label>Prize amount</Label>
          <InputGroup>
            <InputGroup.Prefix>$</InputGroup.Prefix>
            <InputGroup.Input type="number" />
            <InputGroup.Suffix>USD</InputGroup.Suffix>
          </InputGroup>
          <Description>Prefix + suffix</Description>
        </TextField>
        <TextField isInvalid className="w-64" defaultValue="nebula" name="handle">
          <Label>GitHub handle</Label>
          <InputGroup>
            <InputGroup.Prefix>@</InputGroup.Prefix>
            <InputGroup.Input />
          </InputGroup>
          <FieldError>User not found</FieldError>
        </TextField>
        <TextField isDisabled className="w-64" defaultValue="42" name="time">
          <Label>Demo length</Label>
          <InputGroup>
            <InputGroup.Input type="number" />
            <InputGroup.Suffix>min</InputGroup.Suffix>
          </InputGroup>
        </TextField>
        <TextField className="w-64" name="pitch">
          <Label>Pitch</Label>
          <InputGroup>
            <InputGroup.TextArea placeholder="One-line pitch…" rows={2} />
            <InputGroup.Suffix>
              <span className="text-xs text-muted">0/140</span>
            </InputGroup.Suffix>
          </InputGroup>
        </TextField>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="SearchField" hint="variant primary | secondary · filled (clear button) · invalid · disabled">
        <SearchField className="w-64" name="search">
          <Label>Search projects</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <SearchField className="w-64" name="search-2" variant="secondary">
          <Label>Search (secondary)</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <SearchField className="w-64" defaultValue="agents" name="search-3">
          <Label>Filled</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input />
            <SearchField.ClearButton />
          </SearchField.Group>
          <Description>12 matching projects</Description>
        </SearchField>
        <SearchField isInvalid className="w-64" defaultValue="a" name="search-4">
          <Label>Invalid</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input />
            <SearchField.ClearButton />
          </SearchField.Group>
          <FieldError>Type at least 2 characters</FieldError>
        </SearchField>
        <SearchField isDisabled className="w-64" name="search-5">
          <Label>Disabled</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="NumberField" hint="variant primary | secondary · steppers · percent format · invalid · disabled · read-only">
        <NumberField className="w-48" defaultValue={7} maxValue={10} minValue={1} name="score">
          <Label>Score (1–10)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
          <Description>Primary</Description>
        </NumberField>
        <NumberField className="w-48" defaultValue={7} maxValue={10} minValue={1} name="score-2" variant="secondary">
          <Label>Score (secondary)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField
          className="w-48"
          defaultValue={0.25}
          formatOptions={{ style: "percent" }}
          maxValue={1}
          minValue={0}
          name="weight"
          step={0.05}
        >
          <Label>Criterion weight</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
          <Description>Percent format</Description>
        </NumberField>
        <NumberField isInvalid className="w-48" defaultValue={12} name="score-3">
          <Label>Score (1–10)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
          <FieldError>Must be between 1 and 10</FieldError>
        </NumberField>
        <NumberField isDisabled className="w-48" defaultValue={8} name="score-4">
          <Label>Disabled</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
        </NumberField>
        <NumberField isReadOnly className="w-48" defaultValue={8.4} name="avg">
          <Label>Average (read-only)</Label>
          <NumberField.Group>
            <NumberField.Input />
          </NumberField.Group>
          <Description>Input only, no steppers</Description>
        </NumberField>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="InputOTP" hint="variant primary | secondary · filled · 4-digit · invalid · disabled">
        <Cell label="primary">
          <Label>Judge access code</Label>
          <InputOTP maxLength={6}>
            <OtpSlots />
          </InputOTP>
        </Cell>
        <Cell label="secondary">
          <Label>Judge access code</Label>
          <InputOTP maxLength={6} variant="secondary">
            <OtpSlots />
          </InputOTP>
        </Cell>
        <Cell label="filled">
          <Label>Judge access code</Label>
          <FilledOtp initial="4821" />
        </Cell>
        <Cell label="4-digit">
          <Label>Room PIN</Label>
          <InputOTP maxLength={4}>
            <InputOTP.Group>
              <InputOTP.Slot index={0} />
              <InputOTP.Slot index={1} />
              <InputOTP.Slot index={2} />
              <InputOTP.Slot index={3} />
            </InputOTP.Group>
          </InputOTP>
        </Cell>
        <Cell label="invalid">
          <Label isInvalid>Judge access code</Label>
          <FilledOtp isInvalid aria-describedby="otp-error" initial="123456" />
          {/* InputOTP isn't a RAC field, so FieldError won't render; docs use the raw class instead. */}
          <span className="field-error" data-visible="true" id="otp-error">
            Invalid code. Try again.
          </span>
        </Cell>
        <Cell label="disabled">
          <Label isDisabled>Judge access code</Label>
          <InputOTP isDisabled maxLength={6}>
            <OtpSlots />
          </InputOTP>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Label" hint="default · isRequired · isInvalid · isDisabled">
        <Cell label="default">
          <Label>Project name</Label>
        </Cell>
        <Cell label="isRequired">
          <Label isRequired>Judge email</Label>
        </Cell>
        <Cell label="isInvalid">
          <Label isInvalid>Score (1–10)</Label>
        </Cell>
        <Cell label="isDisabled">
          <Label isDisabled>Submission ID</Label>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Description" hint="standalone · under a field">
        <Cell label="standalone">
          <Description>Scores are hidden from teams until results are published.</Description>
        </Cell>
        <Cell label="in TextField">
          <TextField className="w-64" name="desc-demo">
            <Label>Project name</Label>
            <Input placeholder="e.g. JudgeBot" />
            <Description>Max 40 characters</Description>
          </TextField>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="FieldError" hint="only renders when the parent field is invalid">
        <TextField isInvalid className="w-64" name="fe-1">
          <Label>Judge email</Label>
          <Input placeholder="you@example.com" />
          <FieldError>Email is required</FieldError>
        </TextField>
        <NumberField isInvalid className="w-48" defaultValue={0} name="fe-2">
          <Label>Score (1–10)</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input />
            <NumberField.IncrementButton />
          </NumberField.Group>
          <FieldError>Score must be at least 1</FieldError>
        </NumberField>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="ErrorMessage" hint="for non-form collections (TagGroup, Calendar) · standalone">
        <Cell label="in TagGroup">
          <TagGroup selectionMode="multiple">
            <Label>Categories</Label>
            <TagGroup.List>
              {CATEGORIES.slice(0, 3).map((c) => (
                <Tag key={c.id} id={c.id}>
                  {c.name}
                </Tag>
              ))}
            </TagGroup.List>
            <ErrorMessage>Select at least one category</ErrorMessage>
          </TagGroup>
        </Cell>
        <Cell label="standalone">
          <ErrorMessage>Scoring window has closed</ErrorMessage>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Fieldset" hint="Legend · Description · Group · Actions" className="flex-col">
        <Fieldset className="w-full max-w-md">
          <Fieldset.Legend>Team details</Fieldset.Legend>
          <Description>Shown to judges alongside your submission.</Description>
          <Fieldset.Group>
            <TextField isRequired name="fs-team">
              <Label>Team name</Label>
              <Input placeholder="Team Nebula" />
            </TextField>
            <TextField name="fs-members">
              <Label>Members</Label>
              <TextArea placeholder="One per line" rows={2} />
              <Description>Up to 5 people</Description>
            </TextField>
          </Fieldset.Group>
          <Fieldset.Actions>
            <Button>Save</Button>
            <Button variant="secondary">Cancel</Button>
          </Fieldset.Actions>
        </Fieldset>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Form" hint="validationErrors (server) · native validation on submit">
        <Form
          className="flex w-80 flex-col gap-4"
          validationErrors={{ email: "This judge is already registered" }}
          onSubmit={(e) => e.preventDefault()}
        >
          <TextField isRequired defaultValue="ada@nebius.com" name="email" type="email">
            <Label>Judge email</Label>
            <Input />
            <FieldError />
          </TextField>
          <NumberField isRequired maxValue={10} minValue={1} name="score">
            <Label>Score (1–10)</Label>
            <NumberField.Group>
              <NumberField.DecrementButton />
              <NumberField.Input />
              <NumberField.IncrementButton />
            </NumberField.Group>
            <Description>Submit empty to see required validation</Description>
            <FieldError />
          </NumberField>
          <div className="flex gap-2">
            <Button type="submit">Submit score</Button>
            <Button type="reset" variant="secondary">
              Reset
            </Button>
          </div>
        </Form>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Checkbox" hint="variant primary | secondary · selected · indeterminate · invalid · disabled · read-only">
        <Cell label="primary">
          <Checkbox name="cb-1">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              I have no conflict of interest
            </Checkbox.Content>
          </Checkbox>
        </Cell>
        <Cell label="secondary">
          <Checkbox name="cb-2" variant="secondary">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              I have no conflict of interest
            </Checkbox.Content>
          </Checkbox>
        </Cell>
        <Cell label="selected">
          <Checkbox defaultSelected name="cb-3">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Demo watched
            </Checkbox.Content>
          </Checkbox>
        </Cell>
        <Cell label="indeterminate">
          <Checkbox isIndeterminate name="cb-4">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              All criteria scored
            </Checkbox.Content>
          </Checkbox>
        </Cell>
        <Cell label="with description">
          <Checkbox defaultSelected name="cb-5">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Email me results
            </Checkbox.Content>
            <Description>Sent when judging closes</Description>
          </Checkbox>
        </Cell>
        <Cell label="invalid">
          <Checkbox isInvalid name="cb-6">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Accept judging rules
            </Checkbox.Content>
            <FieldError>Required to continue</FieldError>
          </Checkbox>
        </Cell>
        <Cell label="disabled">
          <Checkbox isDisabled name="cb-7">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Finalist
            </Checkbox.Content>
          </Checkbox>
          <Checkbox defaultSelected isDisabled name="cb-8">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Submitted
            </Checkbox.Content>
          </Checkbox>
        </Cell>
        <Cell label="read-only">
          <Checkbox defaultSelected isReadOnly name="cb-9">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Eligible for prizes
            </Checkbox.Content>
          </Checkbox>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="CheckboxGroup" hint="variant primary | secondary · per-item description · invalid · disabled">
        <CheckboxGroup className="w-56" defaultValue={["ai", "design"]} name="cats-1">
          <Label>Categories</Label>
          <Description>Pick all that apply</Description>
          {CATEGORIES.slice(0, 3).map((c) => (
            <Checkbox key={c.id} value={c.id}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {c.name}
              </Checkbox.Content>
            </Checkbox>
          ))}
        </CheckboxGroup>
        <CheckboxGroup className="w-56" defaultValue={["ai"]} name="cats-2" variant="secondary">
          <Label>Secondary</Label>
          <Checkbox value="ai">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Best use of AI
            </Checkbox.Content>
            <Description>Model does real work</Description>
          </Checkbox>
          <Checkbox value="design">
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Best design
            </Checkbox.Content>
            <Description>Polish and UX</Description>
          </Checkbox>
        </CheckboxGroup>
        <CheckboxGroup isInvalid className="w-56" name="cats-3">
          <Label>Invalid</Label>
          {CATEGORIES.slice(0, 2).map((c) => (
            <Checkbox key={c.id} value={c.id}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {c.name}
              </Checkbox.Content>
            </Checkbox>
          ))}
          <FieldError>Select at least one category</FieldError>
        </CheckboxGroup>
        <CheckboxGroup isDisabled className="w-56" defaultValue={["ai"]} name="cats-4">
          <Label>Disabled</Label>
          {CATEGORIES.slice(0, 2).map((c) => (
            <Checkbox key={c.id} value={c.id}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                {c.name}
              </Checkbox.Content>
            </Checkbox>
          ))}
        </CheckboxGroup>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Radio" hint="unselected · selected · disabled · with description (must live in a RadioGroup)">
        <RadioGroup aria-label="Radio states" defaultValue="selected" name="radio-states">
          <Radio value="unselected">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Unselected
            </Radio.Content>
          </Radio>
          <Radio value="selected">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Selected
            </Radio.Content>
          </Radio>
          <Radio isDisabled value="disabled">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              Disabled
            </Radio.Content>
          </Radio>
          <Radio value="described">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              With description
            </Radio.Content>
            <Description>Helper text sits outside the hit area</Description>
          </Radio>
        </RadioGroup>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="RadioGroup" hint="variant primary | secondary · horizontal · invalid · disabled · read-only">
        <RadioGroup className="w-56" defaultValue="agents" name="track-1">
          <Label>Track</Label>
          <Description>Primary</Description>
          {TRACKS.slice(0, 3).map((t) => (
            <Radio key={t.id} value={t.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t.name}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <RadioGroup className="w-56" defaultValue="agents" name="track-2" variant="secondary">
          <Label>Track (secondary)</Label>
          {TRACKS.slice(0, 3).map((t) => (
            <Radio key={t.id} value={t.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t.name}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <RadioGroup isInvalid className="w-56" name="track-3">
          <Label>Invalid</Label>
          {TRACKS.slice(0, 2).map((t) => (
            <Radio key={t.id} value={t.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t.name}
              </Radio.Content>
            </Radio>
          ))}
          <FieldError>Choose a track</FieldError>
        </RadioGroup>
        <RadioGroup isDisabled className="w-56" defaultValue="infra" name="track-4">
          <Label>Disabled</Label>
          {TRACKS.slice(0, 2).map((t) => (
            <Radio key={t.id} value={t.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t.name}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <RadioGroup isReadOnly className="w-56" defaultValue="agents" name="track-5">
          <Label>Read-only</Label>
          {TRACKS.slice(0, 2).map((t) => (
            <Radio key={t.id} value={t.id}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {t.name}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        <RadioGroup className="w-full" defaultValue="7" name="score-radio" orientation="horizontal">
          <Label>Score (horizontal)</Label>
          {["1", "3", "5", "7", "10"].map((v) => (
            <Radio key={v} value={v}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                {v}
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Switch" hint="size sm | md | lg · selected · with icon · description · disabled · read-only">
        <Cell label="sizes (off)">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Switch key={size} size={size}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                {size}
              </Switch.Content>
            </Switch>
          ))}
        </Cell>
        <Cell label="sizes (on)">
          {(["sm", "md", "lg"] as const).map((size) => (
            <Switch key={size} defaultSelected size={size}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                {size}
              </Switch.Content>
            </Switch>
          ))}
        </Cell>
        <Cell label="with icon">
          <Switch defaultSelected size="lg">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb>
                  <Switch.Icon>
                    <CheckIcon />
                  </Switch.Icon>
                </Switch.Thumb>
              </Switch.Control>
              Scoring open
            </Switch.Content>
          </Switch>
        </Cell>
        <Cell label="with description" className="w-56">
          <Switch defaultSelected>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Blind judging
            </Switch.Content>
            <Description>Hide team names from judges</Description>
          </Switch>
        </Cell>
        <Cell label="disabled">
          <Switch isDisabled>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Public results
            </Switch.Content>
          </Switch>
          <Switch defaultSelected isDisabled>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Registration
            </Switch.Content>
          </Switch>
        </Cell>
        <Cell label="read-only">
          <Switch defaultSelected isReadOnly>
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              Finalized
            </Switch.Content>
          </Switch>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="SwitchGroup" hint="orientation vertical | horizontal">
        <Cell label="vertical">
          <SwitchGroup>
            <Switch defaultSelected name="notify-scores">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                New score submitted
              </Switch.Content>
            </Switch>
            <Switch name="notify-ties">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Tie detected
              </Switch.Content>
            </Switch>
            <Switch name="notify-close">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Judging closes
              </Switch.Content>
            </Switch>
          </SwitchGroup>
        </Cell>
        <Cell label="horizontal">
          <SwitchGroup orientation="horizontal">
            <Switch defaultSelected name="show-scores">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Scores
              </Switch.Content>
            </Switch>
            <Switch name="show-notes">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Notes
              </Switch.Content>
            </Switch>
            <Switch name="show-ranks">
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Ranks
              </Switch.Content>
            </Switch>
          </SwitchGroup>
        </Cell>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Slider" hint="single · range · formatted · disabled · vertical">
        <Slider className="w-64" defaultValue={7} maxValue={10} minValue={1}>
          <Label>Score (1–10)</Label>
          <Slider.Output />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <Slider className="w-64" defaultValue={[4, 8]} maxValue={10} minValue={1}>
          <Label>Score range</Label>
          <Slider.Output />
          <Slider.Track>
            {({ state }) => (
              <>
                <Slider.Fill />
                {state.values.map((_, i) => (
                  <Slider.Thumb key={i} index={i} />
                ))}
              </>
            )}
          </Slider.Track>
        </Slider>
        <Slider className="w-64" defaultValue={0.3} formatOptions={{ style: "percent" }} maxValue={1} minValue={0} step={0.05}>
          <Label>Criterion weight</Label>
          <Slider.Output />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <Slider isDisabled className="w-64" defaultValue={5} maxValue={10} minValue={1}>
          <Label>Disabled</Label>
          <Slider.Output />
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <div className="flex h-40">
          <Slider className="h-full" defaultValue={60} orientation="vertical">
            <Label>Vertical</Label>
            <Slider.Output />
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </div>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="Select" hint="variant primary | secondary · placeholder · selected + clear · multiple · sections · invalid · disabled">
        <Select className="w-64" placeholder="Choose a category">
          <Label>Category</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </Select.Popover>
        </Select>
        <Select className="w-64" placeholder="Choose a category" variant="secondary">
          <Label>Category (secondary)</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </Select.Popover>
        </Select>
        <Select className="w-64" defaultValue="ai" placeholder="Choose a category">
          <Label>Selected + clear button</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.ClearButton />
            <Select.Indicator />
          </Select.Trigger>
          <Description>Backspace also clears</Description>
          <Select.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </Select.Popover>
        </Select>
        <Select className="w-64" defaultValue={["ai", "technical"]} placeholder="Choose categories" selectionMode="multiple">
          <Label>Multiple</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox selectionMode="multiple">
              <CategoryItems />
            </ListBox>
          </Select.Popover>
        </Select>
        <Select className="w-64" disabledKeys={["consumer"]} placeholder="Choose a track">
          <Label>Sections + disabled option</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Section>
                <Header>Technical</Header>
                {TRACKS.slice(0, 3).map((t) => (
                  <ListBox.Item key={t.id} id={t.id} textValue={t.name}>
                    {t.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
              <Separator />
              <ListBox.Section>
                <Header>Product</Header>
                <ListBox.Item id="consumer" textValue="Consumer apps">
                  Consumer apps
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox.Section>
            </ListBox>
          </Select.Popover>
        </Select>
        <Select isInvalid className="w-64" placeholder="Choose a category">
          <Label>Invalid</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <FieldError>Pick a category</FieldError>
          <Select.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </Select.Popover>
        </Select>
        <Select isDisabled className="w-64" defaultValue="design" placeholder="Choose a category">
          <Label>Disabled</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </Select.Popover>
        </Select>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <Demo name="ComboBox" hint="variant primary | secondary · selected · multiple · invalid · disabled">
        <ComboBox className="w-64">
          <Label>Category</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Type to filter…" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <ComboBox className="w-64" variant="secondary">
          <Label>Category (secondary)</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Type to filter…" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <ComboBox className="w-64" defaultSelectedKey="technical">
          <Label>Selected</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Type to filter…" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <Description>defaultSelectedKey</Description>
          <ComboBox.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <ComboBox className="w-64" defaultValue={["ai", "pitch"]} selectionMode="multiple">
          <Label>Multiple</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Add categories…" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Value placeholder="No categories selected" />
          <ComboBox.Popover>
            <ListBox selectionMode="multiple">
              <CategoryItems />
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <ComboBox isInvalid className="w-64">
          <Label>Invalid</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Type to filter…" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <FieldError>Pick a category from the list</FieldError>
          <ComboBox.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
        <ComboBox isDisabled className="w-64" defaultSelectedKey="design">
          <Label>Disabled</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Type to filter…" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              <CategoryItems />
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
      </Demo>

      {/* ---------------------------------------------------------- */}
      <AutocompleteDemo />

      {/* ---------------------------------------------------------- */}
      <Demo name="ListBox" hint="single · multiple · sections · item variant danger · disabled item · with description">
        <Cell label="single select">
          <ListBox
            aria-label="Category"
            className="w-56 rounded-xl border border-border p-1"
            defaultSelectedKeys={["ai"]}
            disabledKeys={["pitch"]}
            selectionMode="single"
          >
            <CategoryItems />
          </ListBox>
        </Cell>
        <Cell label="multiple">
          <ListBox
            aria-label="Categories"
            className="w-56 rounded-xl border border-border p-1"
            defaultSelectedKeys={["ai", "technical"]}
            selectionMode="multiple"
          >
            <CategoryItems />
          </ListBox>
        </Cell>
        <Cell label="sections · description · danger">
          <ListBox aria-label="Submission actions" className="w-64 rounded-xl border border-border p-1" selectionMode="none">
            <ListBox.Section>
              <Header>Submission</Header>
              <ListBox.Item id="open" textValue="Open project">
                <div className="flex flex-col">
                  <Label>Open project</Label>
                  <Description>View repo and demo</Description>
                </div>
              </ListBox.Item>
              <ListBox.Item id="flag" textValue="Flag for review">
                <div className="flex flex-col">
                  <Label>Flag for review</Label>
                  <Description>Ask another judge</Description>
                </div>
              </ListBox.Item>
            </ListBox.Section>
            <Separator />
            <ListBox.Section>
              <Header>Danger zone</Header>
              <ListBox.Item id="disqualify" textValue="Disqualify" variant="danger">
                <div className="flex flex-col">
                  <Label>Disqualify</Label>
                  <Description>Removes from ranking</Description>
                </div>
              </ListBox.Item>
            </ListBox.Section>
          </ListBox>
        </Cell>
        <Cell label="variant danger (list)">
          <ListBox aria-label="Destructive" className="w-56 rounded-xl border border-border p-1" selectionMode="none" variant="danger">
            <ListBox.Item id="reset" textValue="Reset all scores">
              Reset all scores
            </ListBox.Item>
            <ListBox.Item id="delete" textValue="Delete event">
              Delete event
            </ListBox.Item>
          </ListBox>
        </Cell>
      </Demo>
    </Section>
  );
}

/** Autocomplete needs the `useFilter` hook, so it lives in its own component. */
function AutocompleteDemo() {
  const { contains } = useFilter({ sensitivity: "base" });

  const popover = (
    <Autocomplete.Popover>
      <Autocomplete.Filter filter={contains}>
        <SearchField autoFocus aria-label="Search categories" name="search" variant="secondary">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder="Search…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <ListBox renderEmptyState={() => <EmptyState>No categories found</EmptyState>}>
          <CategoryItems />
        </ListBox>
      </Autocomplete.Filter>
    </Autocomplete.Popover>
  );

  const trigger = (
    <Autocomplete.Trigger>
      <Autocomplete.Value />
      <Autocomplete.ClearButton />
      <Autocomplete.Indicator />
    </Autocomplete.Trigger>
  );

  return (
    <Demo name="Autocomplete" hint="variant primary | secondary · selected · multiple · invalid · disabled (search lives in the popover)">
      <Autocomplete className="w-64" placeholder="Choose a category" selectionMode="single">
        <Label>Category</Label>
        {trigger}
        {popover}
      </Autocomplete>
      <Autocomplete className="w-64" placeholder="Choose a category" selectionMode="single" variant="secondary">
        <Label>Category (secondary)</Label>
        {trigger}
        {popover}
      </Autocomplete>
      <Autocomplete className="w-64" defaultValue="impact" placeholder="Choose a category" selectionMode="single">
        <Label>Selected</Label>
        {trigger}
        <Description>With clear button</Description>
        {popover}
      </Autocomplete>
      <Autocomplete
        className="w-64"
        defaultValue={["ai", "design"]}
        placeholder="Choose categories"
        selectionMode="multiple"
      >
        <Label>Multiple</Label>
        {trigger}
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus aria-label="Search categories" name="search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search…" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox selectionMode="multiple">
              <CategoryItems />
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
      <Autocomplete isInvalid className="w-64" placeholder="Choose a category" selectionMode="single">
        <Label>Invalid</Label>
        {trigger}
        <FieldError>Pick a category</FieldError>
        {popover}
      </Autocomplete>
      <Autocomplete isDisabled className="w-64" defaultValue="ai" placeholder="Choose a category" selectionMode="single">
        <Label>Disabled</Label>
        {trigger}
        {popover}
      </Autocomplete>
    </Demo>
  );
}
