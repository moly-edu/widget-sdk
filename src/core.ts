// ============================================================
// TYPES
// ============================================================
interface BaseParamConfig {
  type: string;
  label?: string;
  description?: string;
  default?: any;
  required?: boolean;
  visibleIf?: VisibilityCondition;
  random?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
}

type SingleCondition = {
  param: string;
  equals?: any;
  notEquals?: any;
  in?: any[];
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
};

type VisibilityCondition =
  | SingleCondition
  | { and: VisibilityCondition[] }
  | { or: VisibilityCondition[] };

// Evaluation result structure (required fields)
export interface EvaluationResult {
  isCorrect: boolean;
  score: number;
  maxScore: number;
}

// Submission structure sent to host
export interface Submission<TAnswer = any> {
  answer: TAnswer;
  evaluation: EvaluationResult;
}

export interface TtsRequestPayload {
  requestId: string;
  text: string;
  lang?: string;
  rate?: number;
}

export interface TtsResponsePayload {
  requestId: string;
  ok: boolean;
  error?: string;
}

// ============================================================
// PARAM CLASSES
// ============================================================
class BaseParam<T> {
  protected config: BaseParamConfig;
  private _randomFn?: (utils: DeriveUtils) => T;

  constructor(type: string, defaultValue?: T) {
    this.config = {
      type,
      default: defaultValue,
    };
  }

  label(text: string) {
    this.config.label = text;
    return this;
  }

  description(text: string) {
    this.config.description = text;
    return this;
  }

  required() {
    this.config.required = true;
    return this;
  }

  visibleIf(condition: VisibilityCondition) {
    this.config.visibleIf = condition;
    return this;
  }

  random(fn?: (utils: DeriveUtils) => T) {
    this.config.random = true;
    if (fn) this._randomFn = fn;
    return this;
  }

  readOnly() {
    this.config.readOnly = true;
    return this;
  }

  hidden() {
    this.config.hidden = true;
    return this;
  }

  getRandomFn(): ((utils: DeriveUtils) => T) | undefined {
    return this._randomFn;
  }

  toSchema() {
    return { ...this.config };
  }
}

class StringParam extends BaseParam<string> {
  readonly _type = "string" as const;
  constructor(defaultValue?: string) {
    super("string", defaultValue);
  }
}

class NumberParam extends BaseParam<number> {
  readonly _type = "number" as const;
  constructor(defaultValue?: number) {
    super("number", defaultValue);
  }

  min(value: number) {
    (this.config as any).min = value;
    return this;
  }

  max(value: number) {
    (this.config as any).max = value;
    return this;
  }

  step(value: number) {
    (this.config as any).step = value;
    return this;
  }
}

class BooleanParam extends BaseParam<boolean> {
  readonly _type = "boolean" as const;
  constructor(defaultValue?: boolean) {
    super("boolean", defaultValue);
  }
}

class ColorParam extends BaseParam<string> {
  readonly _type = "color" as const;
  constructor(defaultValue?: string) {
    super("color", defaultValue);
  }
}

class ImageParam extends BaseParam<string> {
  readonly _type = "image" as const;
  constructor(defaultValue?: string) {
    super("image", defaultValue);
  }

  placeholder(text: string) {
    (this.config as any).placeholder = text;
    return this;
  }
}

class SelectParam<T> extends BaseParam<T> {
  readonly _type = "select" as const;
  readonly _options: T[];

  constructor(options: T[], defaultValue?: T) {
    super("select", defaultValue);
    this._options = options;
    (this.config as any).options = options;
  }
}

class FolderParam<F extends Record<string, any>> {
  readonly _type = "folder" as const;
  private title: string;
  public readonly fields: F;
  private isExpanded: boolean;
  private visibility?: VisibilityCondition;
  private _hidden: boolean = false;

  constructor(title: string, fields: F) {
    this.title = title;
    this.fields = fields;
    this.isExpanded = true;
  }

  expanded(value: boolean = true) {
    this.isExpanded = value;
    return this;
  }

