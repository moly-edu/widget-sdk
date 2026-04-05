# @moly-edu/widget-sdk

[![npm version](https://img.shields.io/npm/v/@moly-edu/widget-sdk.svg)](https://www.npmjs.com/package/@moly-edu/widget-sdk)
[![npm downloads](https://img.shields.io/npm/dm/@moly-edu/widget-sdk.svg)](https://www.npmjs.com/package/@moly-edu/widget-sdk)

A React-first SDK for building iframe-based learning widgets configured by a host application.

## Installation

```bash
npm i @moly-edu/widget-sdk
```

## What this SDK provides

- Schema-first widget definition (`defineWidget`, `param`, `folder`, visibility rules)
- Automatic default resolution (static defaults + random + deriveDefaults)
- Runtime bridge between widget and host (`WIDGET_READY`, `PARAMS_UPDATE`, `SUBMIT`, TTS)
- React hooks for params and submission
- Optional host-driven difficulty synchronization (`difficultySync`)

## Quick Start

### 1. Define a widget contract

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
    mode: param
      .select(["practice", "challenge"] as const, "practice")
      .label("Mode"),

    difficulty: param
      .select(["easy", "medium", "hard"] as const, "medium")
      .label("Difficulty"),

    target: param.number(10).label("Target").min(1).max(100).random(),

    boardMin: param.number(1).min(1).max(100).label("Board Min"),
    boardMax: param.number(20).min(1).max(100).label("Board Max"),

    settings: folder("Settings", {
      showFeedback: param.boolean(true).label("Show feedback"),
      feedbackCorrect: param
        .string("Great job")
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
    if (defaults.boardMin > defaults.boardMax) {
      return { boardMax: defaults.boardMin };
    }

    switch (defaults.difficulty) {
      case "easy":
        return { target: randomInt(5, 20) };
      case "hard":
        return { target: randomInt(60, 100) };
      default:
        return { target: randomInt(20, 60) };
    }
  },

  answer: {
    value: param.string(""),
  },
});

export type WidgetParams = ExtractParams<typeof widgetDefinition>;
export type WidgetAnswer = ExtractAnswer<typeof widgetDefinition>;
```

### 2. Mount the widget

```ts
import { createWidget } from "@moly-edu/widget-sdk";
import { widgetDefinition } from "./definition";
import { WidgetComponent } from "./components/WidgetComponent";

createWidget({
  definition: widgetDefinition,
  component: WidgetComponent,
});
```

### 3. Consume params and submission in React

```tsx
import { useWidgetParams, useSubmission } from "@moly-edu/widget-sdk";
import type { WidgetParams, WidgetAnswer } from "./definition";

export function WidgetComponent() {
  const params = useWidgetParams<WidgetParams>();

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
      const isCorrect = ans.value === String(params.target);
      return {
        isCorrect,
        score: isCorrect ? 100 : 0,
        maxScore: 100,
      };
    },
  });

  return (
    <div>
      <h2>Target: {params.target}</h2>
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

## Parameter DSL

Factory methods:

- `param.string(defaultValue?)`
- `param.number(defaultValue?)`
- `param.boolean(defaultValue?)`
- `param.color(defaultValue?)`
- `param.image(defaultValue?)`
- `param.select(options, defaultValue?)`

Common modifiers:

- `.label(text)`
- `.description(text)`
- `.required()`
- `.visibleIf(condition)`
- `.random()`
- `.random((utils) => value)`
- `.readOnly()`
- `.hidden()`

Number modifiers:

- `.min(value)`
- `.max(value)`
- `.step(value)`
- `.minFrom(paramPath)`
- `.maxFrom(paramPath)`

`minFrom` and `maxFrom` allow dynamic numeric constraints based on other parameter paths.

Image modifier:

- `.placeholder(text)`

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

## Default Resolution Pipeline

When `createWidget(...)` runs, defaults are resolved in this order:

1. Extract static defaults from schema.
2. Apply `.random()` rules.
3. Apply `deriveDefaults(defaults, utils)` overrides.

Utilities available in random and derive logic:

- `randomInt(min, max)`
- `randomFloat(min, max)`
- `randomChoice(items)`

You can also call `resolveDefaults(...)` directly for tests.

## Difficulty Sync

The SDK supports optional metadata that the host can use for two-way difficulty synchronization.

Add `difficultySync` in `defineWidget`:

```ts
difficultySync: {
  difficultyPath: "difficulty",
  rules: [
    {
      when: when("mode").equals("challenge"),
      dimensions: [
        {
          path: "target",
          weight: 1,
          levels: {
            easy: { min: 1, max: 20, preset: 10 },
            medium: { min: 21, max: 60, preset: 40 },
            hard: { min: 61, max: 100, preset: 80 },
          },
        },
        {
          path: "settings.showHint",
          weight: 0.4,
          levels: {
            easy: { type: "boolean", equals: true, preset: true },
            medium: { type: "boolean", equals: false, preset: false },
            hard: { type: "boolean", equals: false, preset: false },
          },
        },
        {
          path: "mode",
          weight: 0.2,
          levels: {
            easy: { type: "select", in: ["practice"] },
            medium: { type: "select", in: ["challenge"] },
            hard: { type: "select", in: ["challenge"] },
          },
        },
      ],
    },
  ],
}
```

Level rules support three shapes:

- Number range: `{ min, max, preset? }`
- Boolean match: `{ type: "boolean", equals, preset? }`
- Select bucket: `{ type: "select", in, preset? }`

The SDK forwards this metadata to host in `WIDGET_READY` payload.

## React Hooks

### `useWidgetParams<T>()`

Returns latest params from host.

### `useSubmission<TAnswer>({ evaluate })`

Manages answer state, computes evaluation, and submits to host.

Returns:

- `answer`
- `setAnswer`
- `result`
- `submit`
- `isLocked` (review mode)
- `canSubmit`
- `isSubmitting`

### `useWidgetState` (legacy)

Backward-compatible helper hook.

## Speak Component (Host-managed TTS)

The SDK exports `Speak` for read-aloud UI.
Widgets do not call your TTS API directly.
Widgets send bridge messages and host performs synthesis and playback.

```tsx
import { Speak } from "@moly-edu/widget-sdk";

<Speak>Read this text</Speak>
<Speak text="Custom sentence" showIcon="always" iconSize={18}>
  <span>Tap speaker</span>
</Speak>
```

Props:

- `text?`
- `lang?` default `vi-VN`
- `rate?`
- `timeoutMs?`
- `showIcon?` = `auto | always | hover`
- `iconSize?`

Mobile behavior:

- `showIcon="auto"` shows icon by default on coarse-pointer devices.

## Host-widget Message Protocol

Widget to Host:

- `WIDGET_READY` payload `{ schema, resolvedDefaults, difficultySync }`
- `SUBMIT` payload `{ answer, evaluation }`
- `EVENT` payload custom
- `TTS_SYNTHESIZE` payload `{ requestId, text, lang?, rate? }`
- `TTS_STOP`

Host to Widget:

- `PARAMS_UPDATE` payload config, optional `__answer` for review mode
- `TTS_SYNTHESIZE_RESULT` payload `{ requestId, ok, error? }`

Notes:

- `__answer` enables review mode in widget runtime.
- Host should validate message source and origin before processing.

## WidgetRuntime (advanced)

Most apps should use hooks, but these methods are available:

- `WidgetRuntime.emitEvent(eventName, data?)`
- `WidgetRuntime.requestTtsSpeak({ text, lang?, rate?, timeoutMs? })`
- `WidgetRuntime.requestTtsAudio(...)` alias of `requestTtsSpeak`
- `WidgetRuntime.stopTts()`
- `WidgetRuntime.getInitialAnswer()`

## Development scripts

In `widget-sdk`:

```bash
npm run dev
npm run build
```

## Vite and local file dependencies note

If your widget app consumes SDK via local `file:` dependency and you hit duplicate React hook errors, add this in widget app Vite config:

```ts
resolve: {
  dedupe: ["react", "react-dom"],
}
```

## Exports

From `core`:

- `defineWidget`
- `param`
- `folder`
- `when`
- `and`
- `or`
- `resolveDefaults`
- `WidgetRuntime`
- random utilities and shared types

From `widget`:

- `createWidget`
- `useWidgetParams`
- `useSubmission`
- `useWidgetState`

From `speak`:

- `Speak`
- `SpeakProps`
