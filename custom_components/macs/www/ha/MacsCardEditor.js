/**
 * MacsCardEditor
 * ---------------
 * Home Assistant Lovelace card editor for M.A.C.S. (Mood-Aware Character SVG).
 *
 * This file defines the custom editor UI shown in the Lovelace card configuration
 * panel. It allows users to configure how M.A.C.S. integrates with Home Assistant's
 * Assist system, including:
 * - Enabling automatic mood changes based on assistant state
 * - Enabling or disabling dialogue display from the assistant
 *
 * User selections are merged with default values and emitted via `config-changed`
 * events so Home Assistant can persist the card configuration.
 *
 * This file is frontend-only and does not perform any backend logic.
 */

import { DEFAULTS } from "./constants.js";
import { createDebugger } from "./debugger.js";
import { loadAssistantOptions, loadWeatherOptions, readAssistStateInputs, readPipelineInputs, readWeatherInputs, syncAssistStateControls, syncPipelineControls, syncWeatherControls } from "./editorOptions.js";

const DEBUG_ENABLED = false;
const debug = createDebugger("macsCardEditor", DEBUG_ENABLED);


const cssUrl = new URL("./editor.css", import.meta.url).toString();
const styleSheet = `<link rel="stylesheet" href="${cssUrl}">`;

const instructions = `
	<!-- Show dialogue -->
		<div class="group">
			<div class="row">
				<label>Custom Integrations</label>
			<div>
				<p>For custom integrations, Macs works like any other device and exposes entities which allow full control over his behavior.<br>Some examples are given below:</p>
				<div class="entity-grid">
					<div class="header">Entity</div>
					<div class="header">Action</div>

					<div>select.macs_mood</div>
					<div>macs.set_mood</div>

					<div>select.macs_weather</div>
					<div>macs.set_weather</div>

						<div>number.macs_brightness</div>
						<div>macs.set_brightness</div>

						<div>number.macs_temperature</div>
						<div>macs.set_temperature</div>

						<div>number.macs_windspeed</div>
						<div>macs.set_windspeed</div>

						<div>number.macs_rainfall</div>
						<div>macs.set_rainfall</div>
					</div>
				</div>
			</div>
		</div>
	`;

