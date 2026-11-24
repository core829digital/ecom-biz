import type { Theme } from "./theme";
import { sanitizeCss } from "./css-sanitize";

/** What a store's plan unlocks in the site editor. */
export type ThemeCapabilities = { motion: 0 | 1 | 2; customCss: boolean };

export const MOTION_PRESETS = [
  { id: "none", minLevel: 0 },
  { id: "subtle", minLevel: 1 },
  { id: "smooth", minLevel: 2 },
  { id: "cinematic", minLevel: 2 },
] as const satisfies readonly { id: Theme["motion"]; minLevel: 0 | 1 | 2 }[];

export function motionAllowed(motion: Theme["motion"], caps: ThemeCapabilities) {
  return (MOTION_PRESETS.find((m) => m.id === motion)?.minLevel ?? 2) <= caps.motion;
}

/**
 * Removes what the plan doesn't include. Applied when saving and again when rendering, so a
 * downgraded store loses premium effects at once while the saved design stays intact otherwise.
 */
export function clampTheme(theme: Theme, caps: ThemeCapabilities): Theme {
  const motion: Theme["motion"] = motionAllowed(theme.motion, caps) ? theme.motion : caps.motion >= 1 ? "subtle" : "none";
  return {
    ...theme,
    motion,
    customCss: caps.customCss ? sanitizeCss(theme.customCss) : "",
    sections: caps.motion >= 2 ? theme.sections : theme.sections.map((s) => ({ ...s, style: { ...s.style, reveal: "auto" } })),
  };
}
