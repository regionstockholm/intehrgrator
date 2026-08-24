export type ExprAst =
  | { kind: "literal"; value: string | number | boolean }
  | {
    kind: "call";
    name:
      | "xpath"
      | "xpathString"
      | "xpathNumber"
      | "xpathBoolean"
      | "trim"
      | "concat"
      | "if"
      | "switch"
      | "var"
      | "maps_get";
    args: ExprAst[];
  }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: ExprAst; right: ExprAst };

const BUILTIN_NAMES = new Set([
  "xpath",
  "xpathString",
  "xpathNumber",
  "xpathBoolean",
  "trim",
  "concat",
  "if",
  "switch",
  "var",
  "maps_get",
]);

export function parseExpression(source: string): ExprAst {
  const tokens = tokenize(source.trim());
  const parser = new Parser(tokens);
  const ast = parser.parseExpression();
  if (parser.peek()) {
    throw new Error(`Unexpected token after expression: ${parser.peek()}`);
  }
  return ast;
}

export function serialize(ast: ExprAst): string {
  switch (ast.kind) {
    case "literal":
      if (typeof ast.value === "string") return JSON.stringify(ast.value);
      return String(ast.value);
    case "binary":
      return `(${serialize(ast.left)} ${ast.op} ${serialize(ast.right)})`;
    case "call":
      return `${ast.name}(${ast.args.map(serialize).join(", ")})`;
  }
}

export function validateExpressionSource(source: string): string | null {
  const forbidden = /\b(import|export|function|=>|require|fetch|eval|new)\b/;
  if (forbidden.test(source)) {
    return "Expression contains forbidden JavaScript constructs";
  }
  try {
    parseExpression(source);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

class Parser {
  constructor(private tokens: Token[]) {}
  private index = 0;

  peek(): Token | undefined {
    return this.tokens[this.index];
  }

  consume(): Token {
    const t = this.tokens[this.index++];
    if (!t) throw new Error("Unexpected end of expression");
    return t;
  }

  parseExpression(): ExprAst {
    return this.parseAddSub();
  }

  private parseAddSub(): ExprAst {
    let left = this.parseMulDiv();
    while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.consume().value as "+" | "-";
      const right = this.parseMulDiv();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMulDiv(): ExprAst {
    let left = this.parseUnary();
    while (this.peek()?.type === "op" && (this.peek()!.value === "*" || this.peek()!.value === "/")) {
      const op = this.consume().value as "*" | "/";
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): ExprAst {
    if (this.peek()?.type === "op" && this.peek()!.value === "-") {
      this.consume();
      const inner = this.parseUnary();
      return {
        kind: "binary",
        op: "-",
        left: { kind: "literal", value: 0 },
        right: inner,
      };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprAst {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of expression");

    if (token.type === "number") {
      this.consume();
      return { kind: "literal", value: Number(token.value) };
    }
    if (token.type === "string") {
      this.consume();
      return { kind: "literal", value: token.value };
    }
    if (token.type === "bool") {
      this.consume();
      return { kind: "literal", value: token.value === "true" };
    }
    if (token.type === "ident") {
      const name = this.consume().value;
      if (this.peek()?.type === "(") {
        if (!BUILTIN_NAMES.has(name)) {
          throw new Error(`Unknown function: ${name}`);
        }
        this.consume();
        const args: ExprAst[] = [];
        if (this.peek()?.type !== ")") {
          args.push(this.parseExpression());
          while (this.peek()?.type === ",") {
            this.consume();
            args.push(this.parseExpression());
          }
        }
        if (this.peek()?.type !== ")") throw new Error("Expected )");
        this.consume();
        const builtin = name as
          | "xpath"
          | "xpathString"
          | "xpathNumber"
          | "xpathBoolean"
          | "trim"
          | "concat"
          | "if"
          | "switch"
          | "var"
          | "maps_get";
        return { kind: "call", name: builtin, args };
      }
      throw new Error(`Unknown identifier: ${name}`);
    }
    if (token.type === "(") {
      this.consume();
      const inner = this.parseExpression();
      if (this.peek()?.type !== ")") throw new Error("Expected )");
      this.consume();
      return inner;
    }
    throw new Error(`Unexpected token: ${token.value}`);
  }
}

type Token = { type: "ident" | "number" | "string" | "bool" | "op" | "(" | ")" | ","; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if ("+-*/(),".includes(ch)) {
      if (ch === "(") tokens.push({ type: "(", value: ch });
      else if (ch === ")") tokens.push({ type: ")", value: ch });
      else if (ch === ",") tokens.push({ type: ",", value: ch });
      else tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let value = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\") {
          i++;
          value += input[i++];
        } else value += input[i++];
      }
      i++;
      tokens.push({ type: "string", value });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let value = "";
      while (i < input.length && /[0-9.]/.test(input[i])) value += input[i++];
      tokens.push({ type: "number", value });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let value = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) value += input[i++];
      if (value === "true" || value === "false") tokens.push({ type: "bool", value });
      else tokens.push({ type: "ident", value });
      continue;
    }
    throw new Error(`Unexpected character: ${ch}`);
  }
  return tokens;
}

export function xpathEvaluatorForReturnType(returnType: string): ExprAst["name"] & string {
  switch (returnType) {
    case "number":
      return "xpathNumber";
    case "boolean":
      return "xpathBoolean";
    default:
      return "xpathString";
  }
}

export function buildSourceQueryExpression(
  xpath: string,
  returnType: string,
): string {
  const fn = xpathEvaluatorForReturnType(returnType);
  return serialize({ kind: "call", name: fn as "xpathString", args: [{ kind: "literal", value: xpath }] });
}
