import { DEBUGGING } from "./constants.js";

function readVersionFromSearch(search) {
    try {
        const params = new URLSearchParams(search || "");
        return params.get("v") || params.get("hacstag") || "";
    } catch (_) {
        return "";
    }
}

function getMacsVersion() {
    const globalVersion = (window.__MACS_VERSION__ || "").toString().trim();
    if (globalVersion) return globalVersion;

    const fromLocation = readVersionFromSearch(window.location?.search);
    if (fromLocation) {
        window.__MACS_VERSION__ = fromLocation;
        return fromLocation;
    }

    const scripts = Array.from(document.querySelectorAll("script[src]"));
    for (const script of scripts) {
        const v = readVersionFromSearch(new URL(script.src, window.location.href).search);
        if (v) {
            window.__MACS_VERSION__ = v;
            return v;
        }
    }

    const styles = Array.from(document.querySelectorAll("link[rel=\"stylesheet\"][href]"));
    for (const style of styles) {
        const v = readVersionFromSearch(new URL(style.href, window.location.href).search);
        if (v) {
            window.__MACS_VERSION__ = v;
            return v;
        }
    }

    return "Unknown";
}

export function createDebugger(namespace, enabled = DEBUGGING) {
    if (enabled && DEBUGGING) {
        const ns = (namespace || "general").toString();
        const debugDiv = document.getElementById('debug');
        const version = getMacsVersion();
        if(debugDiv){
            debugDiv.style.display = "block";
            debugDiv.innerHTML = "<h1>Debugging</h1>";
            debugDiv.innerHTML += "Version: " + version + "<br>";
        }
        return (...args) => {
            if(debugDiv){
                debugDiv.innerHTML += args + "<br>";
            }
            console.log(`[MACS:${ns}]`, ...args);
        };
    }

    return () => {};
}
