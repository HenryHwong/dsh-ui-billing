/**
 * Host-side seam over the settings service: the only module naming how this
 * plugin reads a resolved provider section, so a settings-side change stays a
 * single-file edit.
 *
 * @module @huanghanheng/dsh-ui-billing/seams/settings
 */

import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the settings service's Context merge (ctx.settings).
import type {} from '@deepseek-ai/dsh-settings'

/**
 * Read one active profile entry's live configuration fields.
 * @param ctx - context carrying the settings service.
 * @param namespace - profile entry id owning the section.
 * @returns the entry's projected live fields, or undefined when it is not active.
 */
export function settingsSection<T>(ctx: Context, namespace: string): T | undefined {
  return ctx.settings.describe().find(row => row.ns === namespace)?.value as T | undefined
}
