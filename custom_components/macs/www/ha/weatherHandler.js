import { normalizeTemperature, normalizeWind, normalizeRain } from "./validators.js";
import {
    DEFAULT_WEATHER_POLL_MINUTES,
    TEMPERATURE_ENTITY_ID,
    WIND_ENTITY_ID,
    RAINFALL_ENTITY_ID,
} from "./constants.js";
import { createDebugger } from "./debugger.js";

const DEBUG_ENABLED = false;
const debug = createDebugger("weatherHandler", DEBUG_ENABLED);

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function normalizeTempUnitValue(value) {
    const u = (value || "").toString().trim().toLowerCase();
    if (!u) return "";
    if (u.indexOf("f") !== -1) return "f";
    if (u.indexOf("c") !== -1) return "c";
    return "";
}

function normalizeWindUnitValue(value) {
    const u = (value || "").toString().trim().toLowerCase();
    if (!u) return "";
    if (u === "kph" || u === "km/h") return "kph";
    if (u === "mps" || u === "m/s") return "mps";
    if (u === "knots" || u === "kn" || u === "kt" || u === "kt/h") return "knots";
    if (u === "mph") return "mph";
    return "";
}

function normalizeRainUnitValue(value) {
    const u = (value || "").toString().trim().toLowerCase();
    if (!u) return "";
    if (u === "%" || u.indexOf("percent") !== -1) return "%";
    if (u === "in" || u === "inch" || u === "inches") return "in";
    if (u === "mm") return "mm";
    return "";
}

function normalizeUnit(kind, value) {
    if (kind === "temp") return normalizeTempUnitValue(value);
    if (kind === "wind") return normalizeWindUnitValue(value);
    if (kind === "rain") return normalizeRainUnitValue(value);
    return "";
}

export class WeatherHandler {
    constructor() {
        this._config = null;
        this._hass = null;
        this._cache = {
            temperature: null,
            wind: null,
            precipitation: null,
        };
        this._lastUpdate = {
            temperature: 0,
            wind: 0,
            precipitation: 0,
        };
    }

    setConfig(config) {
        this._config = config || null;
    }

    setHass(hass) {
        this._hass = hass || null;
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

    _getUpdateMode(kind) {
        const intervalMs = this._getUpdateIntervalMs(kind);
        return intervalMs <= 0 ? "instant" : "polling";
    }

    _getUpdateIntervalMs(kind) {
        const key = `${kind}_update_interval`;
        const minutes = toNumber(this._config?.[key]);
        if (Number.isFinite(minutes) && minutes <= 0) return 0;
        const effective = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_WEATHER_POLL_MINUTES;
        return effective * 60 * 1000;
    }

    _shouldUpdate(kind, source, now) {
        if (!this._cache[kind]) return true;
        if (source === "config") return true;

        const mode = this._getUpdateMode(kind);
        if (mode === "instant") {
            return source === "hass";
        }

        const intervalMs = this._getUpdateIntervalMs(kind);
        const last = this._lastUpdate[kind] || 0;
        if (source === "poll" || source === "hass") {
            return now - last >= intervalMs;
        }
        return false;
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

    _normalizeTemperature(source, now) {
        if (!this._config?.temperature_sensor_enabled) {
            const manual = this._readManualValue(TEMPERATURE_ENTITY_ID);
            this._cache.temperature = manual;
            this._lastUpdate.temperature = now;
            return manual;
        }
        const entityId = (this._config.temperature_sensor_entity || "").toString().trim();
        if (!entityId) {
            this._cache.temperature = null;
            return null;
        }
        if (!this._shouldUpdate("temperature", source, now)) {
            return this._cache.temperature;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            this._cache.temperature = null;
            this._lastUpdate.temperature = now;
            return null;
        }
        debug("temperature sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.temperature_unit, "temp");
        const normalized = normalizeTemperature(
            reading.value,
            unit,
            this._config.temperature_min,
            this._config.temperature_max
        );
        debug("temperature normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.temperature_min,
            max: this._config.temperature_max,
            normalized,
        }));
        const next = {
            value: reading.value,
            unit,
            min: this._config.temperature_min,
            max: this._config.temperature_max,
            normalized,
        };
        this._cache.temperature = next;
        this._lastUpdate.temperature = now;
        return next;
    }

    _normalizeWind(source, now) {
        if (!this._config?.wind_sensor_enabled) {
            const manual = this._readManualValue(WIND_ENTITY_ID);
            this._cache.wind = manual;
            this._lastUpdate.wind = now;
            return manual;
        }
        const entityId = (this._config.wind_sensor_entity || "").toString().trim();
        if (!entityId) {
            this._cache.wind = null;
            return null;
        }
        if (!this._shouldUpdate("wind", source, now)) {
            return this._cache.wind;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            this._cache.wind = null;
            this._lastUpdate.wind = now;
            return null;
        }
        debug("wind sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.wind_unit, "wind");
        const normalized = normalizeWind(
            reading.value,
            unit,
            this._config.wind_min,
            this._config.wind_max
        );
        debug("wind normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.wind_min,
            max: this._config.wind_max,
            normalized,
        }));
        const next = {
            value: reading.value,
            unit,
            min: this._config.wind_min,
            max: this._config.wind_max,
            normalized,
        };
        this._cache.wind = next;
        this._lastUpdate.wind = now;
        return next;
    }

    _normalizeRain(source, now) {
        if (!this._config?.precipitation_sensor_enabled) {
            const manual = this._readManualValue(RAINFALL_ENTITY_ID);
            this._cache.precipitation = manual;
            this._lastUpdate.precipitation = now;
            return manual;
        }
        const entityId = (this._config.precipitation_sensor_entity || "").toString().trim();
        if (!entityId) {
            this._cache.precipitation = null;
            return null;
        }
        if (!this._shouldUpdate("precipitation", source, now)) {
            return this._cache.precipitation;
        }
        const reading = this._readSensor(entityId);
        if (!reading || reading.value === null) {
            this._cache.precipitation = null;
            this._lastUpdate.precipitation = now;
            return null;
        }
        debug("precipitation sensor", JSON.stringify({
            entityId,
            value: reading.value,
            unit: reading.unit,
        }));

        const unit = this._resolveUnit(reading.unit, this._config.precipitation_unit, "rain");
        const normalized = normalizeRain(
            reading.value,
            unit,
            this._config.precipitation_min,
            this._config.precipitation_max
        );
        debug("precipitation normalized", JSON.stringify({
            entityId,
            unit,
            min: this._config.precipitation_min,
            max: this._config.precipitation_max,
            normalized,
        }));
        const next = {
            value: reading.value,
            unit,
            min: this._config.precipitation_min,
            max: this._config.precipitation_max,
            normalized,
        };
        this._cache.precipitation = next;
        this._lastUpdate.precipitation = now;
        return next;
    }

    getWeather(options) {
        const source = options && options.source ? options.source : "hass";
        const now = options && Number.isFinite(options.now) ? options.now : Date.now();
        debug("getWeather", source);
        return {
            temperature: this._normalizeTemperature(source, now),
            wind: this._normalizeWind(source, now),
            precipitation: this._normalizeRain(source, now),
        };
    }

    dispose() {
        this._hass = null;
        this._config = null;
        this._cache.temperature = null;
        this._cache.wind = null;
        this._cache.precipitation = null;
        this._lastUpdate.temperature = 0;
        this._lastUpdate.wind = 0;
        this._lastUpdate.precipitation = 0;
    }
}
