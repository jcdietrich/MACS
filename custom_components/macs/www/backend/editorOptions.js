/**
 * Editor Options
 * --------------
 * Populates combo boxes for use by the card editor.
 * Obtains User Inputs with Fallbacks to Default Values
 */



//###############################################################################################
//                                                                                              #
//                         Get lists for Combo Boxes                                            #
//                                                                                              #
//###############################################################################################

// returns a list of all matching entities ready for inclusion in the combo boxes
export async function getComboboxItems(hass) {
	let comboxItems = {};

	// Gather likely assistant satellites
	comboxItems.satelliteItems = searchForEntities("assist_satellite", "keys", hass);

	// Gather assistant pipeline IDs and preferred Pipeline
	let pipelineItems = await searchForPipelines(hass);
	comboxItems.preferred = pipelineItems.preferred;
	comboxItems.pipelineItems = pipelineItems.pipelineItems;

	// Gather likely temperature sensors.
	comboxItems.temperatureItems = searchForEntities("sensor", "entries", hass, ["temperature"], ["temp", "temperature"]);

	// Gather likely wind speed sensors.
	comboxItems.windItems = searchForEntities("sensor", "entries", hass, ["wind_speed"], ["wind"]);
	
	// Gather likely precipitation sensors.
	comboxItems.precipitationItems = searchForEntities("sensor", "entries", hass, ["precipitation", "precipitation_intensity", "precipitation_probability"], ["rain", "precip", "precipitation"]);

	// Gather weather entities for weather_condition strings.
	comboxItems.conditionItems = searchForEntities("weather", "entries", hass);

	// Gather likely battery charge % sensors.
	comboxItems.batteryItems = searchForEntities("sensor", "entries", hass, ["battery"], ["battery", "charge", "batt"]);

	// Gather likely battery state/is_charging sensors.
	let batteryStateItems = searchForEntities("sensor", "entries", hass, ["battery", "battery_charging", "power", "plug"], ["battery_state","battery state","is_charging","charging","charge","charge_state","charger","plugged","ac power","power"]);
	comboxItems.batteryStateItems = batteryStateItems.concat(searchForEntities("sensor", "entries", hass, ["battery", "battery_charging", "power", "plug"], ["battery_state","battery state","is_charging","charging","charge","charge_state","charger","plugged","ac power","power"]));

	return comboxItems;
}

// Searches Home Assistant for Entity Ids and States
function searchForEntities(needle, haystack, hass, possibleDeviceClasses=null, possibleNames=null){
	// Make sure HA is available
	if (!hass || !hass.states) {
		return [];
	}

	// make sure each combobox has a custom option so user can specify entity not in the list
	let list = [{ id: "custom", name: "Custom" }];
	let entities = [];

	// get a list of entity keys/entries
	if(haystack === "keys"){
		entities = Object.keys(hass.states);
	}
	else if(haystack === "entries"){
		entities = Object.entries(hass.states);
	}
	
	// For each entity
	for (let i = 0; i<entities.length; i++) {
		let id;
		let state;

		// get the ID
		if(haystack === "keys"){
			id = entities[i];
		}
		else if(haystack === "entries"){
			id = entities[i][0];
		}

		// ignore if the ID doesn't match what we're looking for (i.e. "sensor.") - note we add "." here, so it doesn't match things like opts.my_sensor
		if (id.indexOf(needle + ".") !== 0) {
			continue;
		}

		// otherwise, get the entities
		if(haystack === "keys"){
			state = hass.states[id];
		}
		else if(haystack === "entries"){
			state = entities[i][1];
		}

		let include = false;

		// only include the entity in the list if it matches one of the device classes or possible names
		if(possibleDeviceClasses===null && possibleNames===null){
			include = true;
		}
		else{
			// if we have device classes to compare to
			if(possibleDeviceClasses!==null && possibleDeviceClasses.length>0){
				// get the entity's device class
				let deviceClass = String((state && state.attributes && state.attributes.device_class) || "").toLowerCase();
				// compare to the list of chosen classes
				for (let c = 0; c < possibleDeviceClasses.length; c++) {
					if(deviceClass == possibleDeviceClasses[c].toLowerCase()) {
						include = true;
						break;
					}
				}
			}
			// if we have possible names to compare to, and we haven't already matched by device class
			if(possibleNames!==null && possibleNames.length>0 && include===false){
				let name = (state && state.attributes && state.attributes.friendly_name) || "";
				let hay = (id + " " + name).toLowerCase();
				for (let c = 0; c < possibleNames.length; c++) {
					if (hay.indexOf(possibleNames[c].toLowerCase()) !== -1) {
						include = true;
						break;
					}
				}
			}
		}

		// include the entity in the list
		if (include) {
			// get the friendly name
			var name = (state && state.attributes && state.attributes.friendly_name) || id;
			// add the entity to the results
			list.push({ id: id, name: String(name) });
		}
	}

	// sort the results alphabetically
	list.sort(function (a, b) {
		return a.name.localeCompare(b.name);
	});

	// return the list of compatible entities
	return list;
}

