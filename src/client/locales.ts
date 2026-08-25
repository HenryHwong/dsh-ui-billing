/** `billing` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'cost.label': '本对话费用',
  'balance.label': 'API 余额',
  'balance.loading': '查询中…',
  'balance.unavailable': '余额不可用',
  'balance.refresh': '刷新余额',
} satisfies Record<string, string>

/** The billing namespace key union. */
export type BillingKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'cost.label': 'Chat cost',
  'balance.label': 'API balance',
  'balance.loading': 'Loading…',
  'balance.unavailable': 'Balance unavailable',
  'balance.refresh': 'Refresh balance',
} satisfies Record<BillingKey, string>
