/**
 * Browser-side seam over the sessions service: resolves the currently selected
 * session's projection face to a bare observable plus a selection feed, so the
 * business sources never name the harness session faces.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/sessions
 */
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots';
/** Current-session projection access consumed by the cost source. */
export interface CurrentSessionProjection {
    /** Subscribe to selection movement. */
    subscribe(listener: () => void): () => void;
    /** The selected session's observable for `key`; undefined without a selection or a materialized binding. */
    face(key: string): HostObservable<unknown> | undefined;
}
/**
 * Bind the sessions service to the current-session projection seam.
 * @param sessions - the sessions service face.
 * @returns the seam over the current selection's projection faces.
 */
export declare function currentSessionProjection(sessions: ISessions): CurrentSessionProjection;
//# sourceMappingURL=sessions.d.ts.map