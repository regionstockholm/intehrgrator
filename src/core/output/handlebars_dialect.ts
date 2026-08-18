import Handlebars from "handlebars";

export interface HandlebarsRenderOptions {
  strict?: boolean;
  slots?: Readonly<Record<string, unknown>>;
}

/** Kintegrate-compatible Handlebars runtime, isolated from global registrations. */
export function createKintegrateHandlebars(): typeof Handlebars {
  const engine = Handlebars.create();
  engine.registerHelper({
    eq: (left: unknown, right: unknown) => left === right,
    ne: (left: unknown, right: unknown) => left !== right,
    lt: (left: unknown, right: unknown) => Number(left) < Number(right),
    gt: (left: unknown, right: unknown) => Number(left) > Number(right),
    lte: (left: unknown, right: unknown) => Number(left) <= Number(right),
    gte: (left: unknown, right: unknown) => Number(left) >= Number(right),
    and: (...args: unknown[]) => args.slice(0, -1).every(Boolean),
    or: (...args: unknown[]) => args.slice(0, -1).some(Boolean),
    toLowerCase: (value: unknown) => value == null ? value : String(value).toLowerCase(),
    toUpperCase: (value: unknown) => value == null ? value : String(value).toUpperCase(),
    slot(this: unknown, slotId: unknown, options: { data?: { root?: { _slots?: Record<string, unknown> } } }) {
      return options.data?.root?._slots?.[String(slotId)];
    },
    json(value: unknown) {
      return new engine.SafeString(JSON.stringify(value));
    },
  });
  return engine;
}

export function renderHandlebars(
  templateSource: string,
  source: unknown,
  options: HandlebarsRenderOptions = {},
): string {
  const engine = createKintegrateHandlebars();
  const root = isRecord(source)
    ? { ...source, _slots: options.slots ?? {} }
    : { value: source, _slots: options.slots ?? {} };
  const template = engine.compile(templateSource, {
    strict: options.strict ?? false,
    noEscape: true,
    data: true,
    preventIndent: false,
  });
  return template(root, {
    allowProtoMethodsByDefault: false,
    allowProtoPropertiesByDefault: false,
  });
}

export function precompileHandlebars(templateSource: string): string {
  return String(createKintegrateHandlebars().precompile(templateSource, {
    noEscape: true,
    data: true,
  }));
}

/** Convert the Source Pane's JSON authoring path to Kintegrate Handlebars syntax. */
export function buildHandlebarsPath(sourcePath: string): string {
  return parseSourcePath(sourcePath)
    .map((segment) => {
      if (typeof segment === "number") {
        // Source Pane XPath-style array positions are one-based; Handlebars is zero-based.
        return `[${Math.max(0, segment - 1)}]`;
      }
      return /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(segment)
        ? segment
        : `[${segment.replace(/\\/g, "\\\\").replace(/]/g, "\\]")}]`;
    })
    .join(".");
}

/** Generate a nested #with/#each snippet for a selected Source Pane path. */
export function buildHandlebarsTree(sourcePath: string): string {
  const segments = parseSourcePath(sourcePath);
  if (!segments.length) return "{{.}}";
  const lines: string[] = [];
  const closes: string[] = [];
  let indent = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const next = segments[i + 1];
    if (typeof segment === "number") continue;
    const path = buildHandlebarsPathSegment(segment);
    if (typeof next === "number") {
      lines.push(`${indent}{{#each ${path}}}`);
      closes.unshift(`${indent}{{/each}}`);
      indent += "  ";
      i++;
    } else if (i < segments.length - 1) {
      lines.push(`${indent}{{#with ${path}}}`);
      closes.unshift(`${indent}{{/with}}`);
      indent += "  ";
    } else {
      lines.push(`${indent}{{${path}}}`);
    }
  }
  return [...lines, ...closes].join("\n");
}

function parseSourcePath(sourcePath: string): Array<string | number> {
  const source = sourcePath.trim().replace(/^\$/, "");
  const out: Array<string | number> = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === "." || source[i] === "/") {
      i++;
      continue;
    }
    if (source[i] === "[") {
      const close = source.indexOf("]", i + 1);
      if (close < 0) break;
      const token = source.slice(i + 1, close);
      if (/^\d+$/.test(token)) out.push(Number(token));
      else if (token.startsWith('"') && token.endsWith('"')) out.push(JSON.parse(token));
      else out.push(token.replace(/^['"]|['"]$/g, ""));
      i = close + 1;
      continue;
    }
    let end = i;
    while (end < source.length && !".[/".includes(source[end]!)) end++;
    out.push(source.slice(i, end));
    i = end;
  }
  return out;
}

function buildHandlebarsPathSegment(segment: string): string {
  return /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(segment)
    ? segment
    : `[${segment.replace(/\\/g, "\\\\").replace(/]/g, "\\]")}]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