// Gets the pipeline IDs for inclusion in the comboxboxes
async function searchForPipelines(hass) {
	// Default safe payload
	const result = {
		pipelineItems: [{ id: "custom", name: "Custom" }],
		preferred: ""
	};

	if (!hass) return result;

	try {
		const res = await hass.callWS({ type: "assist_pipeline/pipeline/list" });

		const pipelines = Array.isArray(res?.pipelines) ? res.pipelines : [];
		result.preferred = String(res?.preferred_pipeline || "");

		for (let i = 0; i < pipelines.length; i++) {
			const p = pipelines[i] || {};
			const id = String(p.id || "");
			if (!id) continue;

			const name = String(p.name || p.id || "Unnamed");
			result.pipelineItems.push({ id, name });
		}
	} catch (_) {
		// swallow errors
	}

	return result;
}





//###############################################################################################
//                                                                                              #
//                         			Read User Inputs                                            #
//                                                                                              #
//###############################################################################################

// get the selected value of a combo box
function getComboboxValue(el, e) {
	// Prefer the event detail value when this element triggered the event.
	if (e && e.currentTarget === el && e.detail && typeof e.detail.value !== "undefined") {
		return e.detail.value;
	}
	// Fallback to HA combo-box selection.
	if (el && el.selectedItem && typeof el.selectedItem.id !== "undefined") {
		return el.selectedItem.id;
	}
	// Last resort: raw element value.
	return el && typeof el.value !== "undefined" ? el.value : "";
}

// chick if a toggle switch is "checked" or not
function getToggleValue(el, e, fallback) {
	if (el) {
		if (e && e.currentTarget === el) {
			if (e.detail && typeof e.detail.value !== "undefined") {
				return !!e.detail.value;
			}
			if (e.detail && typeof e.detail.checked !== "undefined") {
				return !!e.detail.checked;
			}
		}
		if (typeof el.checked !== "undefined") {
			return !!el.checked;
		}
	}
	return !!fallback;
}

// return a number input or fallback to default value
function getNumberOrDefault(elem, defaultVal){
    let val = elem ? elem.value : undefined;
    if (val === "" || val === null || typeof val === "undefined") {
        return defaultVal;
    }
	return Number(val);
}


