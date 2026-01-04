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

    return "";
}

function ensureManifestVersion() {
    if (window.__MACS_VERSION__) {
        return Promise.resolve(window.__MACS_VERSION__);
    }

    if (window.__MACS_VERSION_PROMISE__) {
        return window.__MACS_VERSION_PROMISE__;
    }

    window.__MACS_VERSION_PROMISE__ = fetch("/macs-manifest.json", { cache: "no-store" })
        .then((resp) => (resp.ok ? resp.json() : null))
        .then((data) => {
            const version = (data && data.version ? String(data.version) : "").trim();
            if (version) {
                window.__MACS_VERSION__ = version;
            }
            return window.__MACS_VERSION__ || "";
        })
        .catch(() => "");

    return window.__MACS_VERSION_PROMISE__;
}

function renderVersion(debugDiv, version) {
    if (!debugDiv) return;
    let versionEl = debugDiv.querySelector(".debug-version");
    if (!versionEl) {
        versionEl = document.createElement("div");
        versionEl.className = "debug-version";
        debugDiv.appendChild(versionEl);
    }
    versionEl.textContent = "Version: " + (version || "Unknown");
}

export function createDebugger(namespace, enabled = DEBUGGING) {
    if (enabled && DEBUGGING) {
        const ns = (namespace || "general").toString();
        const debugDiv = document.getElementById('debug');
        const version = getMacsVersion();
        if(debugDiv){
            debugDiv.style.display = "block";
            debugDiv.innerHTML = "<h1>Debugging</h1>";
            renderVersion(debugDiv, version);
            if (!version) {
                ensureManifestVersion().then((resolved) => {
                    if (resolved) renderVersion(debugDiv, resolved);
                });
            }
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