  visibleIf(condition: VisibilityCondition) {
    this.visibility = condition;
    return this;
  }

  hidden() {
    this._hidden = true;
    return this;
  }

  toSchema() {
    const fieldsSchema: Record<string, any> = {};
    Object.keys(this.fields).forEach((key) => {
      const field = this.fields[key];
      fieldsSchema[key] = field.toSchema ? field.toSchema() : field;
    });

    const schema: any = {
      type: "folder",
      title: this.title,
      expanded: this.isExpanded,
      fields: fieldsSchema,
    };

    if (this.visibility) {
      schema.visibleIf = this.visibility;
    }

    if (this._hidden) {
      schema.hidden = true;
    }

    return schema;
  }
}

// ============================================================
// PUBLIC API
// ============================================================
export const param = {
  string: (defaultValue?: string) => new StringParam(defaultValue),
  number: (defaultValue?: number) => new NumberParam(defaultValue),
  boolean: (defaultValue?: boolean) => new BooleanParam(defaultValue),
  color: (defaultValue?: string) => new ColorParam(defaultValue),
  image: (defaultValue?: string) => new ImageParam(defaultValue),
  select: <T>(options: T[], defaultValue?: T) =>
    new SelectParam(options, defaultValue),
};

export function folder<const F extends Record<string, any>>(
  title: string,
  fields: F,
) {
  return new FolderParam<F>(title, fields);
}

export function when<T>(param: string) {
  return {
    equals: (value: T) => ({ param, equals: value }),
    notEquals: (value: T) => ({ param, notEquals: value }),
    in: (values: T[]) => ({ param, in: values }),
    gt: (value: number) => ({ param, gt: value }),
    gte: (value: number) => ({ param, gte: value }),
    lt: (value: number) => ({ param, lt: value }),
    lte: (value: number) => ({ param, lte: value }),
  };
}

export function and(...conditions: VisibilityCondition[]): VisibilityCondition {
  return { and: conditions };
}

export function or(...conditions: VisibilityCondition[]): VisibilityCondition {
  return { or: conditions };
}