// Reads all inputs for a HTML group
function getUserInputs(root, e, config, ids) {
	// see why keys are available in the current group
	const enabledKey = ids.enabled ? ids.enabled : false;
	const selectKey = ids.select ? ids.select : false;
	const customKey = ids.custom ? ids.custom : false;
	const entityKey = ids.entity ? ids.entity : false;
	const unitKey = ids.unit ? ids.unit : false;
	const minKey = ids.min ? ids.min : false;
	const maxKey = ids.max ? ids.max : false;
	const kioskAnimKey = ids.kioskAnimations ? ids.kioskAnimations : false;
	const kioskTimeoutKey = ids.kioskTimeout ? ids.kioskTimeout : false;

	// get the corresponding html elements
	const elemEnabled      = enabledKey 	 ? root.getElementById(enabledKey) : null;
	const elemSelect       = selectKey 		 ? root.getElementById(selectKey) : null;
	//const elemCustom       = customKey 		 ? root.getElementById(customKey) : null;
	const elemEntityInput  = entityKey 		 ? root.getElementById(entityKey) : null;
	const elemUnit         = unitKey 		 ? root.getElementById(unitKey) : null;
	const elemMin          = minKey 		 ? root.getElementById(minKey) : null;
	const elemMax          = maxKey 		 ? root.getElementById(maxKey) : null;
	const elemKioskAnims   = kioskAnimKey 	 ? root.getElementById(kioskAnimKey) : null;
	const elemKioskTimeout = kioskTimeoutKey ? root.getElementById(kioskTimeoutKey) : null;

	// get the combo box selected val and chosen entity
	const enabled = getToggleValue(elemEnabled, e, config && config[enabledKey]);
	const selectValue = getComboboxValue(elemSelect, e);
	const isCustom = selectValue === "custom";
	const entityVal = isCustom ? ((elemEntityInput && elemEntityInput.value) || "") : selectValue;
		
	// enable/disable elems
	if (elemSelect)elemSelect.disabled = !enabled;
	if (elemEntityInput) elemEntityInput.disabled = !enabled || !isCustom;
	if (elemUnit) elemUnit.disabled = !enabled;
	if (elemMin) elemMin.disabled = !enabled;
	if (elemMax) elemMax.disabled = !enabled;
	if (elemKioskAnims) elemKioskAnims.disabled = !enabled;
	if (elemKioskTimeout) elemKioskTimeout.disabled = !enabled;
	
	// prepare payload
	let payload = {[enabledKey]: enabled};
	if (selectKey){ 	  payload[entityKey] 	    = entityVal;	payload[customKey] = isCustom; }
	if (unitKey) 		  payload[unitKey]			= String(elemUnit ? getComboboxValue(elemUnit, e) : ((config && config[unitKey]) || ""));
	if (minKey)  		  payload[minKey] 			= getNumberOrDefault(config[minKey]);
	if (maxKey)  	      payload[maxKey] 			= getNumberOrDefault(config[maxKey]);
	if (kioskAnimKey)  	  payload[kioskAnimKey] 	= getToggleValue(kioskAnimKey, e, config && config[kioskAnimKey]);
	if (kioskTimeoutKey)  payload[kioskTimeoutKey] 	= getNumberOrDefault(config[kioskTimeoutKey]);

	return payload;
}


