import { assertEquals, assertThrows } from "@std/assert";
import {
  bindRequiresTokenMessage,
  DEFAULT_BIND,
  isLoopbackBind,
  parseDesktopArgs,
  USAGE,
} from "../src/desktop/cli.ts";
import { shouldOpenUi } from "../src/desktop/main.ts";

Deno.test("parseDesktopArgs defaults to loopback ephemeral port", () => {
  const opts = parseDesktopArgs([]);
  assertEquals(opts.help, false);
  assertEquals(opts.headless, false);
  assertEquals(opts.port, 0);
  assertEquals(opts.bind, DEFAULT_BIND);
  assertEquals(opts.load, undefined);
  assertEquals(opts.token, undefined);
});

Deno.test("parseDesktopArgs reads flags and env", () => {
  const opts = parseDesktopArgs(
    ["--headless", "--port", "8765", "--bind", "0.0.0.0", "--load", "x.intehrgrator", "--token", "s3cret"],
    { PORT: "1", INTEHR_BIND: "127.0.0.1", INTEHR_AGENT_TOKEN: "env-token" },
  );
  assertEquals(opts.headless, true);
  assertEquals(opts.port, 8765);
  assertEquals(opts.bind, "0.0.0.0");
  assertEquals(opts.load, "x.intehrgrator");
  assertEquals(opts.token, "s3cret");
});

Deno.test("parseDesktopArgs help and equals form", () => {
  const opts = parseDesktopArgs(["-h", "--port=9", "--bind=::1", "--load=p.intehrgrator"]);
  assertEquals(opts.help, true);
  assertEquals(opts.port, 9);
  assertEquals(opts.bind, "::1");
  assertEquals(opts.load, "p.intehrgrator");
  assertEquals(USAGE.includes("--headless"), true);
});

Deno.test("parseDesktopArgs token from env when flag omitted", () => {
  const opts = parseDesktopArgs(["--headless"], { INTEHR_AGENT_TOKEN: "env" });
  assertEquals(opts.token, "env");
});

Deno.test("isLoopbackBind and bindRequiresTokenMessage", () => {
  assertEquals(isLoopbackBind("127.0.0.1"), true);
  assertEquals(isLoopbackBind("localhost"), true);
  assertEquals(isLoopbackBind("::1"), true);
  assertEquals(isLoopbackBind("0.0.0.0"), false);
  assertEquals(bindRequiresTokenMessage(parseDesktopArgs(["--bind", "0.0.0.0"])), 
    "Non-loopback --bind requires --token or INTEHR_AGENT_TOKEN");
  assertEquals(
    bindRequiresTokenMessage(parseDesktopArgs(["--bind", "0.0.0.0", "--token", "x"])),
    undefined,
  );
});

Deno.test("shouldOpenUi is false only when headless", () => {
  assertEquals(shouldOpenUi(parseDesktopArgs([])), true);
  assertEquals(shouldOpenUi(parseDesktopArgs(["--headless"])), false);
});

Deno.test("parseDesktopArgs rejects missing flag values", () => {
  assertThrows(() => parseDesktopArgs(["--port"]), Error, "requires a value");
  assertThrows(() => parseDesktopArgs(["--bind"]), Error, "requires a value");
});
