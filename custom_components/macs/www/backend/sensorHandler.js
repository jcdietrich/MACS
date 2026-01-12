/**
 * Sensor Handler
 * --------------
 * Normalizes HA sensor states and derives weather condition flags.
 */
import { TEMPERATURE_ENTITY_ID, WIND_ENTITY_ID, PRECIPITATION_ENTITY_ID, BATTERY_CHARGE_ENTITY_ID, BATTERY_STATE_ENTITY_ID } from "../shared/constants.js";
import { toNumber, normalizeTemperatureValue, normalizeWindValue, normalizeRainValue, normalizeBatteryValue, normalizeUnit, normalizeChargingState } from "./validators.js";
import { createDebugger } from "../shared/debugger.js";

const debug = createDebugger(import.meta.url);

const CONDITION_KEYS = [
    "snowy",
    "cloudy",
    "rainy",
    "windy",
    "sunny",
    "stormy",
    "foggy",
    "hail",
    "lightning",
    "partlycloudy",
    "pouring",
    "clear_night",
    "exceptional",
];

const CONDITION_ENTITY_IDS = {
    snowy: "switch.macs_weather_conditions_snowy",
    cloudy: "switch.macs_weather_conditions_cloudy",
    rainy: "switch.macs_weather_conditions_rainy",
    windy: "switch.macs_weather_conditions_windy",
    sunny: "switch.macs_weather_conditions_sunny",
    stormy: "switch.macs_weather_conditions_stormy",
    foggy: "switch.macs_weather_conditions_foggy",
    hail: "switch.macs_weather_conditions_hail",
    lightning: "switch.macs_weather_conditions_lightning",
    partlycloudy: "switch.macs_weather_conditions_partlycloudy",
    pouring: "switch.macs_weather_conditions_pouring",
    clear_night: "switch.macs_weather_conditions_clear_night",
    exceptional: "switch.macs_weather_conditions_exceptional",
};

const NUMERIC_SPECS = {
    temperature: {
        key: "temperature",
        enabledKey: "temperature_sensor_enabled",
        entityKey: "temperature_sensor_entity",
        unitKey: "temperature_sensor_unit",
        minKey: "temperature_sensor_min",
        maxKey: "temperature_sensor_max",
        manualEntityId: TEMPERATURE_ENTITY_ID,
        unitKind: "temp",
        normalize: normalizeTemperatureValue,
        debugLabel: "temperature",
    },
    windspeed: {
        key: "windspeed",
        enabledKey: "wind_sensor_enabled",
        entityKey: "wind_sensor_entity",
        unitKey: "wind_sensor_unit",
        minKey: "wind_sensor_min",
        maxKey: "wind_sensor_max",
        manualEntityId: WIND_ENTITY_ID,
        unitKind: "wind",
        normalize: normalizeWindValue,
        debugLabel: "windspeed",
    },
    precipitation: {
        key: "precipitation",
        enabledKey: "precipitation_sensor_enabled",
        entityKey: "precipitation_sensor_entity",
        unitKey: "precipitation_sensor_unit",
        minKey: "precipitation_sensor_min",
        maxKey: "precipitation_sensor_max",
        manualEntityId: PRECIPITATION_ENTITY_ID,
        unitKind: "rain",
        normalize: normalizeRainValue,
        debugLabel: "precipitation",
    },
    battery: {
        key: "battery",
        enabledKey: "battery_charge_sensor_enabled",
        entityKey: "battery_charge_sensor_entity",
        unitKey: "battery_charge_sensor_unit",
        minKey: "battery_charge_sensor_min",
        maxKey: "battery_charge_sensor_max",
        manualEntityId: BATTERY_CHARGE_ENTITY_ID,
        unitKind: "battery",
        normalize: normalizeBatteryValue,
        debugLabel: "battery",
    },
};

const PAYLOAD_KEYS = [
    "temperature",
    "windspeed",
    "precipitation",
    "battery",
    "battery_state",
    "weather_conditions",
];

function emptyConditions() {
    const out = {};
    for (let i = 0; i < CONDITION_KEYS.length; i++) {
        out[CONDITION_KEYS[i]] = false;
    }
    return out;
}

