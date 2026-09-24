/**
 * Browser-side seam over the session area adapter: resolves the displayed
 * session's projection face to a bare observable plus a display feed, so the
 * business sources never name the harness session faces.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/sessions
 */
/**
 * Bind the session area adapter to the displayed-session projection seam.
 * @param uiSession - the renderer-facing session adapter service.
 * @returns the seam over the displayed session's projection faces.
 */
export function currentSessionProjection(uiSession) {
    const current = uiSession.adapter.current;
    return {
        subscribe: listener => current.subscribe(listener),
        face: key => current.getSnapshot().keyedHooks.projection?.(key),
    };
}
//# sourceMappingURL=sessions.js.map