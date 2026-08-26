/**
 * Vendored type-only mirror of `@deepseek-ai/dsh-billing/client` — the
 * `billing` session-projection type surface. The plugin's node half registers
 * the projection itself (src/projection.ts), and the harness ships the host
 * package as `@deepseek-ai/dsh-billing`; until that release lands on npm this
 * file stands in for the type-only import the browser half makes
 * (`BillingProjection`). Runtime code never sees it: the import is erased at
 * build, and the widget reads the projection face dynamically through the
 * runtime's projections outlet.
 *
 * Keep these interfaces in sync with the projection's wire view
 * (src/projection.ts in this repository).
 */

/** Whole-log cost projection for one session, in CNY. */
export interface BillingProjection {
  /** Accumulated cost in CNY over every usage-reporting step whose model has a configured price. */
  cost: number
  /**
   * Tokens whose usage settled while their model had no configured price.
   * Kept separate so a GUI can say "cost" without pretending unknown-priced
   * models are free.
   */
  unpricedTokens: number
}

/** Per-million-token price of one model, in CNY. */
export interface ModelPrice {
  /** CNY per million uncached input tokens. */
  inputPerM: number
  /** CNY per million cache-hit input tokens; omitted when the provider does not bill them. */
  cacheReadPerM?: number
  /** CNY per million cache-write input tokens; omitted when the provider does not bill them. */
  cacheWritePerM?: number
  /** CNY per million output tokens. */
  outputPerM: number
}

/** One model's price schedule; only `offPeak` is required to show any cost. */
export interface TieredModelPrice {
  /** Price during peak hours. */
  peak?: ModelPrice
  /** Price outside peak hours. */
  offPeak?: ModelPrice
}

/** Billing configuration; prices are the deployment's responsibility. */
export interface BillingConfig {
  /** CNY-per-million-token prices by model id; models without an entry count as unpriced. */
  prices?: Record<string, TieredModelPrice>
  /** Peak-hour windows, each `[start, end]` in minutes since midnight of the price clock. */
  peakHours?: [number, number][]
  /** Fixed UTC offset of the price clock in minutes. */
  utcOffsetMinutes?: number
}
