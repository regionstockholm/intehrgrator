import { assertEquals } from "@std/assert";
import {
  BetterFormMessage,
  createBetterFormBridge,
} from "@intehrgrator/core/output/better_form_bridge.ts";

Deno.test("Better Form Bridge is inert when renderer assets are absent", () => {
  const bridge = createBetterFormBridge(
    { resolveAppUrl: (path) => `https://app.local/${path}` },
    false,
  );
  assertEquals(bridge.available, false);
  assertEquals(bridge.rendererUrl, null);
  assertEquals(bridge.openViewer(), null);
  assertEquals(bridge.pushComposition({ ok: true }), false);
  assertEquals(BetterFormMessage.PUSH, "intehrgrator:better-form-push");
});

Deno.test("Better Form Bridge posts push messages when a target window exists", () => {
  const posted: unknown[] = [];
  const fakeWindow = {
    postMessage(message: unknown) {
      posted.push(message);
    },
  } as unknown as Window;
  const bridge = createBetterFormBridge(
    {
      resolveAppUrl: (path) => `https://app.local/${path}`,
      targetWindow: fakeWindow,
    },
    true,
  );
  assertEquals(bridge.available, true);
  assertEquals(bridge.rendererUrl, "https://app.local/better-form-viewer.html");
  assertEquals(bridge.pushComposition({ name: "Ada" }), true);
  assertEquals(posted[0], {
    type: BetterFormMessage.PUSH,
    composition: { name: "Ada" },
  });
});