function isTruthyState(state) {
    const value = (state || "").toString().trim().toLowerCase();
    return value === "on" || value === "true" || value === "1" || value === "yes";
}

function applyDerivedConditions(flags) {
    if (flags.partlycloudy) {
        flags.cloudy = true;
    }
    if (flags.pouring) {
        flags.rainy = true;
    }
}

export class SensorHandler {
    constructor() {
        this._config = null;
        this._hass = null;
        this._values = {
            temperature: null,
            windspeed: null,
            precipitation: null,
            battery: null,
            battery_state: null,
            weather_conditions: emptyConditions(),
        };
        this._sensors = {
            temperature: null,
            windspeed: null,
            precipitation: null,
            battery: null,
            battery_state: null,
            weather_conditions: null,
        };
        this._lastValues = {};
    }

    setConfig(config) {
        this._config = config || null;
    }

    setHass(hass) {
        this._hass = hass || null;
    }

    update() {
        if (!this._hass) return null;

        const temperature = this._normalizeNumeric(NUMERIC_SPECS.temperature);
        const windspeed = this._normalizeNumeric(NUMERIC_SPECS.windspeed);
        const precipitation = this._normalizeNumeric(NUMERIC_SPECS.precipitation);
        const battery = this._normalizeNumeric(NUMERIC_SPECS.battery);
        const batteryState = this._normalizeBatteryState();
        const weatherConditions = this._normalizeWeatherConditions();

        this._sensors = {
            temperature,
            windspeed,
            precipitation,
            battery,
            battery_state: batteryState,
            weather_conditions: weatherConditions,
        };
        this._values.temperature = Number.isFinite(temperature?.normalized) ? temperature.normalized : null;
        this._values.windspeed = Number.isFinite(windspeed?.normalized) ? windspeed.normalized : null;
        this._values.precipitation = Number.isFinite(precipitation?.normalized) ? precipitation.normalized : null;
        this._values.battery = Number.isFinite(battery?.normalized) ? battery.normalized : null;
        this._values.battery_state = typeof batteryState?.normalized === "boolean" ? batteryState.normalized : null;
        this._values.weather_conditions = weatherConditions || emptyConditions();

        return this.getPayload();
    }

    _readSensor(entityId) {
        if (!this._hass || !entityId) return null;
        const st = this._hass.states?.[entityId];
        if (!st) return null;
        return {
            value: toNumber(st.state),
            unit: (st.attributes?.unit_of_measurement || "").toString(),
        };
    }

    _readManualValue(entityId) {
        if (!this._hass || !entityId) return null;
        const st = this._hass.states?.[entityId];
        if (!st) return null;
        const value = toNumber(st.state);
        if (value === null) return null;
        const clamped = Math.max(0, Math.min(100, value));
        return {
            value: clamped,
            unit: "normalized",
            min: 0,
            max: 100,
            normalized: clamped,
        };
    }

