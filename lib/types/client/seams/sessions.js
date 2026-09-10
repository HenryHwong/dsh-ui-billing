/**
 * Browser-side seam over the sessions service: resolves the currently selected
 * session's projection face to a bare observable plus a selection feed, so the
 * business sources never name the harness session faces.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/sessions
 */
/**
 * Bind the sessions service to the current-session projection seam.
 * @param sessions - the sessions service face.
 * @returns the seam over the current selection's projection faces.
 */
export function currentSessionProjection(sessions) {
    const list = sessions.list;
    return {
        subscribe: listener => list.subscribe(listener),
        face: (key) => {
            const current = list.getSnapshot().current;
            return current === undefined
                ? undefined
                : sessions.binding(current)?.session.projections.faceOf(key);
        },
    };
}
//# sourceMappingURL=sessions.js.map