export function readInputs(root, e, config) {
	// Read all inputs or fall back to config.
	if (!root) {
		return {
			// Assistant Satellite
			assist_satellite_enabled: !!(config && config.assist_satellite_enabled),
			assist_satellite_entity: String((config && config.assist_satellite_entity) || ""),
			assist_satellite_custom: !!(config && config.assist_satellite_custom),

			// Assistant pipeline
			assist_pipeline_enabled: !!(config && config.assist_pipeline_enabled),
			assist_pipeline_entity: String((config && config.assist_pipeline_entity) || ""),
			assist_pipeline_custom: !!(config && config.assist_pipeline_custom),

			// Temperature
			temperature_sensor_enabled: !!(config && config.temperature_sensor_enabled),
			temperature_sensor_entity: String((config && config.temperature_sensor_entity) || ""),
			temperature_sensor_custom: !!(config && config.temperature_sensor_custom),
			temperature_sensor_unit: String((config && config.temperature_sensor_unit) || ""),
			temperature_sensor_min: String((config && config.temperature_sensor_min) || ""),
			temperature_sensor_max: String((config && config.temperature_sensor_max) || ""),
			
			// Windspeed
			wind_sensor_enabled: !!(config && config.wind_sensor_enabled),
			wind_sensor_entity: String((config && config.wind_sensor_entity) || ""),
			wind_sensor_custom: !!(config && config.wind_sensor_custom),
			wind_sensor_unit: String((config && config.wind_sensor_unit) || ""),
			wind_sensor_min: String((config && config.wind_sensor_min) || ""),
			wind_sensor_max: String((config && config.wind_sensor_max) || ""),
			
			// Rainfall
			precipitation_sensor_enabled: !!(config && config.precipitation_sensor_enabled),
			precipitation_sensor_entity: String((config && config.precipitation_sensor_entity) || ""),
			precipitation_sensor_custom: !!(config && config.precipitation_sensor_custom),
			precipitation_sensor_unit: String((config && config.precipitation_sensor_unit) || ""),
			precipitation_sensor_min: String((config && config.precipitation_sensor_min) || ""),
			precipitation_sensor_max: String((config && config.precipitation_sensor_max) || ""),
			
			// Weather Condition
			weather_conditions_enabled: !!(config && config.weather_conditions_enabled),
			weather_conditions: String((config && config.weather_conditions) || ""),
			
			// Battery charge %
			battery_charge_sensor_enabled: !!(config && config.battery_charge_sensor_enabled),
			battery_charge_sensor_entity: String((config && config.battery_charge_sensor_entity) || ""),
			battery_charge_sensor_custom: !!(config && config.battery_charge_sensor_custom),
			battery_charge_sensor_unit: String((config && config.battery_charge_sensor_unit) || ""),
			battery_charge_sensor_min: String((config && config.battery_charge_sensor_min) || ""),
			battery_charge_sensor_max: String((config && config.battery_charge_sensor_max) || ""),
			
			// Battery is Plugged in
			battery_state_sensor_enabled: !!(config && config.battery_state_sensor_enabled),
			battery_state_sensor_entity: String((config && config.battery_state_sensor_entity) || ""),
			battery_state_sensor_custom: !!(config && config.battery_state_sensor_custom),

			// Kiosk Mode
			auto_brightness_enabled: !!(config && config.auto_brightness_enabled),
			auto_brightness_timeout_minutes: String((config && config.auto_brightness_timeout_minutes) || ""),
			auto_brightness_min: String((config && config.auto_brightness_min) || ""),
			auto_brightness_max: String((config && config.auto_brightness_max) || ""),
			auto_brightness_pause_animations: !!(config && config.auto_brightness_pause_animations),
		};
	}

	return {
		// Assistant Satellite
		...getUserInputs(root, e, config, {
				enabled: "assist_satellite_enabled",
				select:  "assist_satellite_select",
				entity:  "assist_satellite_entity",
				custom:  "assist_satellite_custom",
			}),

		// Assistant Pipeline
		...getUserInputs(root, e, config, {
				enabled: "assist_pipeline_enabled",
				select:  "assist_pipeline_select",
				entity:  "assist_pipeline_entity",
				custom:  "assist_pipeline_custom",
			}),

		// Temperature
		...getUserInputs(root, e, config, {
				enabled: "temperature_sensor_enabled",
				select:  "temperature_sensor_select",
				entity:  "temperature_sensor_entity",
				custom:  "temperature_sensor_custom",
				unit:    "temperature_sensor_unit",
				min:     "temperature_sensor_min",
				max:     "temperature_sensor_max",
			}),

		// Windspeed
		...getUserInputs(root, e, config, {
				enabled: "wind_sensor_enabled",
				select:  "wind_sensor_select",
				entity:  "wind_sensor_entity",
				custom:  "wind_sensor_custom",
				unit:    "wind_sensor_unit",
				min:     "wind_sensor_min",
				max:     "wind_sensor_max",
			}),

		// Rainfall
		...getUserInputs(root, e, config, {
				enabled: "precipitation_sensor_enabled",
				select:  "precipitation_sensor_select",
				entity:  "precipitation_sensor_entity",
				custom:  "precipitation_sensor_custom",
				unit:    "precipitation_sensor_unit",
				min:     "precipitation_sensor_min",
				max:     "precipitation_sensor_max",
			}),

		// Weather Condition
		...getUserInputs(root, e, config, {
				enabled: "weather_conditions_enabled",
				select:  "weather_conditions_sensor_select",
				entity:  "weather_conditions_sensor_entity",
				custom:  "weather_conditions_custom",
			}),

		// Battery charge %
		...getUserInputs(root, e, config, {
				enabled: "battery_charge_sensor_enabled",
				select:  "battery_charge_sensor_select",
				entity:  "battery_charge_sensor_entity",
				custom:  "battery_charge_sensor_custom",
				unit:    "battery_charge_sensor_unit",
				min:     "battery_charge_sensor_min",
				max:     "battery_charge_sensor_max",
			}),

		// Battery is Plugged in
		...getUserInputs(root, e, config, {
				enabled: "battery_state_sensor_enabled",
				select:  "battery_state_sensor_select",
				entity:  "battery_state_sensor_entity",
				custom:  "battery_state_sensor_custom",
			}),

		// Kiosk Mode
		...getUserInputs(root, e, config, {
				enabled: "auto_brightness_enabled",
				min:     "auto_brightness_min",
				max:     "auto_brightness_max",
				kioskAnimations: "auto_brightness_pause_animations",
				kioskTimeout:    "auto_brightness_timeout_minutes"
			}),
	};
}