    _readConditionText(stateObj) {
        if (!stateObj) return "";
        const attrs = stateObj.attributes || {};
        const candidates = [attrs.weatherCondition, attrs.weatherConditions, attrs.weather, stateObj.state];
        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (Array.isArray(candidate) && candidate.length > 0) {
                return candidate.join(", ");
            }
            if (typeof candidate === "string") {
                const value = candidate.trim();
                if (value) return value;
            }
        }
        return "";
    }

    _resolveUnit(sensorUnit, configUnit, kind) {
        const cfg = normalizeUnit(kind, configUnit);
        if (cfg) return cfg;

        const su = normalizeUnit(kind, sensorUnit);
        if (su) return su;

        if (kind === "temp") {
            return "c";
        }
        if (kind === "wind") {
            return "mph";
        }
        if (kind === "rain") {
            return "mm";
        }
        return "";
    }

    _resolveBatteryUnit(sensorUnit, configUnit) {
        const cfg = normalizeUnit("battery", configUnit);
        if (cfg) return cfg;

        const su = normalizeUnit("battery", sensorUnit);
        if (su) return su;

        return "%";
    }

    _resolveUnitForSpec(spec, sensorUnit, configUnit) {
        if (spec.unitKind === "battery") {
            return this._resolveBatteryUnit(sensorUnit, configUnit);
        }
        return this._resolveUnit(sensorUnit, configUnit, spec.unitKind);
    }

    _normalizeNumeric(spec) {
        if (!spec) return null;
        if (!this._config?.[spec.enabledKey]) {
            return this._readManualValue(spec.manualEntityId);
        }
        const entityId = (this._config?.[spec.entityKey] || "").toString().trim();
        if (!entityId) {
            return null;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            return null;
        }
        debug(`${spec.debugLabel} sensor`, JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnitForSpec(spec, reading.unit, this._config?.[spec.unitKey]);
        const normalized = spec.normalize(
            reading.value,
            unit,
            this._config?.[spec.minKey],
            this._config?.[spec.maxKey]
        );
        debug(`${spec.debugLabel} normalized`, JSON.stringify({
            entityId,
            unit,
            min: this._config?.[spec.minKey],
            max: this._config?.[spec.maxKey],
            normalized,
        }));
        return {
            value: reading.value,
            unit,
            min: this._config?.[spec.minKey],
            max: this._config?.[spec.maxKey],
            normalized,
        };
    }

    _normalizeBatteryState() {
        const useSensor = !!this._config?.battery_state_sensor_enabled;
        const entityId = useSensor
            ? (this._config.battery_state_sensor_entity || "").toString().trim()
            : BATTERY_STATE_ENTITY_ID;
        if (!entityId) {
            return null;
        }
        if (!this._hass?.states) {
            return null;
        }
        const st = this._hass.states?.[entityId];
        if (!st) {
            return null;
        }

        const attrs = st.attributes || {};
        const candidates = [
            attrs.charging,
            attrs.is_charging,
            attrs.charge_state,
            attrs.battery_charging,
            attrs.plugged,
            attrs.on,
            attrs.powered,
            attrs.ac_power,
        ];

        let normalized = null;
        for (let i = 0; i < candidates.length; i++) {
            normalized = normalizeChargingState(candidates[i]);
            if (normalized !== null) break;
        }
        if (normalized === null) {
            normalized = normalizeChargingState(st.state);
        }

        debug("battery state sensor", JSON.stringify({
            entityId,
            value: st.state,
            normalized,
        }));

        if (normalized === null) {
            return null;
        }

        return {
            value: st.state,
            normalized,
        };
    }

    _normalizeWeatherConditions() {
        debug("Getting weather conditions...");

        if (this._config?.weather_conditions_enabled) {
            debug("Weather Conditions Enabled");
            
            const entityId = (this._config.weather_conditions_entity || "").toString().trim();
            debug("Trying to get results from " + entityId);

            if (!entityId) {
                debug("warn", "No Entity ID");
                return emptyConditions();
            }

            if (!this._hass?.states) {
                debug("warn", "Entity State not Available");
                return emptyConditions();
            }

            const st = this._hass.states?.[entityId];
            if (!st) {
                debug("warn", "Unable to get sensor state");
                return emptyConditions();
            }
            const raw = this._readConditionText(st);
            const text = (raw || "").toString().trim().toLowerCase();
            debug("Got text from sensor: " + text);
            if (!text || text === "unknown" || text === "unavailable") {
                return emptyConditions();
            }

            const normalized = text.replace(/\s+/g, " ").trim();
            const compact = normalized.replace(/[\s-]+/g, "_");
            const spaced = normalized.replace(/[_-]+/g, " ");

            const hasToken = (token) => {
                if (!token) return false;
                const t = token.toLowerCase();
                if (normalized.indexOf(t) !== -1) return true;
                if (compact.indexOf(t.replace(/[\s-]+/g, "_")) !== -1) return true;
                if (spaced.indexOf(t.replace(/[_-]+/g, " ")) !== -1) return true;
                return false;
            };

            const flags = emptyConditions();

            if (hasToken("partlycloudy") || hasToken("partly cloudy") || hasToken("partly-cloudy")) {
                flags.partlycloudy = true;
                flags.cloudy = true;
            }
            if (hasToken("clear_night") || hasToken("clear-night") || hasToken("clear night")) {
                flags.clear_night = true;
            }

            if (hasToken("snowy") || hasToken("snowing") || hasToken("snow")) {
                flags.snowy = true;
            }
            if (hasToken("rainy") || hasToken("raining") || hasToken("rain")) {
                flags.rainy = true;
            }
            if (hasToken("pouring")) {
                flags.pouring = true;
                flags.rainy = true;
            }
            if (hasToken("windy") || hasToken("wind")) {
                flags.windy = true;
            }
            if (hasToken("cloudy") || hasToken("clouds") || hasToken("overcast")) {
                flags.cloudy = true;
            }
            if (hasToken("sunny") || hasToken("sun")) {
                flags.sunny = true;
            }
            if (hasToken("stormy") || hasToken("storm")) {
                flags.stormy = true;
            }
            if (hasToken("foggy") || hasToken("fog")) {
                flags.foggy = true;
            }
            if (hasToken("hail")) {
                flags.hail = true;
            }
            if (hasToken("lightning")) {
                flags.lightning = true;
            }
            if (hasToken("exceptional")) {
                flags.exceptional = true;
            }

            debug("condition sensors", JSON.stringify({
                entityId,
                raw,
                weatherConditions: flags,
            }));
            return flags;
        }
        else{
            debug("Weather Conditions Disabled");
        }

        if (!this._hass?.states) {
            debug("warn", "Hass not ready for weather conditions");
            return emptyConditions();
        }

        const flags = emptyConditions();
        for (let i = 0; i < CONDITION_KEYS.length; i++) {
            const key = CONDITION_KEYS[i];
            const id = CONDITION_ENTITY_IDS[key];
            if (!id) continue;
            const st = this._hass.states?.[id];
            if (!st) continue;
            flags[key] = isTruthyState(st.state);
        }
        applyDerivedConditions(flags);
        debug("weather condition toggles", JSON.stringify({
            weatherConditions: flags,
        }));
        return flags;
    }

    _getSignature(value) {
        if (value && typeof value === "object") {
            return JSON.stringify(value);
        }
        return value;
    }

    _hasChanged(key) {
        const signature = this._getSignature(this._values[key]);
        const changed = signature !== this._lastValues[key];
        if (changed) this._lastValues[key] = signature;
        return changed;
    }

    getSensors() {
        debug("getSensors");
        return this._sensors;
    }

    syncChangeTracking() {
        PAYLOAD_KEYS.forEach((key) => {
            this._lastValues[key] = this._getSignature(this._values[key]);
        });
    }

    getPayload() {
        return {
            temperature: this._values.temperature,
            windspeed: this._values.windspeed,
            precipitation: this._values.precipitation,
            battery: this._values.battery,
            battery_state: this._values.battery_state,
            weather_conditions: this._values.weather_conditions,
        };
    }

    getTemperature() {
        return this._values.temperature;
    }

    getTemperatureHasChanged() {
        return this._hasChanged("temperature");
    }

    getWindSpeed() {
        return this._values.windspeed;
    }

    getWindSpeedHasChanged() {
        return this._hasChanged("windspeed");
    }

    getPrecipitation() {
        return this._values.precipitation;
    }

    getPrecipitationHasChanged() {
        return this._hasChanged("precipitation");
    }

    getWeatherConditions() {
        return this._values.weather_conditions || emptyConditions();
    }

    getWeatherConditionsHasChanged() {
        return this._hasChanged("weather_conditions");
    }

    getBattery() {
        return this._values.battery;
    }

    getBatteryHasChanged() {
        return this._hasChanged("battery");
    }

    getBatteryState() {
        return this._values.battery_state;
    }

    getBatteryStateHasChanged() {
        return this._hasChanged("battery_state");
    }

    resetChangeTracking() {
        PAYLOAD_KEYS.forEach((key) => {
            this._lastValues[key] = undefined;
        });
    }

    dispose() {
        this._hass = null;
        this._config = null;
        this._values = {
            temperature: null,
            windspeed: null,
            precipitation: null,
            battery: null,
            battery_state: null,
            weather_conditions: emptyConditions(),
        };
        this._sensors = {
            temperature: null,
            windspeed: null,
            precipitation: null,
            battery: null,
            battery_state: null,
            weather_conditions: null,
        };
        this._lastValues = {};
    }


}
