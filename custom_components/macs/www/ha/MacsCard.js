/**
 * MacsCard
 * --------
 * Main Home Assistant Lovelace card implementation for M.A.C.S.
 * (Mood-Aware Character SVG).
 *
 * This file defines the custom Lovelace card element responsible for:
 * - Rendering the M.A.C.S. UI inside an iframe
 * - Passing Home Assistant state (mood, weather, brightness, etc) to the iframe
 * - Bridging Assist pipeline data (conversation turns) from Home Assistant
 *   to the frontend character via postMessage
 *
 * All backend interaction (WebSocket calls, event subscriptions, auth usage)
 * occurs here, while the iframe is kept sandboxed and display-focused.
 *
 * This file represents the core integration layer between Home Assistant
 * and the M.A.C.S. frontend character.
 */

import {
  DEFAULTS,
  MOOD_ENTITY_ID,
  WEATHER_ENTITY_ID,
  BRIGHTNESS_ENTITY_ID,
  CONVERSATION_ENTITY_ID
} from "./constants.js";

import {
	normMood,
	normWeather,
	normBrightness,
	safeUrl,
	getTargetOrigin,
    assistStateToMood
} from "./validators.js";

import { SatelliteTracker } from "./assistSatellite.js";



export class MacsCard extends HTMLElement {
    // returns the minimum valid config Home Assistant needs to add the card to a dashboard before the user configures anything.
    static getStubConfig() { 
        return { 
            type: "custom:macs-card", 
            assist_pipeline_enabled: false, 
            pipeline_custom: false, 
            preview_image: DEFAULTS.preview_image
        }; 
    }

    // create the card editor
    static getConfigElement() {
        return document.createElement("macs-card-editor");
    }

    // Load the Macs Card and Configs
    setConfig(config) {
        // ensure we have a valid config object
        if (!config || typeof config !== "object"){
            throw new Error("macs-card: invalid config");
        }

        // locked to postmessage mode - todo, remove this option
        //const mode = "postMessage";

        // merge defaults with user config. Todo, remove mode?
        this._config = { ...DEFAULTS, ...config}; //, mode };

        // Only run the first time setConfig is called
        if (!this._root) {
            // Shadow DOM wrapper + iframe shell
            // (Creating a Shadow Root so CSS styles don’t mess with HA, and HA styles don’t mess with Macs.)
            this._root = this.attachShadow({ mode: "open" });

            // the iframe (hidden whilst loading - display thumbnail instead)
            this._root.innerHTML = `
                <style>
                    :host { display: block; height: 100%; }
                    ha-card { height: 100%; overflow: hidden; border-radius: var(--ha-card-border-radius, 12px); }
                    .wrap { height: 100%; width: 100%; }
                    iframe, img { border: 0; width: 100%; height: 100%; display: block; }
                    img { object-fit: cover; }
                    .hidden { display: none !important; }
                </style>
                <ha-card><div class="wrap"><img class="thumb" /><iframe class="hidden"></iframe></div></ha-card>
            `;
            this._iframe = this._root.querySelector("iframe");

            // preview image (shown before iframe is ready)
            this._thumb = this._root.querySelector("img.thumb");
            if (this._thumb) {   
                if (this._config.preview_image){
                    this._thumb.src = this._config.preview_image.toString();
                }
                else {
                    this._thumb.src = DEFAULTS.preview_image;
                }
            }

            // keep load/render state
            this._loadedOnce = false;
            this._lastMood = undefined;
            this._lastSrc = undefined;

            // Keep home assistant state
            this._hass = null;

            // Keep assistant conversation history
            // newest first: [{runId, heard, reply, error, ts}]
            this._turns = []; 
            // Remember which message we saw last to prevent processing the same message again
            this._lastSeen = { runId: null, ts: null };

            // Prevents fetching calls when HA is updating rapidly
            this._fetchDebounce = null;

            // Keep an unsubscribe function so we can clean up later
            this._unsubStateChanged = null;



            this._assistSatelliteOutcome = new SatelliteTracker({});

            // Listen for messages from HA to the iframe
            this._onMessage = this._onMessage.bind(this);
            window.addEventListener("message", this._onMessage);
        }
    }

    // make sure we remove event listeners when unloaded
    disconnectedCallback() {
        try { window.removeEventListener("message", this._onMessage); } catch (_) {} 

        try { if (this._unsubStateChanged) this._unsubStateChanged(); } catch (_) {}

        try { if (this._fetchDebounce) clearTimeout(this._fetchDebounce); } catch (_) {}
        this._fetchDebounce = null;

        // remove the assist satellite class
        try { this._assistSatelliteOutcome?.dispose?.(); } catch (_) {}
        this._assistSatelliteOutcome = null;

        this._unsubStateChanged = null;
    }