//###############################################################################################
//                                                                                              #
//                         Sync...                                            #
//                                                                                              #
//###############################################################################################


export function syncAssistStateControls(root, config, satelliteItems) {
	// Sync assist state controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var assistStateAutoMood = !!(config && config.assist_satellite_enabled);
	var assistStateAutoMoodToggle = root.getElementById("assist_satellite_enabled");
	var satelliteSelect = root.getElementById("assist_satellite_select");
	var satelliteEntity = root.getElementById("assist_satellite_entity");

	if (assistStateAutoMoodToggle && assistStateAutoMoodToggle.checked !== assistStateAutoMood) {
		assistStateAutoMoodToggle.checked = assistStateAutoMood;
	}

	if (satelliteSelect) {
		satelliteSelect.disabled = !assistStateAutoMood;
	}
	if (satelliteEntity) {
		satelliteEntity.disabled = !assistStateAutoMood;
	}

	var eid = String((config && config.assist_satellite_entity) || "");
	var knownSatellite =
		Array.isArray(satelliteItems) &&
		satelliteItems.some(function (s) {
			return s.id === eid && s.id !== "custom";
		});
	var satIsCustom = !!(config && config.assist_satellite_custom) || !knownSatellite;
	var nextSatSelect = satIsCustom ? "custom" : eid;

	if (satelliteSelect && satelliteSelect.value !== nextSatSelect) {
		satelliteSelect.value = nextSatSelect;
	}
	if (
		satelliteEntity &&
		satelliteEntity.value !== eid &&
		(!satIsCustom || !satelliteEntity.matches(":focus-within"))
	) {
		satelliteEntity.value = eid;
	}
	if (satelliteEntity) {
		satelliteEntity.disabled = !assistStateAutoMood || !satIsCustom;
	}
}

export function syncPipelineControls(root, config, pipelineItems) {
	// Sync pipeline controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var dialogueEnabled = !!(config && config.assist_pipeline_enabled);
	var dialogueEnabledToggle = root.getElementById("assist_pipeline_enabled");
	var pipelineSelect = root.getElementById("assist_pipeline_select");
	var pipelineId = root.getElementById("assist_pipeline_entity");

	if (dialogueEnabledToggle && dialogueEnabledToggle.checked !== dialogueEnabled) {
		dialogueEnabledToggle.checked = dialogueEnabled;
	}

	if (pipelineSelect) {
		pipelineSelect.disabled = !dialogueEnabled;
	}
	if (pipelineId) {
		pipelineId.disabled = !dialogueEnabled;
	}

	var pid = String((config && config.assist_pipeline_entity) || "");
	var knownPipeline =
		Array.isArray(pipelineItems) &&
		pipelineItems.some(function (p) {
			return p.id === pid && p.id !== "custom";
		});
	var pipelineIsCustom = !!(config && config.assist_pipeline_custom) || !knownPipeline;
	var nextPipelineSelect = pipelineIsCustom ? "custom" : pid;

	if (pipelineSelect && pipelineSelect.value !== nextPipelineSelect) {
		pipelineSelect.value = nextPipelineSelect;
	}
	if (pipelineId && pipelineId.value !== pid && !pipelineId.matches(":focus-within")) {
		pipelineId.value = pid;
	}
	if (pipelineId) {
		pipelineId.disabled = !dialogueEnabled || !pipelineIsCustom;
	}
}

