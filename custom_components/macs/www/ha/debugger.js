import { DEBUGGING } from "./constants.js";

export function createDebugger(namespace, enabled = DEBUGGING) {
    if (enabled && DEBUGGING) {
        const ns = (namespace || "general").toString();
        return (...args) => {
            console.log(`[MACS:${ns}]`, ...args);
        };
    }

    return () => {};
}