// ============================================================
// DERIVE DEFAULTS UTILITIES
// ============================================================
export interface DeriveUtils {
  randomInt: (min: number, max: number) => number;
  randomFloat: (min: number, max: number) => number;
  randomChoice: <T>(items: T[]) => T;
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function extractDefaults(schema: Record<string, any>): Record<string, any> {
  const defaults: Record<string, any> = {};
  for (const key of Object.keys(schema)) {
    const field = schema[key];
    if (field.type === "folder" && field.fields) {
      defaults[key] = extractDefaults(field.fields);
    } else if (field.default !== undefined) {
      defaults[key] = field.default;
    }
  }
  return defaults;
}

function applyRandomization(
  defaults: Record<string, any>,
  schema: Record<string, any>,
  randomFns?: Record<string, (utils: DeriveUtils) => any>,
  pathPrefix: string = "",
): void {
  const utils: DeriveUtils = { randomInt, randomFloat, randomChoice };
  for (const key of Object.keys(schema)) {
    const field = schema[key];
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (field.type === "folder" && field.fields) {
      if (!defaults[key]) defaults[key] = {};
      applyRandomization(defaults[key], field.fields, randomFns, fullPath);
    } else if (field.random) {
      if (randomFns?.[fullPath]) {
        defaults[key] = randomFns[fullPath](utils);
      } else {
        switch (field.type) {
          case "number": {
            const min = field.min ?? 0;
            const max = field.max ?? 100;
            const step = field.step;
            if (step) {
              const steps = Math.floor((max - min) / step);
              defaults[key] =
                min + Math.floor(Math.random() * (steps + 1)) * step;
            } else {
              defaults[key] = randomInt(min, max);
            }
            break;
          }
          case "boolean":
            defaults[key] = Math.random() > 0.5;
            break;
          case "select":
            if (field.options && field.options.length > 0) {
              defaults[key] = randomChoice(field.options);
            }
            break;
        }
      }
    }
  }
}

function deepMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): void {
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

export function resolveDefaults(
  schema: Record<string, any>,
  randomFns?: Record<string, (utils: DeriveUtils) => any>,
  deriveDefaultsFn?: (
    defaults: Record<string, any>,
    utils: DeriveUtils,
  ) => Record<string, any>,
): Record<string, any> {
  const defaults = extractDefaults(schema);
  applyRandomization(defaults, schema, randomFns);

  if (deriveDefaultsFn) {
    const utils: DeriveUtils = { randomInt, randomFloat, randomChoice };
    const overrides = deriveDefaultsFn(defaults, utils);
    if (overrides) {
      deepMerge(defaults, overrides);
    }
  }

  return defaults;
}

// ============================================================
// TYPE INFERENCE
// ============================================================
type InferParamType<T> = T extends { _type: "string" }
  ? string
  : T extends { _type: "number" }
    ? number
    : T extends { _type: "boolean" }
      ? boolean
      : T extends { _type: "color" }
        ? string
        : T extends { _type: "image" }
          ? string
          : T extends { _type: "select"; _options: readonly (infer U)[] }
            ? U
            : T extends { _type: "folder"; fields: infer F }
              ? InferFolderType<F>
              : never;

type InferFolderType<F> = {
  [K in keyof F]: InferParamType<F[K]>;
};

type InferParametersType<T> = {
  [K in keyof T]: InferParamType<T[K]>;
};

// ============================================================
// WIDGET DEFINITION
// ============================================================
function extractRandomFns(
  params: Record<string, any>,
  prefix: string[] = [],
): Record<string, (utils: DeriveUtils) => any> {
  const fns: Record<string, (utils: DeriveUtils) => any> = {};
  for (const key of Object.keys(params)) {
    const p = params[key];
    const path = [...prefix, key].join(".");
    if (p._type === "folder" && p.fields) {
      Object.assign(fns, extractRandomFns(p.fields, [...prefix, key]));
    } else if (typeof p.getRandomFn === "function" && p.getRandomFn()) {
      fns[path] = p.getRandomFn();
    }
  }
  return fns;
}

export function defineWidget<
  const P extends Record<string, any>,
  const A extends Record<string, any>,
>(config: {
  parameters: P;
  answer: A;
  deriveDefaults?: (
    defaults: Record<string, any>,
    utils: DeriveUtils,
  ) => Record<string, any>;
}) {
  const buildSchema = (params: Record<string, any>): Record<string, any> => {
    const schema: Record<string, any> = {};
    Object.keys(params).forEach((key) => {
      const param = params[key];
      if (param.toSchema) {
        schema[key] = param.toSchema();
      }
    });
    return schema;
  };

  const schema = buildSchema(config.parameters);
  const randomFns = extractRandomFns(config.parameters);

  return {
    schema,
    __parameters: config.parameters,
    __answer: config.answer,
    __deriveDefaults: config.deriveDefaults,
    __randomFns: Object.keys(randomFns).length > 0 ? randomFns : undefined,
  };
}

export type ExtractParams<T> = T extends { __parameters: infer P }
  ? InferParametersType<P>
  : never;

export type ExtractAnswer<T> = T extends { __answer: infer A }
  ? InferParametersType<A>
  : never;

// ============================================================
// WIDGET RUNTIME - Communication with Host
// ============================================================
export class WidgetRuntime {
  private static params: Record<string, any> = {};
  private static paramsListeners: Set<(params: any) => void> = new Set();

  private static initialAnswer: any = null;
  private static answerListeners: Set<(answer: any) => void> = new Set();
  private static ttsPending: Map<
    string,
    {
      resolve: () => void;
      reject: (error: Error) => void;
      timeoutId: number;
    }
  > = new Map();

  static init() {
    window.addEventListener("message", (event) => {
      if (event.data.type === "PARAMS_UPDATE") {
        const payload = event.data.payload;

        // Check if payload contains __answer
        if (payload.__answer !== undefined) {
          this.initialAnswer = payload.__answer;
          this.notifyAnswerListeners();

          // Remove __answer from params
          const { __answer, ...params } = payload;
          this.params = params;
        } else {
          // Không có __answer → exit review mode
          if (this.initialAnswer !== null) {
            console.log(
              "🔙 WidgetRuntime: Clearing initialAnswer (exit review mode)",
            );
            this.initialAnswer = null;
            this.notifyAnswerListeners(); // Notify với null
          }

          this.params = payload;
        }

        this.notifyParamsListeners();
      }

      if (event.data.type === "TTS_SYNTHESIZE_RESULT") {
        const payload = event.data.payload as TtsResponsePayload | undefined;
        const requestId = payload?.requestId;
        if (!requestId) return;

        const pending = this.ttsPending.get(requestId);
        if (!pending) return;

        window.clearTimeout(pending.timeoutId);
        this.ttsPending.delete(requestId);

        if (payload?.ok) {
          pending.resolve();
          return;
        }

        pending.reject(new Error(payload?.error || "TTS synthesis failed"));
      }
    });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.sendToHost({ type: "WIDGET_READY" });
      });
    } else {
      setTimeout(() => {
        this.sendToHost({ type: "WIDGET_READY" });
      }, 0);
    }
  }

  static sendToHost(message: any) {
    if (window.parent !== window) {
      window.parent.postMessage(message, "*");
    }
  }

  static onParamsChange(callback: (params: any) => void) {
    this.paramsListeners.add(callback);
    if (Object.keys(this.params).length > 0) {
      callback(this.params);
    }
    return () => {
      this.paramsListeners.delete(callback);
    };
  }

  static onAnswerChange(callback: (answer: any) => void) {
    this.answerListeners.add(callback);
    if (this.initialAnswer !== null) {
      callback(this.initialAnswer);
    }
    return () => {
      this.answerListeners.delete(callback);
    };
  }

  private static notifyParamsListeners() {
    this.paramsListeners.forEach((listener) => listener(this.params));
  }

  private static notifyAnswerListeners() {
    this.answerListeners.forEach((listener) => listener(this.initialAnswer));
  }

  static emitEvent(eventName: string, data?: any) {
    this.sendToHost({
      type: "EVENT",
      event: eventName,
      payload: data,
    });
  }

  // Submit answer with evaluation
  static async submit<TAnswer = any>(
    answer: TAnswer,
    evaluation: EvaluationResult,
  ): Promise<Submission<TAnswer>> {
    const submission: Submission<TAnswer> = {
      answer,
      evaluation,
    };

    console.log("📤 Submitting to host:", submission);

    this.sendToHost({
      type: "SUBMIT",
      payload: submission,
    });

    return submission;
  }

  // Get initial answer (if in review mode)
  static getInitialAnswer<TAnswer = any>(): TAnswer | null {
    return this.initialAnswer;
  }

  static requestTtsSpeak({
    text,
    lang,
    rate,
    timeoutMs = 25000,
  }: {
    text: string;
    lang?: string;
    rate?: number;
    timeoutMs?: number;
  }): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.reject(new Error("TTS text is empty"));
    }

    if (window.parent === window) {
      return Promise.reject(
        new Error("TTS host bridge requires running inside an iframe"),
      );
    }

    const requestId = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.ttsPending.delete(requestId);
        reject(new Error("TTS request timeout"));
      }, timeoutMs);

      this.ttsPending.set(requestId, { resolve, reject, timeoutId });

      const payload: TtsRequestPayload = {
        requestId,
        text: trimmed,
        lang,
        rate,
      };

      this.sendToHost({
        type: "TTS_SYNTHESIZE",
        payload,
      });
    });
  }

  static requestTtsAudio(args: {
    text: string;
    lang?: string;
    rate?: number;
    timeoutMs?: number;
  }): Promise<void> {
    return this.requestTtsSpeak(args);
  }

  static stopTts() {
    this.ttsPending.forEach((pending) => {
      window.clearTimeout(pending.timeoutId);
      pending.reject(new Error("TTS stopped"));
    });
    this.ttsPending.clear();

    this.sendToHost({ type: "TTS_STOP" });
  }
}

WidgetRuntime.init();
