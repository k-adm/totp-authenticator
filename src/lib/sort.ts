import type { Account, SortMode } from "./types";

function serviceName(a: Account): string {
  return a.issuer || a.label || a.account || "";
}

/** Sort accounts for display. Storage order (`order`) is left untouched. */
export function sortAccounts(accounts: Account[], mode: SortMode): Account[] {
  const list = [...accounts];
  switch (mode) {
    case "custom":
      return list.sort((a, b) => a.order - b.order);
    case "recent":
      return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    case "name":
    default:
      return list.sort((a, b) =>
        serviceName(a).localeCompare(serviceName(b), undefined, {
          sensitivity: "base",
        }),
      );
  }
}
