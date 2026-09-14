import { assertEquals } from "@std/assert";
import {
  bleedingEdgeUrlFromManifestUrl,
  extractVersionTagFromPath,
  isGithubPagesHost,
  recommendedPopupMessage,
  recommendedUrlFromManifestUrl,
  resolveVersionsManifestUrl,
  shouldShowRecommendedPopup,
} from "../src/ui/recommended_version_popup.ts";

Deno.test("isGithubPagesHost matches *.github.io only", () => {
  assertEquals(isGithubPagesHost("regionstockholm.github.io"), true);
  assertEquals(isGithubPagesHost("localhost"), false);
  assertEquals(isGithubPagesHost("example.com"), false);
  assertEquals(isGithubPagesHost("notgithub.io"), false);
});

Deno.test("extractVersionTagFromPath detects a frozen release directory", () => {
  assertEquals(extractVersionTagFromPath("/intehrgrator/v0.7.5/"), "v0.7.5");
  assertEquals(extractVersionTagFromPath("/intehrgrator/v0.7/"), "v0.7");
  assertEquals(extractVersionTagFromPath("/intehrgrator/v0.7.5/index.html"), "v0.7.5");
});

Deno.test("extractVersionTagFromPath returns null for the bleeding-edge root", () => {
  assertEquals(extractVersionTagFromPath("/intehrgrator/"), null);
  assertEquals(extractVersionTagFromPath("/intehrgrator/index.html"), null);
  assertEquals(extractVersionTagFromPath("/"), null);
});

Deno.test("extractVersionTagFromPath ignores non-version last segments", () => {
  assertEquals(extractVersionTagFromPath("/intehrgrator/docs/"), null);
  assertEquals(extractVersionTagFromPath("/intehrgrator/validation-prep-alpha.1/"), null);
});

Deno.test("resolveVersionsManifestUrl steps up one directory from a frozen release", () => {
  assertEquals(
    resolveVersionsManifestUrl("https://regionstockholm.github.io/intehrgrator/v0.7.5/", "v0.7.5"),
    "https://regionstockholm.github.io/intehrgrator/versions.json",
  );
  assertEquals(
    resolveVersionsManifestUrl(
      "https://regionstockholm.github.io/intehrgrator/v0.7.5/index.html",
      "v0.7.5",
    ),
    "https://regionstockholm.github.io/intehrgrator/versions.json",
  );
});

Deno.test("resolveVersionsManifestUrl stays in place for the bleeding-edge root", () => {
  assertEquals(
    resolveVersionsManifestUrl("https://regionstockholm.github.io/intehrgrator/", null),
    "https://regionstockholm.github.io/intehrgrator/versions.json",
  );
  assertEquals(
    resolveVersionsManifestUrl("https://regionstockholm.github.io/intehrgrator/index.html", null),
    "https://regionstockholm.github.io/intehrgrator/versions.json",
  );
});

Deno.test("bleedingEdgeUrlFromManifestUrl is the manifest's parent directory", () => {
  assertEquals(
    bleedingEdgeUrlFromManifestUrl("https://regionstockholm.github.io/intehrgrator/versions.json"),
    "https://regionstockholm.github.io/intehrgrator/",
  );
});

Deno.test("recommendedUrlFromManifestUrl appends the tag directory", () => {
  assertEquals(
    recommendedUrlFromManifestUrl(
      "https://regionstockholm.github.io/intehrgrator/versions.json",
      "v0.7.5",
    ),
    "https://regionstockholm.github.io/intehrgrator/v0.7.5/",
  );
});

Deno.test("shouldShowRecommendedPopup is false off GitHub Pages", () => {
  assertEquals(
    shouldShowRecommendedPopup({ isGithubPages: false, currentTag: null, recommended: "v0.7" }),
    false,
  );
});

Deno.test("shouldShowRecommendedPopup is false with no recommended tag published", () => {
  assertEquals(
    shouldShowRecommendedPopup({ isGithubPages: true, currentTag: null, recommended: undefined }),
    false,
  );
});

Deno.test("shouldShowRecommendedPopup is false when already on the recommended tag", () => {
  assertEquals(
    shouldShowRecommendedPopup({ isGithubPages: true, currentTag: "v0.7", recommended: "v0.7" }),
    false,
  );
});

Deno.test("shouldShowRecommendedPopup is true on the bleeding-edge root when a recommendation exists", () => {
  assertEquals(
    shouldShowRecommendedPopup({ isGithubPages: true, currentTag: null, recommended: "v0.7" }),
    true,
  );
});

Deno.test("shouldShowRecommendedPopup is true on an older frozen release", () => {
  assertEquals(
    shouldShowRecommendedPopup({ isGithubPages: true, currentTag: "v0.6", recommended: "v0.7" }),
    true,
  );
});

Deno.test("shouldShowRecommendedPopup respects a matching dismissal", () => {
  assertEquals(
    shouldShowRecommendedPopup({
      isGithubPages: true,
      currentTag: "v0.6",
      recommended: "v0.7",
      dismissedFor: "v0.7",
    }),
    false,
  );
});

Deno.test("shouldShowRecommendedPopup ignores a stale dismissal for a different recommendation", () => {
  assertEquals(
    shouldShowRecommendedPopup({
      isGithubPages: true,
      currentTag: "v0.6",
      recommended: "v0.8",
      dismissedFor: "v0.7",
    }),
    true,
  );
});

Deno.test("recommendedPopupMessage names the current frozen release", () => {
  assertEquals(
    recommendedPopupMessage("v0.6", "v0.7"),
    "You are using intEHRgrator v0.6, which is not the recommended end-user version (v0.7).",
  );
});

Deno.test("recommendedPopupMessage names the bleeding-edge build", () => {
  assertEquals(
    recommendedPopupMessage(null, "v0.7"),
    "You are using the bleeding-edge build (updated on every change to main), not the recommended stable version (v0.7).",
  );
});

Deno.test("recommended-version dialog links open in the same tab", async () => {
  const html = await Deno.readTextFile(new URL("../web/index.html", import.meta.url));
  const dialog = html.split('id="dialog-recommended-version"')[1]?.split("</dialog>")[0] ?? "";
  assertEquals(dialog.includes("target=\"_blank\""), false);
});
