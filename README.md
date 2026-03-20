# `@moly-edu/widget-sdk`

[![npm version](https://img.shields.io/npm/v/@moly-edu/widget-sdk.svg)](https://www.npmjs.com/package/@moly-edu/widget-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@moly-edu/widget-sdk.svg)](https://www.npmjs.com/package/@moly-edu/widget-sdk)

A React-first SDK for building iframe-based learning widgets that are configured by a host app.

## Installation

```bash
npm i @moly-edu/widget-sdk
```

## Quick Start

## 1. Define your widget contract

```ts
import {
  defineWidget,
  param,
  folder,
  when,
  and,
  type ExtractParams,
  type ExtractAnswer,
} from "@moly-edu/widget-sdk";

export const widgetDefinition = defineWidget({
  parameters: {
    question: param.string("Solve the addition problem").label("Question"),

    difficulty: param
      .select(["easy", "medium", "hard"], "medium")
      .label("Difficulty")
      .random(),

    target: param
      .number(10)
      .label("Target")
      .description("Derived from difficulty")
      .min(1)
      .max(100)
      .readOnly(),

    settings: folder("Settings", {
      showFeedback: param.boolean(true).label("Show feedback"),
      feedbackCorrect: param
        .string("Great job!")
        .label("Correct feedback")
        .visibleIf(when("settings.showFeedback").equals(true)),
      showHint: param
        .boolean(false)
        .label("Show hint")
        .visibleIf(
          and(
            when("settings.showFeedback").equals(true),
            when("difficulty").notEquals("easy"),
          ),
        ),
    }).expanded(false),
  },

  deriveDefaults: (defaults, { randomInt }) => {
    switch (defaults.difficulty) {
      case "easy":
        return { target: randomInt(5, 15) };
      case "hard":
        return { target: randomInt(50, 100) };
      default:
        return { target: randomInt(15, 50) };
    }
  },

  answer: {
    value: param.string(""),
  },
});

export type WidgetParams = ExtractParams<typeof widgetDefinition>;
export type WidgetAnswer = ExtractAnswer<typeof widgetDefinition>;
```

## 2. Mount the widget

```ts
import { createWidget } from "@moly-edu/widget-sdk";
import { widgetDefinition } from "./definition";
import { WidgetComponent } from "./components/WidgetComponent";

createWidget({
  definition: widgetDefinition,
  component: WidgetComponent,
});
```

## 3. Use params and submission in React

```tsx
import { useWidgetParams, useSubmission } from "@moly-edu/widget-sdk";
import type { WidgetParams, WidgetAnswer } from "./definition";

export function WidgetComponent() {
  const params = useWidgetParams<WidgetParams>();
  const correctAnswer = 42;

  const {
    answer,
    setAnswer,
    result,
    submit,
    canSubmit,
    isLocked,
    isSubmitting,
  } = useSubmission<WidgetAnswer>({
    evaluate: (ans) => {
      const isCorrect = ans.value === String(correctAnswer);
      return {
        isCorrect,
        score: isCorrect ? 100 : 0,
        maxScore: 100,
      };
    },
  });

  return (
    <div>
      <h2>{params.question}</h2>
      <input
        value={answer?.value ?? ""}
        onChange={(e) => setAnswer({ value: e.target.value })}
        disabled={isLocked}
      />
      <button onClick={submit} disabled={!canSubmit || isSubmitting}>
        Submit
      </button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

## Parameter API

Factory methods:

- `param.string(defaultValue?)`
- `param.number(defaultValue?)`
- `param.boolean(defaultValue?)`
- `param.color(defaultValue?)`
- `param.image(defaultValue?)`
- `param.select(options, defaultValue?)`

Number modifiers:

- `.min(value)`
- `.max(value)`
- `.step(value)`

Image modifier:

- `.placeholder(text)`

Common modifiers:

- `.label(text)`
- `.description(text)`
- `.required()`
- `.visibleIf(condition)`
- `.random()`
- `.random((utils) => value)`
- `.readOnly()`
- `.hidden()`

Folder groups:

```ts
import { folder, param, when } from "@moly-edu/widget-sdk";

const advanced = folder("Advanced", {
  speed: param.number(1).min(1).max(10),
})
  .expanded(false)
  .visibleIf(when("mode").equals("advanced"));
```

## Visibility Conditions

Use `when`, `and`, `or`:

```ts
import { when, and, or } from "@moly-edu/widget-sdk";

when("mode").equals("fill");
when("score").gt(80);
when("level").in(["easy", "medium"]);

and(
  when("settings.enabled").equals(true),
  when("difficulty").notEquals("easy"),
);

or(when("mode").equals("fill"), when("mode").equals("choice"));
```

Supported operators:

- `equals`
- `notEquals`
- `in`
- `gt`
- `gte`
- `lt`
- `lte`

## Random Defaults and deriveDefaults

When `createWidget(...)` runs, defaults are resolved in this order:

1. Extract static defaults from schema.
2. Apply `.random()` rules.
3. Apply `deriveDefaults(defaults, utils)` overrides.

Utilities available in random/derive:

- `randomInt(min, max)`
- `randomFloat(min, max)`
- `randomChoice(items)`

You can also call `resolveDefaults(...)` directly for testing.

## React Hooks

## `useWidgetParams<T>()`

Returns the latest params from host.

## `useSubmission<TAnswer>({ evaluate })`

Manages answer state, computes evaluation, and submits to host.

Returns:

- `answer`
- `setAnswer`
- `result`
- `submit`
- `isLocked` (review mode)
- `canSubmit`
- `isSubmitting`

## `useWidgetState` (legacy)

Backward-compatible helper hook.

## Speak Component (Host-Managed TTS)

The SDK exports `Speak` for read-aloud UI.
Important: the widget does not call your TTS API directly.
It sends a TTS request to host via bridge messages, and host handles synthesis + playback.

```tsx
import { Speak } from "@moly-edu/widget-sdk";

<Speak>Read this text</Speak>
<Speak text="Custom sentence" showIcon="always" iconSize={18}>
  <span>Tap speaker</span>
</Speak>
```

Props:

- `text?`
- `lang?` (default `vi-VN`)
- `rate?`
- `timeoutMs?`
- `showIcon?` = `auto | always | hover`
- `iconSize?`

Mobile behavior:

- `showIcon="auto"` shows the icon by default on touch/coarse-pointer devices.

## Host-Widget Message Protocol

Widget -> Host:

- `WIDGET_READY` with payload `{ schema, resolvedDefaults }`
- `SUBMIT` with payload `{ answer, evaluation }`
- `EVENT` with custom payload
- `TTS_SYNTHESIZE` with payload `{ requestId, text, lang?, rate? }`
- `TTS_STOP`

Host -> Widget:

- `PARAMS_UPDATE` with payload config (optional `__answer` for review mode)
- `TTS_SYNTHESIZE_RESULT` with payload `{ requestId, ok, error? }`

Notes:

- `__answer` enables review mode in widget runtime.
- Host should validate message source (current iframe) before processing.

## WidgetRuntime (Advanced)

Most apps should use hooks, but these methods are available:

- `WidgetRuntime.emitEvent(eventName, data?)`
- `WidgetRuntime.requestTtsSpeak({ text, lang?, rate?, timeoutMs? })`
- `WidgetRuntime.stopTts()`

## Development Scripts

In widget-sdk:

```bash
npm run dev
npm run build
```

## Vite + file: Dependency Note

If you see duplicate React hook errors such as Invalid hook call, add this to the widget app Vite config:

```ts
resolve: {
  dedupe: ["react", "react-dom"],
}
```

## Current Exports

From core:

- `defineWidget`
- `param`
- `folder`
- `when`
- `and`
- `or`
- `resolveDefaults`
- `WidgetRuntime`
- random utilities and types

From widget:

- `createWidget`
- `useWidgetParams`
- `useSubmission`
- `useWidgetState`

From speak:

- `Speak`
- `SpeakProps`
