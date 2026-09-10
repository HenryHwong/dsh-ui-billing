/**
 * Browser-side seam over the balance transport: the only module naming the
 * endpoint URL and its JSON shape, so a transport-side change stays a
 * single-file edit. The path literal is duplicated from the node half because a
 * client bundle cannot import it.
 *
 * @module @huanghanheng/dsh-ui-billing/client/seams/connection
 */
/** The node half's balance endpoint. */
const BALANCE_PATH = '/api/billing.balance';
/**
 * Read the provider account balance.
 * @param signal - optional caller cancellation.
 * @returns the read outcome; transport and HTTP failures fold into the failure branch.
 */
export async function readProviderBalance(signal) {
    try {
        const response = await fetch(BALANCE_PATH, {
            method: 'POST',
            ...(signal === undefined ? {} : { signal }),
        });
        const body = await response.json().catch(() => undefined);
        if (!response.ok || body?.error !== undefined) {
            return {
                ok: false,
                error: typeof body?.error?.message === 'string'
                    ? body.error.message
                    : `ui-billing: balance read failed (HTTP ${response.status})`,
            };
        }
        return { ok: true, ...(body?.balance === undefined ? {} : { balance: body.balance }) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
//# sourceMappingURL=connection.js.map