export function syncConditionControls(root, config, conditionItems) {
	// Sync weather condition controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var conditionsEnabled = !!(config && config.weather_conditions_enabled);
	var conditionsToggle = root.getElementById("weather_conditions_enabled");
	var conditionsSelect = root.getElementById("weather_conditions_select");
	var conditionsEntity = root.getElementById("weather_conditions_entity");

	if (conditionsToggle && conditionsToggle.checked !== conditionsEnabled) {
		conditionsToggle.checked = conditionsEnabled;
	}

	if (conditionsSelect) {
		conditionsSelect.disabled = !conditionsEnabled;
	}
	if (conditionsEntity) {
		conditionsEntity.disabled = !conditionsEnabled;
	}

	var value = String((config && config.weather_conditions) || "");
	var knownCondition =
		Array.isArray(conditionItems) &&
		conditionItems.some(function (c) {
			return c.id === value && c.id !== "custom";
		});
	var isCustom = value.length > 0 && !knownCondition;
	var nextSelect = isCustom ? "custom" : value;

	if (conditionsSelect && conditionsSelect.value !== nextSelect) {
		conditionsSelect.value = nextSelect;
	}
	if (
		conditionsEntity &&
		conditionsEntity.value !== value &&
		(!isCustom || !conditionsEntity.matches(":focus-within"))
	) {
		conditionsEntity.value = value;
	}
	if (conditionsEntity) {
		conditionsEntity.disabled = !conditionsEnabled || !isCustom;
	}
}

export function syncAutoBrightnessControls(root, config) {
	// Sync auto-brightness controls from the saved config into the DOM.
	if (!root) {
		return;
	}

	var enabled = !!(config && config.auto_brightness_enabled);
	var toggle = root.getElementById("auto_brightness_enabled");
	var timeout = root.getElementById("auto_brightness_timeout_minutes");
	var minBrightness = root.getElementById("auto_brightness_min");
	var maxBrightness = root.getElementById("auto_brightness_max");
	var pauseToggle = root.getElementById("auto_brightness_pause_animations_enabled");

	if (toggle && toggle.checked !== enabled) {
		toggle.checked = enabled;
	}

	if (timeout) timeout.disabled = !enabled;
	if (minBrightness) minBrightness.disabled = !enabled;
	if (maxBrightness) maxBrightness.disabled = !enabled;
	if (pauseToggle) pauseToggle.disabled = !enabled;

	var timeoutVal = config && config.auto_brightness_timeout_minutes;
	if (timeout && timeout.value !== timeoutVal) {
		timeout.value = timeoutVal === null || typeof timeoutVal === "undefined" ? "" : String(timeoutVal);
	}

	var minVal = config && config.auto_brightness_min;
	if (minBrightness && minBrightness.value !== minVal) {
		minBrightness.value = minVal === null || typeof minVal === "undefined" ? "" : String(minVal);
	}

	var maxVal = config && config.auto_brightness_max;
	if (maxBrightness && maxBrightness.value !== maxVal) {
		maxBrightness.value = maxVal === null || typeof maxVal === "undefined" ? "" : String(maxVal);
	}

	var pauseVal = !!(config && config.auto_brightness_pause_animations);
	if (pauseToggle && pauseToggle.checked !== pauseVal) {
		pauseToggle.checked = pauseVal;
	}
}

