/**
 * Host-side seam over the settings service: the only module naming how this
 * plugin reads a resolved provider section, so a settings-side change stays a
 * single-file edit.
 *
 * @module @huanghanheng/dsh-ui-billing/seams/settings
 */
import type { Context } from '@deepseek-ai/cordis';
/**
 * Read one active profile entry's live configuration fields.
 * @param ctx - context carrying the settings service.
 * @param namespace - profile entry id owning the section.
 * @returns the entry's projected live fields, or undefined when it is not active.
 */
export declare function settingsSection<T>(ctx: Context, namespace: string): T | undefined;
//# sourceMappingURL=settings.d.ts.map