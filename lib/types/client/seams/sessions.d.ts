/**
 * Browser-side seam over the session area adapter: resolves the displayed
 * session's projection face to a bare observable plus a display feed, so the
 * business sources never name the harness session faces.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/sessions
 */
import type { UiSession } from '@deepseek-ai/dsh-client-ui-session/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
/** Displayed-session projection access consumed by the cost source. */
export interface CurrentSessionProjection {
    /** Subscribe to display movement. */
    subscribe(listener: () => void): () => void;
    /** The displayed session's observable for `key`; undefined without a displayed session. */
    face(key: string): HostObservable<unknown> | undefined;
}
/**
 * Bind the session area adapter to the displayed-session projection seam.
 * @param uiSession - the renderer-facing session adapter service.
 * @returns the seam over the displayed session's projection faces.
 */
export declare function currentSessionProjection(uiSession: UiSession): CurrentSessionProjection;
//# sourceMappingURL=sessions.d.ts.map