const about = `
	<!-- About -->
		<div class="group">
			<div class="row about">
				<div class="about-toggle" tabindex="0" role="button">
					About M.A.C.S. 
					<span class="about-arrow">&gt;</span>
				</div>
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

function createHtmlGroup({id, name, label, hint=null, placeholder, units=false, minMax=false}){
	let htmlString = `
		<!-- ${name} -->
			<div class="group" id="${id}">
				<div class="row">
					<ha-switch id="${id}_enabled" label="${label}"></ha-switch>
					${hint !== null ? `
						<div class="hint">${hint}</div>
					` : ""}
				</div>

				<div class="row">
					<ha-combo-box id="${id}_select" label="${name} entity"></ha-combo-box>
				</div>

				<div class="row">
					<ha-textfield id="${id}_entity" label="${name} ID" placeholder="${placeholder}"></ha-textfield>
				</div>

				${units ? `
					<div class="row">
						<ha-combo-box id="${id}_unit" label="${name} units"></ha-combo-box>
					</div>
				` : ""}

				${minMax ? `
					<div class="row double">
						<ha-textfield id="${id}_min" label="Min value" placeholder="Leave empty for defaults" type="number" inputmode="decimal"></ha-textfield>
						<ha-textfield id="${id}_max" label="Max value" placeholder="Leave empty for defaults" type="number" inputmode="decimal"></ha-textfield>
					</div>
				` : ""}
			</div>
		`;
	return htmlString;
}





export class MacsCardEditor extends HTMLElement {
	// get the defaults, and apply user's config
	setConfig(config) {
		this._config = { ...DEFAULTS, ...(config || {}) };
		debug("setConfig", {config:this._config});
		this._render();
	}

	set hass(hass) {
		this._hass = hass;
	}

	// render the card editor UI
	async _render() {
		if (!this.shadowRoot){
			this.attachShadow({ mode: "open" });
		}
		
		let htmlOutput;

		const { satItems, pipelineItems, preferred } = await loadAssistantOptions(this._hass);
		const weatherItems = await loadWeatherOptions(this._hass);

		// Build DOM...
		
		const htmlGroupAssistStates = createHtmlGroup({
			id: "assist_satellite",
			name: "Assist Satellite",
			label: "React to Wake-Words?",
			hint: "When enabled, Macs will mirror your selected Assist satellite.<br>(listening, processing, responding, idle, etc)",
			placeholder: "assist_satellite.my_device",
		});

		const htmlGroupShowDialogue = createHtmlGroup({
			id: "assist_pipeline",
			name: "Assistant Pipeline",
			label: "Display Dialogue?",
			hint: "When enabled, Macs will display conversations with your assistant.",
			placeholder: "01k..."
		});

		const htmlGroupTemperature = createHtmlGroup({
			id: "temperature_sensor",
			name: "Temperature",
			label: "Use Temperature Sensor?",
			hint: null,
			placeholder: "sensor.my_temperature",
			units: true,
			minMax: true
		});

		const htmlGroupWindspeed = createHtmlGroup({
			id: "wind_sensor",
			name: "Wind Sensor",
			label: "Use Wind Sensor?",
			hint: null,
			placeholder: "sensor.my_wind_speed",
			units: true,
			minMax: true
		});

		const htmlGroupRainfall = createHtmlGroup({
			id: "precipitation_sensor",
			name: "Rainfall Sensor",
			label: "Use Rainfall Sensor?",
			hint: null,
			placeholder: "sensor.my_rain",
			units: true,
			minMax: true
		});

		const htmlGroupSnow = createHtmlGroup({
			id: "weather_condition",
			name: "Weather Condition",
			label: "Auto-Detect Snowing?",
			hint: null,
			placeholder: "weather.forecast_home",
		});

		htmlOutput = styleSheet;
		htmlOutput += htmlGroupAssistStates;
		htmlOutput += htmlGroupShowDialogue;
		htmlOutput += htmlGroupTemperature;
		htmlOutput += htmlGroupWindspeed;
		htmlOutput += htmlGroupRainfall;
		htmlOutput += htmlGroupSnow;	
		htmlOutput += instructions;	
		htmlOutput += about;

		this.shadowRoot.innerHTML = htmlOutput;


		// Page has rendered
		this._rendered = true;

		// Add satellites to combobox
		const satSel = this.shadowRoot.getElementById("assist_satellite_select");
		// add selects to combobox
		if (satSel) {
			satSel.items = satItems;
			satSel.itemLabelPath = "name";
			satSel.itemValuePath = "id";
		}
		this._satelliteItems = satItems;
		// Preselect saved config before sync
		if (satSel) {
			const eid = (this._config.assist_satellite_entity ?? "").toString();
			const known = satItems.some(s => s.id === eid && s.id !== "custom");
			const isCustom = !!this._config.assist_satellite_custom || (!known && eid);
			satSel.value = isCustom ? "custom" : eid;
		}


		// Add pipelines to combobox
		const sel = this.shadowRoot.getElementById("assist_pipeline_select");
		if (sel) {
			sel.items = pipelineItems;
			sel.itemLabelPath = "name";
			sel.itemValuePath = "id";
		}
		this._pipelineItems = pipelineItems;

		// Preselect pipline based on saved config before sync runs
		if (sel) {
			const pid = (this._config.pipeline_id ?? "").toString();
			const known = pipelineItems.some(p => p.id === pid && p.id !== "custom");
			const isCustom = !!this._config.pipeline_custom || (!known && pid);
			sel.value = isCustom ? "custom" : pid;
		}

		// Weather sensors: temperature
		const tempSel = this.shadowRoot.getElementById("temperature_sensor_select");
		if (tempSel) {
			tempSel.items = weatherItems.temperatureItems;
			tempSel.itemLabelPath = "name";
			tempSel.itemValuePath = "id";
		}
		this._temperatureItems = weatherItems.temperatureItems;
		if (tempSel) {
			const tid = (this._config.temperature_sensor_entity ?? "").toString();
			const known = weatherItems.temperatureItems.some(s => s.id === tid && s.id !== "custom");
			const isCustom = !!this._config.temperature_sensor_custom || (!known && tid);
			tempSel.value = isCustom ? "custom" : tid;
		}

		// Weather sensors: wind
		const windSel = this.shadowRoot.getElementById("wind_sensor_select");
		if (windSel) {
			windSel.items = weatherItems.windItems;
			windSel.itemLabelPath = "name";
			windSel.itemValuePath = "id";
		}
		this._windItems = weatherItems.windItems;
		if (windSel) {
			const wid = (this._config.wind_sensor_entity ?? "").toString();
			const known = weatherItems.windItems.some(s => s.id === wid && s.id !== "custom");
			const isCustom = !!this._config.wind_sensor_custom || (!known && wid);
			windSel.value = isCustom ? "custom" : wid;
		}

		// Weather sensors: precipitation
		const rainSel = this.shadowRoot.getElementById("precipitation_sensor_select");
		if (rainSel) {
			rainSel.items = weatherItems.precipitationItems;
			rainSel.itemLabelPath = "name";
			rainSel.itemValuePath = "id";
		}
		this._precipitationItems = weatherItems.precipitationItems;
		if (rainSel) {
			const rid = (this._config.precipitation_sensor_entity ?? "").toString();
			const known = weatherItems.precipitationItems.some(s => s.id === rid && s.id !== "custom");
			const isCustom = !!this._config.precipitation_sensor_custom || (!known && rid);
			rainSel.value = isCustom ? "custom" : rid;
		}

		// Weather: temperature sensor units
		const temperatureUnitSelect = this.shadowRoot.getElementById("temperature_sensor_unit");
		if (temperatureUnitSelect) {
			temperatureUnitSelect.items = [
				{ id: "", name: "Auto" },
				{ id: "c", name: "Celsius (°C)" },
				{ id: "f", name: "Fahrenheit (°F)" },
			];
			temperatureUnitSelect.itemLabelPath = "name";
                temperatureUnitSelect.itemValuePath = "id";
                temperatureUnitSelect.value = (this._config.temperature_unit ?? "").toString();
            }

            // Weather: wind units
            const windUnitSelect = this.shadowRoot.getElementById("wind_sensor_unit");
            if (windUnitSelect) {
                windUnitSelect.items = [
                    { id: "", name: "Auto" },
                    { id: "mph", name: "Miles per hour (mph)" },
                    { id: "kph", name: "Kilometres per hour (kph)" },
                    { id: "mps", name: "Metres per second (m/s)" },
                    { id: "knots", name: "Knots" },
                ];
                windUnitSelect.itemLabelPath = "name";
                windUnitSelect.itemValuePath = "id";
                windUnitSelect.value = (this._config.wind_unit ?? "").toString();
            }

			// Weather: precipitation units
            const precipitationUnitSelect = this.shadowRoot.getElementById("precipitation_sensor_unit");
            if (precipitationUnitSelect) {
                precipitationUnitSelect.items = [
                    { id: "", name: "Auto" },
                    { id: "%", name: "Chance of rain (%)" },
                    { id: "mm", name: "Millimetres (mm)" },
                    { id: "in", name: "Inches (in)" },
                ];
                precipitationUnitSelect.itemLabelPath = "name";
                precipitationUnitSelect.itemValuePath = "id";
                precipitationUnitSelect.value = (this._config.precipitation_unit ?? "").toString();
            }

		// Weather min/max fields from config
		const tempMin = this.shadowRoot.getElementById("temperature_sensor_min");
		const tempMax = this.shadowRoot.getElementById("temperature_sensor_max");
		if (tempMin) tempMin.value = (this._config.temperature_min ?? "").toString();
		if (tempMax) tempMax.value = (this._config.temperature_max ?? "").toString();

		const windMin = this.shadowRoot.getElementById("wind_sensor_min");
		const windMax = this.shadowRoot.getElementById("wind_sensor_max");
		if (windMin) windMin.value = (this._config.wind_min ?? "").toString();
		if (windMax) windMax.value = (this._config.wind_max ?? "").toString();

		const precipMin = this.shadowRoot.getElementById("precipitation_sensor_min");
		const precipMax = this.shadowRoot.getElementById("precipitation_sensor_max");
		if (precipMin) precipMin.value = (this._config.precipitation_min ?? "").toString();
		if (precipMax) precipMax.value = (this._config.precipitation_max ?? "").toString();

		// About/Support toggle
		const toggle = this.shadowRoot.querySelector(".about-toggle");
		const arrow = this.shadowRoot.querySelector(".about-arrow");
		const content = this.shadowRoot.querySelector(".about-content");

		if (toggle && arrow && content) {
			toggle.addEventListener("click", () => {
				const open = !content.hasAttribute("hidden");
				content.toggleAttribute("hidden", open);
				arrow.textContent = open ? ">" : "v";
			});
		}

		// Wire once per render (safe because render rebuilds DOM)
		this._wire();

		// Sync UI from config
		this._sync();
		//this._pipelinesLoaded = true;

		// If user hasn't set a pipeline yet, pick HA's preferred
		const currentPid = (this._config.pipeline_id ?? "").toString().trim();
		if (!currentPid && preferred && !this._config.pipeline_custom) {
			const next = { type: "custom:macs-card", ...this._config, pipeline_id: preferred, pipeline_custom: false };
			this._config = next;
			this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
		}
	}
	

	// sync UI state from this._config
	async _sync() {
		if (!this.shadowRoot) return;

		syncAssistStateControls(this.shadowRoot, this._config, this._satelliteItems);
		syncPipelineControls(this.shadowRoot, this._config, this._pipelineItems);
		syncWeatherControls(this.shadowRoot, this._config, {
			temperatureItems: this._temperatureItems || [],
			windItems: this._windItems || [],
			precipitationItems: this._precipitationItems || []
		});
	}

	// wire up event listeners for user config changes
	_wire() {
		const onChange = (e) => {
			const target = e?.currentTarget;
			if (target?.id && target.id.endsWith("_unit")) {
				debug("unit-change", {
					id: target.id,
					type: e?.type,
					detailValue: e?.detail?.value,
					value: target.value,
					selectedItemId: target.selectedItem?.id
				});
			}

			const assistConfig = readAssistStateInputs(this.shadowRoot, e, this._config);
			const pipelineConfig = readPipelineInputs(this.shadowRoot, e, this._config);
			const weatherConfig = readWeatherInputs(this.shadowRoot, e, this._config);
			debug("weather-config", weatherConfig);

			// Commit new config
			const next = {
				...this._config,
				type: "custom:macs-card",
				...assistConfig,
				...pipelineConfig,
				...weatherConfig
			};

			this._config = { ...DEFAULTS, ...next };

			// IMPORTANT: do NOT call this._sync() here (HA will call setConfig again)
			this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true }));
		};

		["assist_satellite_enabled","assist_satellite_select","assist_satellite_entity","assist_pipeline_enabled","assist_pipeline_select","assist_pipeline_entity"].forEach((id) => {
			const el = this.shadowRoot.getElementById(id);
			if (!el) return;
			el.addEventListener("change", onChange);
			if (id === "assist_satellite_select" || id === "assist_pipeline_select") el.addEventListener("value-changed", onChange);
		});

		[
			"temperature_sensor_enabled","temperature_sensor_select","temperature_sensor_entity","temperature_sensor_unit","temperature_sensor_min","temperature_sensor_max",
			"wind_sensor_enabled","wind_sensor_select","wind_sensor_entity","wind_sensor_unit","wind_sensor_min","wind_sensor_max",
			"precipitation_sensor_enabled","precipitation_sensor_select","precipitation_sensor_entity","precipitation_sensor_unit","precipitation_sensor_min","precipitation_sensor_max"
		].forEach((id) => {
			const el = this.shadowRoot.getElementById(id);
			if (!el) return;
			el.addEventListener("change", onChange);
			if (id.endsWith("_select") || id.endsWith("_unit")) {
				el.addEventListener("value-changed", onChange);
			}
		});

	}
}



