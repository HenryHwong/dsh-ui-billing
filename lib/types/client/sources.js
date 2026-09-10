/**
 * Reactive sources behind the billing footer widget. Business wiring only:
 * these are bare observable sources (uSES contract — stable getSnapshot
 * identity until the fact moves), constructed in `apply` and bound to
 * `useBillingCost` / `useBalance` hooks by the renderer. Polling and
 * re-subscription follow the observable lifecycle: the balance source starts
 * its refresh loop when the first subscriber arrives and stops when the last
 * one leaves.
 */
/**
 * The balance channel the node half registers. A protocol constant the
 * browser half cannot import from the node half (client bundle purity), so
 * both halves keep the same literal.
 */
const BALANCE_CHANNEL = '/billing';
/** Balance polling interval while the widget is mounted. */
const BALANCE_REFRESH_MS = 60_000;
/**
 * Follow the current session's `billing` projection. Selection changes rebind
 * the projection face; face movement re-reads the snapshot. The sessions
 * service owns selection, so this source follows the seam's selection feed
 * instead of a list store of its own.
 * @param projection - the current-session projection seam.
 * @returns the cost source.
 */
export function createBillingCostSource(projection) {
    let face;
    let unsubscribeFace;
    let value;
    const listeners = new Set();
    const notify = () => {
        for (const fn of [...listeners])
            fn();
    };
    const sync = () => {
        const next = projection.face('billing');
        if (next !== face) {
            unsubscribeFace?.();
            face = next;
            unsubscribeFace = face?.subscribe(sync);
        }
        const nextValue = face?.getSnapshot();
        if (nextValue !== value) {
            value = nextValue;
            notify();
        }
    };
    const unsubscribeCurrent = projection.subscribe(sync);
    sync();
    return {
        getSnapshot: () => value,
        subscribe: (fn) => {
            listeners.add(fn);
            return () => { listeners.delete(fn); };
        },
        dispose: () => {
            unsubscribeCurrent();
            unsubscribeFace?.();
        },
    };
}
/**
 * Read the provider account balance through the `/billing` connection
 * channel. Subscribers start the refresh loop (immediate read + interval);
 * the last subscriber stops it.
 * @param rpc - the connection's generic channel caller.
 * @returns the balance source.
 */
export function createBalanceSource(rpc) {
    let snapshot = { status: 'idle' };
    let inflight;
    let timer;
    const listeners = new Set();
    const notify = () => {
        for (const fn of [...listeners])
            fn();
    };
    const refresh = async () => {
        if (inflight !== undefined)
            return inflight;
        snapshot = { ...snapshot, status: 'loading' };
        notify();
        inflight = (async () => {
            try {
                const response = await rpc.call(BALANCE_CHANNEL, 'balance', {});
                if (response.ok) {
                    const value = response.value;
                    snapshot = value?.balance === undefined
                        ? { status: 'ok' }
                        : { status: 'ok', balance: value.balance };
                }
                else {
                    snapshot = { status: 'error', error: response.error.message };
                }
            }
            catch (error) {
                snapshot = { status: 'error', error: error instanceof Error ? error.message : String(error) };
            }
        })().finally(() => { inflight = undefined; });
        await inflight;
        notify();
    };
    const stop = () => {
        if (timer !== undefined) {
            clearInterval(timer);
            timer = undefined;
        }
    };
    const start = () => {
        /* v8 ignore next -- defensive re-entry guard: subscribe gates start() to the first subscriber, so no second call sees a live timer. */
        if (timer !== undefined)
            return;
        void refresh();
        timer = setInterval(() => { void refresh(); }, BALANCE_REFRESH_MS);
    };
    return {
        getSnapshot: () => snapshot,
        subscribe: (fn) => {
            listeners.add(fn);
            if (listeners.size === 1)
                start();
            return () => {
                listeners.delete(fn);
                if (listeners.size === 0)
                    stop();
            };
        },
        refresh,
    };
}
//# sourceMappingURL=sources.js.map