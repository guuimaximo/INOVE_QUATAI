import { getMobileNavItemsForUser, getMobileQuickLinksForUser } from "./access";

export function getMobileNavItems(user, accessProfileMap) {
  return getMobileNavItemsForUser(user, accessProfileMap);
}

export function getMobileQuickLinks(user, accessProfileMap) {
  return getMobileQuickLinksForUser(user, accessProfileMap);
}
