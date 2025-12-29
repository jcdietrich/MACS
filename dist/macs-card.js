/* Macs Lovelace Card + Editor
 * - type: custom:macs-card
 * - entity: select.macs_mood (required)
 * - url: /local/macs/macs.html (optional)
 * - mode: query | postMessage (optional, default query)
 * - param: mood (optional, query-mode only)
 * - cache_bust: true|false (optional, query-mode only)
 * - pipeline_id: <assist pipeline id> (optional, used in postMessage mode)
 *
 * postMessage payloads sent to iframe:
 *  - { type:"macs:mood", mood }
 *  - { type:"macs:config", token, pipeline_id }
 *
 * iframe can request config:
 *  - posts { type:"macs:request_config" } to parent
 */

(() => {
  "use strict";

  const DEFAULTS = {
    url: "/local/macs/macs.html",
    mode: "query",     // "query" | "postMessage"
    param: "mood",
    cache_bust: false,
    pipeline_id: "",
  };

  function normMood(v) {
    return (typeof v === "string" ? v : "idle").trim().toLowerCase() || "idle";
  }

  function safeUrl(baseUrl) {
    // Always return an absolute URL
    return new URL(baseUrl || DEFAULTS.url, window.location.origin);
  }

  function getTargetOrigin(absoluteUrlString) {
    try { return new URL(absoluteUrlString).origin; } catch { return window.location.origin; }
  }

  class MacsCard extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:macs-card",
        entity: "select.macs_mood",
        url: DEFAULTS.url,
        mode: "postMessage",
        param: DEFAULTS.param,
        cache_bust: false,
        pipeline_id: "",
      };
    }

    static getConfigElement() {
      return document.createElement("macs-card-editor");
    }

    setConfig(config) {
      if (!config || typeof config !== "object") throw new Error("macs-card: invalid config");

      if (!config.entity) {
        this._config = { ...DEFAULTS, ...config };
        if (!this._root) {
          this._root = this.attachShadow({ mode: "open" });
          this._root.innerHTML = `
            <ha-card style="padding:16px">
              <div style="opacity:.8">Macs Card: please set <b>entity</b> in the editor.</div>
            </ha-card>
          `;
        }
        return;
      }

      const mode = (config.mode ?? DEFAULTS.mode).toString();
      if (!["query", "postMessage"].includes(mode)) throw new Error("macs-card: 'mode' must be 'query' or 'postMessage'");

      this._config = { ...DEFAULTS, ...config, mode };

      if (!this._root) {
        this._root = this.attachShadow({ mode: "open" });
        this._root.innerHTML = `
          <style>
            :host { display: block; height: 100%; }
            ha-card {
              height: 100%;
              overflow: hidden;
              border-radius: var(--ha-card-border-radius, 12px);
            }
            .wrap { height: 100%; width: 100%; }
            iframe { border: 0; width: 100%; height: 100%; display: block; }
          </style>
          <ha-card>
            <div class="wrap"><iframe></iframe></div>
          </ha-card>
        `;

        this._iframe = this._root.querySelector("iframe");
        this._loadedOnce = false;
        this._lastMood = undefined;
        this._lastSrc = undefined;

        this._hass = null;

        // bind once
        this._onMessage = this._onMessage.bind(this);
        window.addEventListener("message", this._onMessage);
      }
    }

    disconnectedCallback() {
      try { window.removeEventListener("message", this._onMessage); } catch (_) {}
    }

    // Pull an access token from the HA frontend auth object.
    // This is intentionally "best effort" and avoids hard dependencies on internal shapes.
    _getAccessTokenFromHass(hass) {
      if (!hass) return null;

      // Common modern shape: hass.auth.data.access_token
      const t1 = hass.auth?.data?.access_token;
      if (typeof t1 === "string" && t1) return t1;

      // Some builds expose auth.accessToken
      const t2 = hass.auth?.accessToken;
      if (typeof t2 === "string" && t2) return t2;

      // Some expose a connection with an access token (rare)
      const t3 = hass.connection?._auth?.data?.access_token;
      if (typeof t3 === "string" && t3) return t3;

      return null;
    }

    _postToIframe(payload) {
      if (!this._iframe?.contentWindow) return;

      const base = safeUrl(this._config.url);
      const targetOrigin = getTargetOrigin(base.toString());

      try { this._iframe.contentWindow.postMessage(payload, targetOrigin); } catch (_) {}
    }

    _sendConfigToIframe() {
      const pipeline_id = (this._config.pipeline_id || "").toString().trim();
      const token = this._getAccessTokenFromHass(this._hass);

      // Always send pipeline_id if set; token only if available.
      this._postToIframe({
        type: "macs:config",
        pipeline_id: pipeline_id || "",
        token: token || "",
      });
    }

    _sendMoodToIframe(mood) {
      this._postToIframe({ type: "macs:mood", mood });
    }

    _onMessage(e) {
      // Only accept messages from the iframe we own
      if (!this._iframe?.contentWindow) return;
      if (e.source !== this._iframe.contentWindow) return;

      // Only accept same-origin (or the iframe's origin if different, but you should keep it same-origin)
      const base = safeUrl(this._config?.url);
      const expectedOrigin = getTargetOrigin(base.toString());
      if (e.origin !== expectedOrigin) return;

      if (!e.data || typeof e.data !== "object") return;

      // Handshake: iframe asks for config
      if (e.data.type === "macs:request_config") {
        this._sendConfigToIframe();
      }
    }

    set hass(hass) {
      if (!this._config || !this._iframe) return;

      this._hass = hass;

      const st = hass.states[this._config.entity];
      const mood = normMood(st?.state);

      const base = safeUrl(this._config.url);

      if (this._config.mode === "postMessage") {
        const sendAll = () => {
          this._sendConfigToIframe();
          this._sendMoodToIframe(mood);
        };

        if (!this._loadedOnce) {
          // include initial mood in URL so iframe is correct immediately
          base.searchParams.set(this._config.param || DEFAULTS.param, mood);

          // optional cache bust (works for postMessage too)
          if (this._config.cache_bust) base.searchParams.set("t", String(Date.now()));

          const src = base.toString();

          this._iframe.onload = () => sendAll();

          if (src !== this._lastSrc) {
            this._iframe.src = src;
            this._lastSrc = src;
          }

          this._loadedOnce = true;
          this._lastMood = mood;

          // fire immediately too (iframe may already be ready)
          setTimeout(sendAll, 0);
        } else {
          // Mood changed: only re-send mood; but also send config occasionally (safe, cheap)
          if (mood !== this._lastMood) {
            this._lastMood = mood;
            this._sendMoodToIframe(mood);
          }
          // Keep config fresh (token may rotate): send config on every hass update
          this._sendConfigToIframe();
        }
        return;
      }

      // query mode: rebuild src with ?param=mood
      base.searchParams.set(this._config.param || DEFAULTS.param, mood);
      if (this._config.cache_bust) base.searchParams.set("t", String(Date.now()));
      const nextSrc = base.toString();

      if (nextSrc !== this._lastSrc) {
        this._iframe.src = nextSrc;
        this._lastSrc = nextSrc;
      }

      this._loadedOnce = true;
      this._lastMood = mood;
    }

    getCardSize() {
      return 6;
    }
  }

  // Guard against duplicate define during dev reloads
  if (!customElements.get("macs-card")) customElements.define("macs-card", MacsCard);

  // Make it show up in the card picker description list (YAML still needed sometimes)
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "macs-card",
    name: "Macs Card",
    description: "Displays Macs and drives mood from an entity (query or postMessage). Includes pipeline_id + token postMessage.",
  });

  class MacsCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = { ...DEFAULTS, ...(config || {}) };
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._rendered) this._sync();
    }

    _render() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });

      this.shadowRoot.innerHTML = `
        <style>
          .row { display: grid; gap: 12px; }
          .inline { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .hint { opacity: 0.8; font-size: 12px; }
        </style>

        <div class="row">
          <ha-entity-picker id="entity" label="Mood entity" allow-custom-entity></ha-entity-picker>

          <ha-textfield id="url" label="Macs URL" placeholder="/local/macs/macs.html"></ha-textfield>

          <ha-textfield id="pipeline_id" label="Assist pipeline ID (postMessage mode)" placeholder="01k..."></ha-textfield>

          <div class="inline">
            <ha-select id="mode" label="Mode">
              <mwc-list-item value="query">query (reload iframe)</mwc-list-item>
              <mwc-list-item value="postMessage">postMessage (no reload)</mwc-list-item>
            </ha-select>

            <ha-textfield id="param" label="Query param (query mode)" placeholder="mood"></ha-textfield>
          </div>

          <ha-formfield label="Cache bust (query mode)">
            <ha-switch id="cache_bust"></ha-switch>
          </ha-formfield>

          <div class="hint">
            postMessage mode sends: <code>macs:mood</code> and <code>macs:config</code> (token + pipeline_id).<br>
            Macs should listen for <code>macs:config</code> and/or request it via <code>macs:request_config</code>.
          </div>
        </div>
      `;

      this._rendered = true;
      this._wire();
      this._sync();
    }

    _sync() {
      if (!this.shadowRoot) return;

      const ep = this.shadowRoot.getElementById("entity");
      if (ep) {
        ep.hass = this._hass;
        ep.includeDomains = ["select", "input_text", "input_select", "sensor"];
        ep.value = this._config.entity || "";
      }

      const url = this.shadowRoot.getElementById("url");
      if (url) url.value = this._config.url ?? DEFAULTS.url;

      const pipeline = this.shadowRoot.getElementById("pipeline_id");
      if (pipeline) pipeline.value = this._config.pipeline_id ?? DEFAULTS.pipeline_id;

      const mode = this.shadowRoot.getElementById("mode");
      if (mode) mode.value = this._config.mode ?? DEFAULTS.mode;

      const param = this.shadowRoot.getElementById("param");
      if (param) param.value = this._config.param ?? DEFAULTS.param;

      const cb = this.shadowRoot.getElementById("cache_bust");
      if (cb) cb.checked = !!this._config.cache_bust;

      this._toggleQueryFields();
    }

    _toggleQueryFields() {
      const mode = (this.shadowRoot.getElementById("mode")?.value || DEFAULTS.mode).toString();

      const param = this.shadowRoot.getElementById("param");
      const cbWrap = this.shadowRoot.querySelector("ha-formfield");
      const cb = this.shadowRoot.getElementById("cache_bust");
      const pid = this.shadowRoot.getElementById("pipeline_id");

      if (param) param.disabled = mode !== "query";
      if (cbWrap) cbWrap.style.opacity = mode === "query" ? "1" : "0.5";
      if (cb) cb.disabled = mode !== "query";

      // Pipeline ID only relevant in postMessage mode
      if (pid) pid.disabled = mode !== "postMessage";
      if (pid) pid.style.opacity = mode === "postMessage" ? "1" : "0.6";
    }

    _wire() {
      const onChange = () => {
        const entity = this.shadowRoot.getElementById("entity")?.value || "";
        const url = this.shadowRoot.getElementById("url")?.value || DEFAULTS.url;
        const pipeline_id = this.shadowRoot.getElementById("pipeline_id")?.value || "";
        const mode = this.shadowRoot.getElementById("mode")?.value || DEFAULTS.mode;
        const param = this.shadowRoot.getElementById("param")?.value || DEFAULTS.param;
        const cache_bust = !!this.shadowRoot.getElementById("cache_bust")?.checked;

        const next = {
          type: "custom:macs-card",
          entity,
          url,
          mode,
          param,
          cache_bust,
          pipeline_id,
        };

        // Clean up config for postMessage mode
        if (mode !== "query") {
          delete next.param;
          delete next.cache_bust;
        } else {
          if (!next.param) next.param = DEFAULTS.param;
        }

        // Clean up pipeline id for query mode (optional, but keeps configs tidy)
        if (mode !== "postMessage") {
          delete next.pipeline_id;
        }

        this._config = { ...DEFAULTS, ...next };
        this._toggleQueryFields();

        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: next },
            bubbles: true,
            composed: true,
          })
        );
      };

      ["entity", "url", "pipeline_id", "mode", "param", "cache_bust"].forEach((id) => {
        const el = this.shadowRoot.getElementById(id);
        if (!el) return;
        el.addEventListener("change", onChange);
        el.addEventListener("input", onChange);
      });
    }
  }

  if (!customElements.get("macs-card-editor")) customElements.define("macs-card-editor", MacsCardEditor);
})();
