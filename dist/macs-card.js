(() => {
  "use strict";

  const DEFAULTS = {
    url: "/local/macs/macs.html?v=1.0.11",
    mode: "postMessage",
    param: "mood",
    cache_bust: false,
    pipeline_id: "",
  };
  const MOOD_ENTITY_ID = "select.macs_mood";

  function normMood(v) {
    return (typeof v === "string" ? v : "idle").trim().toLowerCase() || "idle";
  }

  function safeUrl(baseUrl) {
    return new URL(baseUrl || DEFAULTS.url, window.location.origin);
  }

  function getTargetOrigin(absoluteUrlString) {
    try { return new URL(absoluteUrlString).origin; } catch { return window.location.origin; }
  }

  class MacsCard extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:macs-card",
        pipeline_id: "",
      };
    }

    static getConfigElement() {
      return document.createElement("macs-card-editor");
    }

    setConfig(config) {
      if (!config || typeof config !== "object") throw new Error("macs-card: invalid config");

      const mode = "postMessage";
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

        this._onMessage = this._onMessage.bind(this);
        window.addEventListener("message", this._onMessage);
      }
    }

    disconnectedCallback() {
      try { window.removeEventListener("message", this._onMessage); } catch (_) {}
    }

    _getAccessTokenFromHass(hass) {
      if (!hass) return null;

      const t1 = hass.auth?.data?.access_token;
      if (typeof t1 === "string" && t1) return t1;

      const t2 = hass.auth?.accessToken;
      if (typeof t2 === "string" && t2) return t2;

      const t3 = hass.connection?._auth?.data?.access_token;
      if (typeof t3 === "string" && t3) return t3;

      return null;
    }

    _postToIframe(payload) {
      if (!this._iframe?.contentWindow) return;

      const base = safeUrl(this._config.url);
      const targetOrigin = getTargetOrigin(base.toString());

      try { this._iframe.contentWindow.postMessage(payload, "*"); } catch (_) {}
    }

    _sendConfigToIframe() {
      const pipeline_id = (this._config.pipeline_id || "").toString().trim();
      const token = this._getAccessTokenFromHass(this._hass);

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
      if (!this._iframe?.contentWindow) return;
      if (e.source !== this._iframe.contentWindow) return;

      const base = safeUrl(this._config?.url);
      const expectedOrigin = getTargetOrigin(base.toString());
if (e.origin !== expectedOrigin && e.origin !== "null") return;

      if (!e.data || typeof e.data !== "object") return;

      if (e.data.type === "macs:request_config") {
        this._sendConfigToIframe();
      }
    }

    set hass(hass) {
      if (!this._config || !this._iframe) return;

      this._hass = hass;

      const st = hass.states[MOOD_ENTITY_ID] || null;
      const mood = normMood(st?.state);

      const base = safeUrl(this._config.url);
      const sendAll = () => {
        this._sendConfigToIframe();
        this._sendMoodToIframe(mood);
      };

      if (!this._loadedOnce) {
        base.searchParams.set(this._config.param || DEFAULTS.param, mood);

        const src = base.toString();

        this._iframe.onload = () => sendAll();

        if (src !== this._lastSrc) {
          this._iframe.src = src;
          this._lastSrc = src;
        }

        this._loadedOnce = true;
        this._lastMood = mood;

        setTimeout(sendAll, 0);
      } else {
        if (mood !== this._lastMood) {
          this._lastMood = mood;
          this._sendMoodToIframe(mood);
        }
        this._sendConfigToIframe();
      }
    }

    getCardSize() {
      return 6;
    }
  }

  if (!customElements.get("macs-card")) customElements.define("macs-card", MacsCard);

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "macs-card",
    name: "Macs Card",
    description: "Displays Macs and drives mood from an entity via postMessage. Includes pipeline_id + token postMessage.",
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
          .hint { opacity: 0.8; font-size: 12px; }
        </style>

        <div class="row">
          <ha-textfield id="pipeline_id" label="Assist pipeline ID" placeholder="01k..."></ha-textfield>

          <div class="hint">
            Sends <code>macs:mood</code> and <code>macs:config</code> (token + pipeline_id).<br>
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

      const pipeline = this.shadowRoot.getElementById("pipeline_id");
      if (pipeline) pipeline.value = this._config.pipeline_id ?? DEFAULTS.pipeline_id;
    }

    _wire() {
      const onChange = () => {
        const pipeline_id = this.shadowRoot.getElementById("pipeline_id")?.value || "";

        const next = {
          type: "custom:macs-card",
          pipeline_id,
        };

        this._config = { ...DEFAULTS, ...next };

        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: next },
            bubbles: true,
            composed: true,
          })
        );
      };

      ["pipeline_id"].forEach((id) => {
        const el = this.shadowRoot.getElementById(id);
        if (!el) return;
        el.addEventListener("change", onChange);
        el.addEventListener("input", onChange);
      });
    }
  }

  if (!customElements.get("macs-card-editor")) customElements.define("macs-card-editor", MacsCardEditor);
})();
