/** Public URLs opened from the workbench Help dialog and issue templates. */
export const HELP_LINKS = {
  repo: "https://github.com/regionstockholm/intehrgrator",
  tutorial: "https://github.com/regionstockholm/intehrgrator/blob/main/docs/TUTORIAL.md",
  bug: "https://github.com/regionstockholm/intehrgrator/issues/new?template=bug.yml",
  feature: "https://github.com/regionstockholm/intehrgrator/issues/new?template=feature.yml",
  issues: "https://github.com/regionstockholm/intehrgrator/issues",
  chooseIssue: "https://github.com/regionstockholm/intehrgrator/issues/new/choose",
  releases: "https://github.com/regionstockholm/intehrgrator/releases",
  webShell: "https://regionstockholm.github.io/intehrgrator/",
  versionsJson: "https://regionstockholm.github.io/intehrgrator/versions.json",
} as const;

export type HelpLinkKey = keyof typeof HELP_LINKS;
