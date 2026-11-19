import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * False on the server and during the first render in the browser, true after.
 * Use it to show a skeleton for anything read from this browser (localStorage),
 * which the prerendered page can't know, instead of a wrong value that then flips.
 */
export function useHydrated() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
