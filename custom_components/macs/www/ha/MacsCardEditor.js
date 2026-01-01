import {
  DEFAULTS,
} from "./constants.js";

export class MacsCardEditor extends HTMLElement {
	// get the defaults, and apply user's config
	setConfig(config) {
		this._config = { ...DEFAULTS, ...(config || {}) };
		this._render();
	}

	set hass(hass) {
		this._hass = hass;
		if (this._rendered) this._sync();
	}

	// get assistant pipelines from HA (Do this before rendering the editor so combobox can be populated)
	async _loadPipelines() {
		if (!this._hass) return { pipelines: [], preferred: "" };

		const res = await this._hass.callWS({ type: "assist_pipeline/pipeline/list" });

		const pipelines = Array.isArray(res?.pipelines) ? res.pipelines : [];
		const preferred = (res?.preferred_pipeline || "").toString();

		return {
			preferred,
			pipelines: pipelines
				.map(p => ({ id: (p.id || "").toString(), name: (p.name || p.id || "Unnamed").toString() }))
				.filter(p => p.id),
		};
	}

	// render the card editor UI
	async _render() {
		if (!this.shadowRoot) this.attachShadow({ mode: "open" });

		// Get Assistant Piplines. Set preferred as default option if user hasn't chosen one yet.
		const pipelinesPayload = this._hass ? await this._loadPipelines() : { pipelines: [], preferred: "" };
		const pipelines = pipelinesPayload.pipelines || [];
		const preferred = pipelinesPayload.preferred || "";
		const items = [{ id: "custom", name: "Custom" }, ...pipelines];

		// Build DOM
		this.shadowRoot.innerHTML = `
			<style>
				.row{display:block;width:100%;margin-bottom:16px;}
				.hint{opacity:0.7;font-size:90%;margin-top:4px;}
				#pipeline_select, #pipeline_id, #max_turns { width: 100%; }
				.about{margin-top:40px;border:1px solid var(--divider-color);border-left:none;border-right:none;padding:10px 0;}
				.about-toggle{cursor:pointer;opacity:0.6;}
				.about-content{padding-left:10px;opacity:0.9;}
			</style>

			<div class="row">
				Enable Assist pipeline
				<ha-switch id="assist_pipeline_enabled"></ha-switch>
				<div class="hint"> (Allow Macs to react to interactions with the assistant. For custom automations, Macs acts like any other device where you can adjust brightness, mood, weather etc.)</div>
			</div>

			<div class="row">
				<ha-combo-box id="pipeline_select" label="Assistant"></ha-combo-box>
			</div>

			<div class="row">
				<ha-textfield id="pipeline_id" label="Assistant Pipeline ID" placeholder="01k..."></ha-textfield>
			</div>

			<div class="row about">
			<div class="about-toggle" tabindex="0" role="button">
				About M.A.C.S. 
				<span class="about-arrow">&gt;</span>
			</div>

			<div class="about-content" hidden>
				<p>
					<strong>M.A.C.S.</strong> (Mood-Aware Character SVG) is a playful Home Assistant card that adds personality to your smart home, responding visually to system events such as voice interactions and custom automations.
				</p>

				<p>
					M.A.C.S. is being developed by <strong>Glyn Davidson</strong> (Developer, climber, and chronic tinkerer of occasionally useful tools) in his free time.
				</p>

				<p class="support">
					If you find M.A.C.S. useful and would like to encourage its ongoing development with new features and bug fixes, please consider 
					<br>
					<ha-icon icon="mdi:coffee"></ha-icon>
					<a href="https://buymeacoffee.com/glyndavidson" target="_blank" rel="noopener">
						buying me a coffee
					</a>.
				</p>
			</div>
			</div>
		`;

		// About/Support toggle
		const toggle = this.shadowRoot.querySelector(".about-toggle");
		const arrow = this.shadowRoot.querySelector(".about-arrow");
		const content = this.shadowRoot.querySelector(".about-content");

		if (toggle && arrow && content) {
			toggle.addEventListener("click", () => {
				const open = !content.hasAttribute("hidden");
				content.toggleAttribute("hidden", open);
				arrow.textContent = open ? "›" : "▾";
			});
		}

		// Page has rendered
		this._rendered = true;
		this._pipelinesLoaded = false;

		const sel = this.shadowRoot.getElementById("pipeline_select");
		if (sel) {
			sel.items = items;
			sel.itemLabelPath = "name";
			sel.itemValuePath = "id";
		}
		this._pipelineItems = items;

		// Preselect based on saved config before sync runs
		if (sel) {
			const pid = (this._config.pipeline_id ?? "").toString();
			const known = items.some(p => p.id === pid && p.id !== "custom");
			const isCustom = !!this._config.pipeline_custom || (!known && pid);
			sel.value = isCustom ? "custom" : pid;
		}

		// Wire once per render (safe because render rebuilds DOM)
		this._wire();

		// Sync UI from config
		this._sync();
		this._pipelinesLoaded = true;

		// If user hasn't set a pipeline yet, pick HA's preferred
		const currentPid = (this._config.pipeline_id ?? "").toString().trim();
		if (!currentPid && preferred && !this._config.pipeline_custom) {
			const next = { type: "custom:macs-card", ...this._config, pipeline_id: preferred, pipeline_custom: false };
			this._config = next;
			this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
		}
	}
	
