/**
 * Host half of the Commonspace Web plugin.
 *
 * The first release is intentionally browser-only. Keeping a no-op host face
 * makes the package a normal Cordis plugin that the DSH Loader can discover,
 * while package.json exposes the independently loaded browser half.
 */

export const name = 'commonspace'

/** Register no host services for the navigation-only first release. */
export function apply(): void {}