    /* ---------- Send data to iFrame ---------- */

    _postToIframe(payload) {
        if (!this._iframe?.contentWindow) return;
        // Post to the iframe window; targetOrigin "*" is safe here because we target a specific window.
        try { this._iframe.contentWindow.postMessage(payload, "*"); } catch (_) {}
    }

    _pipelineEnabled() { 
        return !!this._config?.assist_pipeline_enabled && !!(this._config?.pipeline_id || "").toString().trim(); 
    }


    _sendConfigToIframe() {
        const enabled = !!this._config.assist_pipeline_enabled;
        const pipeline_id = enabled ? (this._config.pipeline_id || "").toString().trim() : "";
        this._postToIframe({ type: "macs:config", pipeline_id });
    }

    _sendMoodToIframe(mood) {
        this._postToIframe({ type: "macs:mood", mood });
    }
    _sendWeatherToIframe(weather) {
        this._postToIframe({ type: "macs:weather", weather });
    }
    _sendBrightnessToIframe(brightness) {
        this._postToIframe({ type: "macs:brightness", brightness });
    }

    _sendTurnsToIframe() {
        // Turns are kept newest-first in the card, but sent as-is
        this._postToIframe({ type: "macs:turns", turns: this._turns.slice() });
    }

    _onMessage(e) {
        if (!this._iframe?.contentWindow) return;
        if (e.source !== this._iframe.contentWindow) return;

        // Origin check: allow "null" for sandboxed iframes; otherwise require the iframe URL origin.
        const base = safeUrl(this._config?.url);
        const expectedOrigin = getTargetOrigin(base.toString());
        if (e.origin !== expectedOrigin && e.origin !== "null") return;

        if (!e.data || typeof e.data !== "object") return;

        // Iframe requests initial config and current turns
        if (e.data.type === "macs:request_config") {
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }






    /* ---------- Capture assist messages - uses assist pipeline websockets, and HASS auth ---------- */

    // a turn is one user message and following system response consisting of: 
    // runId, heard, reply, error, ts

    // Keep only the most recent N turns.
    _upsertTurn(t) {
        // Deduplicate by runId and keep newest-first, capped by max_turns
        const maxTurns = Math.max(1, parseInt(this._config.max_turns ?? DEFAULTS.max_turns, 10) || DEFAULTS.max_turns);

        const idx = this._turns.findIndex(x => x.runId === t.runId);

        if (idx === 0) { this._turns[0] = { ...this._turns[0], ...t }; return; }

        if (idx > 0) {
            const merged = { ...this._turns[idx], ...t };
            this._turns.splice(idx, 1);
            this._turns.unshift(merged);
        } else {
            this._turns.unshift(t);
            if (this._turns.length > maxTurns) this._turns.length = maxTurns;
        }
    }

    _extract(events) {
        // Pull just the pieces we render from pipeline debug events
        let heard = "", reply = "", error = "", ts = "";
        for (const ev of (events || [])) {
            if (!ts && ev.timestamp) ts = ev.timestamp;

            if (!heard && ev.type === "intent-start") heard = ev.data?.intent_input || "";
            if (ev.type === "stt-end") heard = ev.data?.stt_output?.text || heard;

            if (ev.type === "intent-end") reply = ev.data?.intent_output?.response?.speech?.plain?.speech || reply;

            if (ev.type === "error") error = `${ev.data?.code || "error"}: ${ev.data?.message || ""}`.trim();
        }
        return { heard, reply, error, ts };
    }

    async _listRuns() {
        // Pipeline debug list call (frontend-authenticated)
        const pid = (this._config.pipeline_id || "").toString().trim();
        if (!pid) return null;
        // Uses frontend auth automatically
        return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/list", pipeline_id: pid });
    }

    async _getRun(runId) {
        // Fetch a single pipeline run for detailed events
        const pid = (this._config.pipeline_id || "").toString().trim();
        if (!pid || !runId) return null;
        return await this._hass.callWS({ type: "assist_pipeline/pipeline_debug/get", pipeline_id: pid, pipeline_run_id: runId });
    }

    _triggerFetchNewest() {
        if (this._fetchDebounce) return;
        this._fetchDebounce = setTimeout(() => { this._fetchDebounce = null; this._fetchNewest().catch(() => {}); }, 160);
    }

    async _fetchNewest() {
        // user must be authenticated
        if (!this._hass) return;

        // ignore if pipeline not enabled
        if (!this._pipelineEnabled()) return;

        // make sure we have a pipeline id
        const pid = (this._config.pipeline_id || "").toString().trim();
        if (!pid) return;

        // List runs and find newest
        const listed = await this._listRuns();
        const newest = listed?.pipeline_runs?.at?.(-1) || (Array.isArray(listed?.pipeline_runs) ? listed.pipeline_runs[listed.pipeline_runs.length - 1] : null);
        if (!newest) return;

        // Check if the newest run has changed
        const changed = newest.pipeline_run_id !== this._lastSeen.runId || newest.timestamp !== this._lastSeen.ts;
        if (!changed) return;

        // Remember last seen
        this._lastSeen = { runId: newest.pipeline_run_id, ts: newest.timestamp };

        // Fetch multiple times because pipeline events can arrive late
        const runId = this._lastSeen.runId;
        for (const delay of [0, 250, 700]) {
            setTimeout(async () => {
                try {
                    const got = await this._getRun(runId);
                    const events = got?.events || null;
                    if (!events) return;

                    // Extract turn data and upsert
                    const parsed = { ...this._extract(events), runId };
                    if (parsed.heard || parsed.reply || parsed.error) {
                        this._upsertTurn(parsed);
                        this._sendTurnsToIframe();
                    }
                } catch (_) {}
            }, delay);
        }
    }

    // // Subscribe to conversation entity changes to trigger pipeline refresh
    _ensureSubscriptions() {
        if (!this._hass) return;
        const shouldSub = this._pipelineEnabled();
        
        if (shouldSub && !this._unsubStateChanged) {
            this._unsubStateChanged = this._hass.connection.subscribeEvents((ev) => {
                try {
                    if (ev?.data?.entity_id !== CONVERSATION_ENTITY_ID) return;
                    this._triggerFetchNewest();
                } catch (_) {}
            }, "state_changed");
        }

        if (!shouldSub && this._unsubStateChanged) {
            try { this._unsubStateChanged(); } catch (_) {}
            this._unsubStateChanged = null;
        }
    }



    /* ---------- hass hook ---------- */

    set hass(hass) {
        if (!this._config || !this._iframe) return;

        this._hass = hass;
        if (this._thumb && this._iframe) { this._thumb.classList.add("hidden"); this._iframe.classList.remove("hidden"); }
        this._ensureSubscriptions();

        const moodState = hass.states[MOOD_ENTITY_ID] || null;
        //const mood = normMood(moodState?.state);
        const baseMood = normMood(moodState?.state);
        // Optional: auto mood from selected satellite state
        let assistMood = null;
        let satState = ""; 

        if (this._config?.assist_states_enabled) {
            const satId = (this._config.assist_satellite_entity || "").toString().trim();
            if (satId) {
                const satStateObj = hass.states[satId] || null;
                satState = (satStateObj?.state || "").toString().trim().toLowerCase(); 
                assistMood = assistStateToMood(satState);
                const tracker = this._assistSatelliteOutcome;
                debug(tracker);
                if (this._config?.assist_states_enabled && satState && tracker) tracker.update(satState);
            }
        }

        // const now = Date.now();
        const overrideMood = this._assistSatelliteOutcome?.getOverrideMood?.();
        const mood = overrideMood ? overrideMood : ((this._config?.assist_states_enabled && assistMood) ? assistMood : baseMood);



        const weatherState = hass.states[WEATHER_ENTITY_ID] || null;
        const weather = normWeather(weatherState?.state);

        const brightnessState = hass.states[BRIGHTNESS_ENTITY_ID] || null;
        const brightness = normBrightness(brightnessState?.state);

        const base = safeUrl(this._config.url);
        const sendAll = () => {
            this._sendConfigToIframe();
            this._sendMoodToIframe(mood);
            this._sendWeatherToIframe(weather);
            this._sendBrightnessToIframe(brightness);
            this._sendTurnsToIframe();
        };

        if (!this._loadedOnce) {
            // First load: set iframe src and send initial state
            base.searchParams.set("mood", mood);
            base.searchParams.set("weather", weather);
            base.searchParams.set("brightness", brightness.toString());

            const src = base.toString();
            this._iframe.onload = () => {
                sendAll();
                // First fetch after iframe is alive
                this._triggerFetchNewest();
            };

            if (src !== this._lastSrc) {
                this._iframe.src = src;
                this._lastSrc = src;
            }

            this._loadedOnce = true;
            this._lastMood = mood;
            this._lastWeather = undefined;

            setTimeout(sendAll, 0);
        }
        else {
            // Subsequent updates: only send what changed
            if (mood !== this._lastMood) {
                this._lastMood = mood;
                this._sendMoodToIframe(mood);
            }
            if (weather !== this._lastWeather) {
                this._lastWeather = weather;
                this._sendWeatherToIframe(weather);
            }
            if(brightness !== this._lastBrightness) {
                this._lastBrightness = brightness;
                this._sendBrightnessToIframe(brightness);
            }

            // keep config/turns fresh
            this._sendConfigToIframe();
            this._sendTurnsToIframe();
        }
    }

    getCardSize() {
        return 6;
    }
}