	_bindSelectOpenState() {
		const sel = this.shadowRoot?.getElementById("pipeline_select");
		if (!sel) return;
		this._selectEl = sel;
		this._menuOpen = false;
		const onOpened = () => { this._menuOpen = true; };
		const onClosed = () => { this._menuOpen = false; };
		sel.addEventListener("opened", onOpened);
		sel.addEventListener("closed", onClosed);
		sel.addEventListener("change", onClosed);
	}

	_closeSelectMenu() {
		const sel = this._selectEl || this.shadowRoot?.getElementById("pipeline_select");
		if (!sel) return;
		const menu = sel.menu || sel.shadowRoot?.querySelector("mwc-menu");
		if (menu) menu.open = false;
		if ("open" in sel) sel.open = false;
		this._menuOpen = false;
	}

	// sync UI state from this._config
	async _sync() {
		if (!this.shadowRoot) return;

		const enabled = !!this._config.assist_pipeline_enabled;

		const sw = this.shadowRoot.getElementById("assist_pipeline_enabled");
		const adv = this.shadowRoot.getElementById("advanced_fields");
		const sel = this.shadowRoot.getElementById("pipeline_select");
		const tf  = this.shadowRoot.getElementById("pipeline_id");
		const maxTurns = this.shadowRoot.getElementById("max_turns");

		// Toggle state
		if (sw && sw.checked !== enabled) sw.checked = enabled;

		// Hide/show advanced block
		if (adv) adv.hidden = !enabled;

		// Also disable inputs when hidden (optional but nice)
		if (sel) sel.disabled = !enabled;
		if (tf) tf.disabled = !enabled;

		// Sync values (only write if changed)
		const pid = (this._config.pipeline_id ?? "").toString();
		const known = Array.isArray(this._pipelineItems) && this._pipelineItems.some(p => p.id === pid && p.id !== "custom");
		const isCustom = !!this._config.pipeline_custom || !known;
		const nextSelect = isCustom ? "custom" : pid;
		if (sel && sel.value !== nextSelect) sel.value = nextSelect;
		if (tf && tf.value !== pid && !tf.matches(":focus-within")) tf.value = pid;
		if (tf) tf.disabled = !enabled || !isCustom;

		const mt = (this._config.max_turns ?? DEFAULTS.max_turns).toString();
		if (maxTurns && maxTurns.value !== mt) maxTurns.value = mt;
	}

	


	// wire up event listeners for user config changes
	_wire() {
		const onChange = (e) => {
			const assist_pipeline_enabled = !!this.shadowRoot.getElementById("assist_pipeline_enabled")?.checked;
			const selEl = this.shadowRoot.getElementById("pipeline_select");
			const selVal = e?.detail?.value ?? selEl?.value ?? "";
			const manualVal = this.shadowRoot.getElementById("pipeline_id")?.value || "";
			const max_turns_raw = this.shadowRoot.getElementById("max_turns")?.value || "";
			const max_turns = Math.max(1, parseInt(max_turns_raw, 10) || DEFAULTS.max_turns);

			const tf = this.shadowRoot.getElementById("pipeline_id");
			const pipeline_custom = selVal === "custom";
			if (tf) tf.disabled = !assist_pipeline_enabled || !pipeline_custom;

			// If custom selected, use manual field; otherwise use the selected pipeline id
			const pipeline_id = pipeline_custom ? manualVal : selVal;

			const next = { type: "custom:macs-card", assist_pipeline_enabled, pipeline_id, pipeline_custom, max_turns };

			this._config = { ...DEFAULTS, ...next };

			// IMPORTANT: do NOT call this._sync() here (HA will call setConfig again)
			this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
		};

		// Change-only listeners (avoid input storm)
		["assist_pipeline_enabled", "pipeline_select", "pipeline_id", "max_turns"].forEach((id) => {
			const el = this.shadowRoot.getElementById(id);
			if (!el) return;
			el.addEventListener("change", onChange);
			if (id === "pipeline_select") {
				el.addEventListener("value-changed", onChange);
				el.addEventListener("input", onChange);
			}
		});
	}

	// escape helper (used when rendering pipeline names)
	_esc(s) {
		return (s ?? "")
			.toString()
			.replace(/[&<>"']/g, (c) => ({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			}[c]));
	}
}