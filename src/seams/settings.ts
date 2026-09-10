/**
 * Host-side seam over the settings service: the only module naming the
 * namespace key type, so a settings-side change stays a single-file edit.
 *
 * @module @huanghanheng/dsh-ui-billing/seams/settings
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'

/**
 * Read one registered settings namespace's resolved value.
 * @param ctx - context carrying the settings service.
 * @param namespace - registered namespace key.
 * @returns the resolved section, or undefined when the namespace is unregistered.
 */
export function settingsSection<T>(ctx: Context, namespace: string): T | undefined {
  return ctx.settings.get(namespace as SettingsNamespace) as T | undefined
}
