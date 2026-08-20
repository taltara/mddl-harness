/**
 * Route paths, shared by both halves.
 *
 * Deliberately its own module with no imports. The client used to take these
 * from the host entry, which dragged the host's whole module graph into the
 * browser bundle — including `node:crypto`, which the shell's module table
 * cannot answer for. The plugin then failed to import, and a plugin that fails
 * to import takes the rest of the UI down with it.
 */
export const LIVE_ROUTE = '/dsh-blueprint/api/live'
export const PREVIEW_ROUTE = '/dsh-blueprint/api/preview'
export const APPLY_ROUTE = '/dsh-blueprint/api/apply'
export const BACKUPS_ROUTE = '/dsh-blueprint/api/backups'
export const RESTORE_ROUTE = '/dsh-blueprint/api/restore'
export const PRESET_ROUTE = '/dsh-blueprint/api/preset'