export function syncWeatherControls(root, config, temperatureItems, windItems, precipitationItems, batteryItems, batteryStateItems) {
	// Sync all sensor sections.
	syncSingleWeather(
		root,
		config,
		temperatureItems,
		{
			enabled: "temperature_sensor_enabled",
			select: "temperature_sensor_select",
			entity: "temperature_sensor_entity",
			unit: "temperature_sensor_unit",
			min: "temperature_sensor_min",
			max: "temperature_sensor_max",
		},
		"temperature_sensor_custom",
		"temperature_sensor_entity",
		"temperature_sensor_enabled",
		"temperature_sensor_unit",
		"temperature_sensor_min",
		"temperature_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		windItems,
		{
			enabled: "wind_sensor_enabled",
			select: "wind_sensor_select",
			entity: "wind_sensor_entity",
			unit: "wind_sensor_unit",
			min: "wind_sensor_min",
			max: "wind_sensor_max",
		},
		"wind_sensor_custom",
		"wind_sensor_entity",
		"wind_sensor_enabled",
		"wind_sensor_unit",
		"wind_sensor_min",
		"wind_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		precipitationItems,
		{
			enabled: "precipitation_sensor_enabled",
			select: "precipitation_sensor_select",
			entity: "precipitation_sensor_entity",
			unit: "precipitation_sensor_unit",
			min: "precipitation_sensor_min",
			max: "precipitation_sensor_max",
		},
		"precipitation_sensor_custom",
		"precipitation_sensor_entity",
		"precipitation_sensor_enabled",
		"precipitation_sensor_unit",
		"precipitation_sensor_min",
		"precipitation_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		batteryItems,
		{
			enabled: "battery_charge_sensor_enabled",
			select: "battery_charge_sensor_select",
			entity: "battery_charge_sensor_entity",
			unit: "battery_charge_sensor_unit",
			min: "battery_charge_sensor_min",
			max: "battery_charge_sensor_max",
		},
		"battery_charge_sensor_custom",
		"battery_charge_sensor_entity",
		"battery_charge_sensor_enabled",
		"battery_charge_sensor_unit",
		"battery_charge_sensor_min",
		"battery_charge_sensor_max"
	);

	syncSingleWeather(
		root,
		config,
		batteryStateItems,
		{
			enabled: "battery_state_sensor_enabled",
			select: "battery_state_sensor_select",
			entity: "battery_state_sensor_entity",
		},
		"battery_state_sensor_custom",
		"battery_state_sensor_entity",
		"battery_state_sensor_enabled"
	);
}

function syncSingleWeather(
	root,
	config,
	items,
	ids,
	customFlagKey,
	entityKey,
	enabledKey,
	unitKey,
	minKey,
	maxKey
) {
	// Push config into a single weather section.
	if (!root) {
		return;
	}

	var enabled = !!(config && config[enabledKey]);
	var enabledToggle = root.getElementById(ids.enabled);
	var select = root.getElementById(ids.select);
	var entity = root.getElementById(ids.entity);
	var unit = unitKey ? root.getElementById(ids.unit) : null;
	var min = minKey ? root.getElementById(ids.min) : null;
	var max = maxKey ? root.getElementById(ids.max) : null;

	if (enabledToggle && enabledToggle.checked !== enabled) {
		enabledToggle.checked = enabled;
	}

	if (select) select.disabled = !enabled;
	if (entity) entity.disabled = !enabled;
	if (unit) unit.disabled = !enabled;
	if (min) min.disabled = !enabled;
	if (max) max.disabled = !enabled;

	var eid = String((config && config[entityKey]) || "");
	var known =
		Array.isArray(items) &&
		items.some(function (s) {
			return s.id === eid && s.id !== "custom";
		});
	var isCustom = !!(config && config[customFlagKey]) || !known;
	var nextSelect = isCustom ? "custom" : eid;

	if (select && select.value !== nextSelect) {
		select.value = nextSelect;
	}
	if (entity && entity.value !== eid && (!isCustom || !entity.matches(":focus-within"))) {
		entity.value = eid;
	}
	if (entity) {
		entity.disabled = !enabled || !isCustom;
	}

	if (unitKey) {
		var unitVal = String((config && config[unitKey]) || "");
		if (unit && unit.value !== unitVal) {
			unit.value = unitVal;
		}
	}

	if (minKey) {
		var cfgMin = config && config[minKey];
		if (min && min.value !== cfgMin) {
			min.value = cfgMin === null || typeof cfgMin === "undefined" ? "" : String(cfgMin);
		}
	}
	if (maxKey) {
		var cfgMax = config && config[maxKey];
		if (max && max.value !== cfgMax) {
			max.value = cfgMax === null || typeof cfgMax === "undefined" ? "" : String(cfgMax);
		}
	}
}
