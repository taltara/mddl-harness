/**
 * The three states this plugin can report, as theme-aware colours.
 *
 * Blueprint had four hand-picked hex values doing this job. They were the right
 * *semantics* — green runs, amber waits, red failed — with an unconsidered
 * palette and, more importantly, no idea which theme it was rendering into. The
 * harness ships light and dark; a fixed set tuned for one of them is a contrast
 * bug in the other.
 *
 * The values come from the Praesidium design language, which defines the same
 * three states for its runtime gate and its ledger, including the dimmed
 * variants that hold AA on a light ground. Sharing them means a plugin
 * reviewed before a write and an agent stopped at a tool call say the same
 * thing in the same colour, instead of two products that happen to both use
 * green.
 *
 * Deliberately NOT adopted: the language's graphite ground, surfaces, and
 * typography. Those belong to whatever host this renders inside. Blueprint
 * already builds its structure from translucent greys and transparent fills
 * that sit correctly on either theme, and replacing them with our own ground
 * would make a plugin that looks pasted into someone else's application.
 */

/** Injected once; `var()` then works from ordinary inline styles. */
export const SIGNAL_STYLE = `
:root {
  --bp-signal: oklch(0.45 0.16 140);
  --bp-hold: oklch(0.5 0.1 78);
  --bp-veto: oklch(0.52 0.19 25);
  --bp-quiet: oklch(0.5 0.01 255);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bp-signal: oklch(0.86 0.21 133);
    --bp-hold: oklch(0.83 0.16 78);
    --bp-veto: oklch(0.75 0.16 25);
    --bp-quiet: oklch(0.6 0.012 255);
  }
}
`

export const SIGNAL = {
  /** Allowed, active, or a change that will be made. */
  allow: 'var(--bp-signal)',
  /** Waiting on something, or a finding worth a look but not a refusal. */
  hold: 'var(--bp-hold)',
  /** Failed, refused, or a finding that blocks. */
  veto: 'var(--bp-veto)',
  /** Deliberately off, unchanged, or otherwise not a state to react to. */
  quiet: 'var(--bp-quiet)',
} as const
