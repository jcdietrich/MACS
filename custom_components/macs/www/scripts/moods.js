import { createDebugger } from "../ha/debugger.js";

const DEBUG_ENABLED = true;
const debug = createDebugger("Moods", DEBUG_ENABLED);

const moods = ['idle','bored','listening','thinking','surprised','confused','sleeping','happy'];

const SVG_NS = "http://www.w3.org/2000/svg";
const RAIN_MAX_DROPS = 50;

const RAIN_MIN_SPEED = 0.8;
const RAIN_MAX_SPEED = 4;

const RAIN_DROP_SIZE_MIN = 0.6;
const RAIN_DROP_SIZE_MAX = 1.3;
const RAIN_SIZE_VARIATION = 10;

const RAIN_OPACITY_MIN = 0.15;
const RAIN_OPACITY_MAX = 0.8;
const RAIN_OPACITY_VARIATION = 10;

const RAIN_SPEED_JITTER_MIN = -0.2;
const RAIN_SPEED_JITTER_MAX = 0.2;

const RAIN_WIND_TILT_MAX = 89;
const RAIN_TILT_VARIATION = 1;
const RAIN_PATH_PADDING = 60;
const RAIN_WIND_SPEED_MULTIPLIER = 1.7;
const RAIN_SPAWN_OFFSET = 120;
const RAIN_SPAWN_VARIATION = 1;

const SNOW_MAX_FLAKES = 500;
const SNOW_MIN_SPEED = 0.1;
const SNOW_MAX_SPEED = 0.3;
const SNOW_SIZE_MIN = 1.4;
const SNOW_SIZE_MAX = 3.6;
const SNOW_SIZE_VARIATION = 0.6;
const SNOW_OPACITY_MIN = 0.3;
const SNOW_OPACITY_MAX = 0.9;
const SNOW_OPACITY_VARIATION = 0.5;
const SNOW_MIN_DURATION = 6;
const SNOW_SPEED_JITTER_MIN = -0.1;
const SNOW_SPEED_JITTER_MAX = 0.1;
const SNOW_WIND_TILT_MAX = 89;
const SNOW_TILT_VARIATION = 12;
const SNOW_PATH_PADDING = 80;
const SNOW_WIND_SPEED_MULTIPLIER = 0.4;
const SNOW_START_DELAY_RATIO = 1;

const WIND_TILT_MAX = 25;
const WIND_TILT_EXPONENT = 2.2;

const IDLE_FLOAT_BASE_VMIN = 1.2;
const IDLE_FLOAT_MAX_VMIN = 20;
const IDLE_FLOAT_EXPONENT = 2.2;
const IDLE_FLOAT_BASE_SECONDS = 9;
const IDLE_FLOAT_MIN_SECONDS = 1;
const IDLE_FLOAT_SPEED_EXPONENT = 1.5;
const IDLE_FLOAT_JITTER_RATIO = 0.25;



let rainDropCount = -1;
let rainIntensity = -1;
let rainViewWidth = 1000;
let rainViewHeight = 1000;
let windIntensity = 0;
let snowFlakeCount = -1;
let snowIntensity = -1;
let idleFloatBase = IDLE_FLOAT_BASE_VMIN;
let idleFloatDuration = IDLE_FLOAT_BASE_SECONDS;
let idleFloatJitterTimer = null;
const snowAnimations = new WeakMap();

const clampPercent = (value, fallback = 0) => {
	const num = Number(value);
	if (!Number.isFinite(num)) return fallback;
	if (num < 0) return 0;
	if (num > 100) return 100;
	return num;
};

const toIntensity = (value, fallback = 0) => clampPercent(value, fallback) / 100;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const shuffle = (items) => {
	for (let i = items.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[items[i], items[j]] = [items[j], items[i]];
	}
	return items;
};

const applyIdleFloatJitter = () => {
	const jitter = (Math.random() * 2) - 1;
	const amp = Math.max(0.1, idleFloatBase * (1 + (jitter * IDLE_FLOAT_JITTER_RATIO)));
	document.documentElement.style.setProperty('--idle-float-amp', `${amp.toFixed(2)}vmin`);
	if (idleFloatJitterTimer) {
		clearTimeout(idleFloatJitterTimer);
	}
	idleFloatJitterTimer = setTimeout(applyIdleFloatJitter, idleFloatDuration * 1000);
};

const getLineRectIntersections = (point, dir, rect) => {
	const hits = [];
	const { xMin, xMax, yMin, yMax } = rect;

	if (dir.x !== 0) {
		const tLeft = (xMin - point.x) / dir.x;
		const yLeft = point.y + tLeft * dir.y;
		if (yLeft >= yMin && yLeft <= yMax) hits.push({ x: xMin, y: yLeft, t: tLeft });

		const tRight = (xMax - point.x) / dir.x;
		const yRight = point.y + tRight * dir.y;
		if (yRight >= yMin && yRight <= yMax) hits.push({ x: xMax, y: yRight, t: tRight });
	}

	if (dir.y !== 0) {
		const tTop = (yMin - point.y) / dir.y;
		const xTop = point.x + tTop * dir.x;
		if (xTop >= xMin && xTop <= xMax) hits.push({ x: xTop, y: yMin, t: tTop });

		const tBottom = (yMax - point.y) / dir.y;
		const xBottom = point.x + tBottom * dir.x;
		if (xBottom >= xMin && xBottom <= xMax) hits.push({ x: xBottom, y: yMax, t: tBottom });
	}

	if (hits.length < 2) return null;
	hits.sort((a, b) => a.t - b.t);
	return { start: hits[0], end: hits[hits.length - 1] };
};

// applies a css class to the body so that we can style based on mood
function applyBodyClass(prefix, value, allowed, fallback){
    // remove existing prefixed classes
    [...document.body.classList].forEach(c => {
        if (c.startsWith(prefix + '-')) document.body.classList.remove(c);
    });

    // normalise the input value
    const v = (value ?? '').toString().trim().toLowerCase();

    // make sure it's an allowed value
    const isValid = typeof allowed === 'function' ? allowed(v) : allowed.includes(v);

    // apply the css style
    document.body.classList.add(prefix + '-' + (isValid ? v : fallback));
}

// set Macs mood. Must be one of const moods
function setMood(m){ 
    applyBodyClass('mood', m, moods, 'idle'); 
}

const setRainViewBoxFromSvg = () => {
	const svg = document.querySelector(".fx-rain");
	if (!svg) return;

	const rect = svg.getBoundingClientRect();
	const width = Math.max(1, Math.round(rect.width));
	const height = Math.max(1, Math.round(rect.height));

	if (width === rainViewWidth && height === rainViewHeight) return;
	rainViewWidth = width;
	rainViewHeight = height;
	svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	const snowSvg = document.querySelector(".fx-snow");
	if (snowSvg) {
		snowSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
	}
	rainDropCount = -1;
	snowFlakeCount = -1;
};

const updateRainDrops = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	const container = document.getElementById("rain-drops");
	if (!container) return;

	const normalized = clamp01(intensity);
	const targetCount = Math.ceil(normalized * RAIN_MAX_DROPS);
	const baseSpeed = (RAIN_MIN_SPEED + ((RAIN_MAX_SPEED - RAIN_MIN_SPEED) * normalized)) * (1 + (windIntensity * RAIN_WIND_SPEED_MULTIPLIER));
	const travelDistance = Math.max(1, rainViewHeight);
	const rect = {
		xMin: -RAIN_PATH_PADDING,
		xMax: rainViewWidth + RAIN_PATH_PADDING,
		yMin: -RAIN_PATH_PADDING,
		yMax: rainViewHeight + RAIN_PATH_PADDING
	};
	const refDistance = Math.max(1, rect.yMax - rect.yMin);

	const setDropSpeed = (drop, size) => {
		const jitter = RAIN_SPEED_JITTER_MIN + (Math.random() * (RAIN_SPEED_JITTER_MAX - RAIN_SPEED_JITTER_MIN));
		const speedFactor = 0.7 + size;
		const unclamped = (baseSpeed * speedFactor) * (1 + jitter);
		const speed = Math.min(RAIN_MAX_SPEED, Math.max(RAIN_MIN_SPEED, unclamped));
		const pathLength = Number(drop.dataset.pathLength);
		const distance = Number.isFinite(pathLength) ? pathLength : refDistance;
		const distanceRatio = distance / refDistance;
		const duration = distanceRatio / speed;
		drop.style.animationDuration = `${duration.toFixed(2)}s`;
	};

	if (targetCount === rainDropCount && normalized === rainIntensity) {
		if (forceUpdate) {
			[...container.children].forEach((drop) => {
				const size = Number(drop.dataset.size);
				setDropSpeed(drop, Number.isFinite(size) ? size : 0.7);
			});
		}
		return;
	}
	rainDropCount = targetCount;
	rainIntensity = normalized;

	const slots = shuffle([...Array(targetCount).keys()]);

	const configureDrop = (drop, slotIndex) => {
		const slot = Number.isFinite(slotIndex) ? slotIndex : Math.floor(Math.random() * Math.max(1, targetCount));
		const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * RAIN_SIZE_VARIATION);
		const size = RAIN_DROP_SIZE_MIN + (sizeBias * (RAIN_DROP_SIZE_MAX - RAIN_DROP_SIZE_MIN));
		const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * RAIN_OPACITY_VARIATION);
		const baseOpacity = RAIN_OPACITY_MIN + (opacityBias * (RAIN_OPACITY_MAX - RAIN_OPACITY_MIN));
		const rx = 1 + (size * 1.2);
		const ry = 12 + (size * 18);
		const divergence = (Math.random() * 2) - 1;
		const tiltDeg = (windIntensity * RAIN_WIND_TILT_MAX) + (divergence * RAIN_TILT_VARIATION);
		const tiltCss = -tiltDeg;
		const tiltRad = tiltDeg * (Math.PI / 180);
		const dir = { x: Math.sin(tiltRad), y: Math.cos(tiltRad) };
		const perp = { x: -dir.y, y: dir.x };
		const maxOffset = (Math.abs(perp.x) * rainViewWidth + Math.abs(perp.y) * rainViewHeight) / 2;
		const offset = (((slot + Math.random()) / Math.max(1, targetCount)) - 0.5) * 2 * maxOffset;
		const center = { x: rainViewWidth / 2, y: rainViewHeight / 2 };
		const point = { x: center.x + (perp.x * offset), y: center.y + (perp.y * offset) };
		const segment = getLineRectIntersections(point, dir, rect);
		const start = segment?.start ?? { x: center.x, y: rect.yMin };
		const end = segment?.end ?? { x: center.x, y: rect.yMax };
		const spawnOffset = RAIN_SPAWN_OFFSET * (0.5 + (Math.random() * RAIN_SPAWN_VARIATION));
		const startOut = { x: start.x - (dir.x * spawnOffset), y: start.y - (dir.y * spawnOffset) };
		const endOut = { x: end.x + (dir.x * spawnOffset), y: end.y + (dir.y * spawnOffset) };

		drop.setAttribute("rx", rx.toFixed(2));
		drop.setAttribute("ry", ry.toFixed(2));
		drop.setAttribute("cx", "0");
		drop.setAttribute("cy", "0");
		drop.style.setProperty("--rain-start-x", `${start.x.toFixed(1)}px`);
		drop.style.setProperty("--rain-start-y", `${start.y.toFixed(1)}px`);
		drop.style.setProperty("--rain-end-x", `${end.x.toFixed(1)}px`);
		drop.style.setProperty("--rain-end-y", `${end.y.toFixed(1)}px`);
		drop.style.setProperty("--rain-tilt", `${tiltCss.toFixed(2)}deg`);
		drop.style.transform = `translate(${start.x.toFixed(1)}px, ${start.y.toFixed(1)}px) rotate(${tiltCss.toFixed(2)}deg)`;
		drop.style.opacity = Math.min(RAIN_OPACITY_MAX, baseOpacity * (0.7 + (size * 0.3))).toFixed(2);
		drop.dataset.size = size.toFixed(3);
		drop.dataset.slot = slot.toString();
		drop.dataset.pathLength = Math.hypot(end.x - start.x, end.y - start.y).toFixed(1);
		setDropSpeed(drop, size);
	};

	container.replaceChildren();
	for (let i = 0; i < targetCount; i += 1) {
		const drop = document.createElementNS(SVG_NS, "ellipse");

		drop.setAttribute("class", "drop");
		drop.style.animationDelay = `${(Math.random() * 2).toFixed(2)}s`;
		configureDrop(drop, slots[i]);
		drop.addEventListener("animationiteration", () => {
			configureDrop(drop, Number(drop.dataset.slot));
		});
		container.appendChild(drop);
	}
};

const updateSnowFlakes = (intensity, forceUpdate = false) => {
	setRainViewBoxFromSvg();
	const container = document.getElementById("snow-flakes");
	if (!container) return;

	const normalized = clamp01(intensity);
	const targetCount = Math.ceil(normalized * SNOW_MAX_FLAKES);
	const windMultiplier = 1 + (windIntensity * SNOW_WIND_SPEED_MULTIPLIER);
	const rect = {
		xMin: -SNOW_PATH_PADDING,
		xMax: rainViewWidth + SNOW_PATH_PADDING,
		yMin: -SNOW_PATH_PADDING,
		yMax: rainViewHeight + SNOW_PATH_PADDING
	};
	const refDistance = Math.max(1, rect.yMax - rect.yMin);

	const getFlakeDuration = (size, pathLength) => {
		const jitter = SNOW_SPEED_JITTER_MIN + (Math.random() * (SNOW_SPEED_JITTER_MAX - SNOW_SPEED_JITTER_MIN));
		const sizeFactor = (size - SNOW_SIZE_MIN) / Math.max(1, (SNOW_SIZE_MAX - SNOW_SIZE_MIN));
		const speedBias = clamp01(sizeFactor + jitter);
		const baseSpeed = SNOW_MIN_SPEED + (speedBias * (SNOW_MAX_SPEED - SNOW_MIN_SPEED));
		const unclampedSpeed = baseSpeed * windMultiplier;
		const speed = Math.min(SNOW_MAX_SPEED, Math.max(SNOW_MIN_SPEED, unclampedSpeed));
		const distance = Number.isFinite(pathLength) ? pathLength : refDistance;
		const distanceRatio = distance / refDistance;
		const minDuration = SNOW_MIN_DURATION * distanceRatio;
		return Math.max(minDuration, distanceRatio / speed);
	};

	const buildFlakeConfig = (slotIndex) => {
		const slot = Number.isFinite(slotIndex) ? slotIndex : Math.floor(Math.random() * Math.max(1, targetCount));
		const sizeBias = clamp01(normalized + ((Math.random() * 2) - 1) * SNOW_SIZE_VARIATION);
		const size = SNOW_SIZE_MIN + (sizeBias * (SNOW_SIZE_MAX - SNOW_SIZE_MIN));
		const opacityBias = clamp01(normalized + ((Math.random() * 2) - 1) * SNOW_OPACITY_VARIATION);
		const baseOpacity = SNOW_OPACITY_MIN + (opacityBias * (SNOW_OPACITY_MAX - SNOW_OPACITY_MIN));
		const divergence = (Math.random() * 2) - 1;
		const tiltDeg = (windIntensity * SNOW_WIND_TILT_MAX) + (divergence * SNOW_TILT_VARIATION);
		const tiltCss = -tiltDeg;
		const tiltRad = tiltDeg * (Math.PI / 180);
		const dir = { x: Math.sin(tiltRad), y: Math.cos(tiltRad) };
		const perp = { x: -dir.y, y: dir.x };
		const maxOffset = (Math.abs(perp.x) * rainViewWidth + Math.abs(perp.y) * rainViewHeight) / 2;
		const offset = (((slot + Math.random()) / Math.max(1, targetCount)) - 0.5) * 2 * maxOffset;
		const center = { x: rainViewWidth / 2, y: rainViewHeight / 2 };
		const point = { x: center.x + (perp.x * offset), y: center.y + (perp.y * offset) };
		const segment = getLineRectIntersections(point, dir, rect);
		const start = segment?.start ?? { x: center.x, y: rect.yMin };
		const end = segment?.end ?? { x: center.x, y: rect.yMax };
		const startOut = { x: start.x, y: start.y };
		const endOut = { x: end.x, y: end.y };
		const pathLength = Math.hypot(endOut.x - startOut.x, endOut.y - startOut.y);
		const duration = getFlakeDuration(size, pathLength);

		return {
			slot,
			size,
			opacity: Math.min(SNOW_OPACITY_MAX, baseOpacity),
			tiltCss,
			startOut,
			endOut,
			pathLength,
			duration
		};
	};

	const stopSnowAnimation = (flake) => {
		const anim = snowAnimations.get(flake);
		if (anim) {
			anim.onfinish = null;
			anim.cancel();
			snowAnimations.delete(flake);
		}
	};

	const startSnowAnimation = (flake, slotIndex) => {
		stopSnowAnimation(flake);
		const config = buildFlakeConfig(slotIndex);
		flake.setAttribute("r", config.size.toFixed(2));
		flake.setAttribute("cx", "0");
		flake.setAttribute("cy", "0");
		flake.style.opacity = config.opacity.toFixed(2);
		flake.dataset.size = config.size.toFixed(3);
		flake.dataset.slot = config.slot.toString();
		flake.dataset.pathLength = config.pathLength.toFixed(1);

		const keyframes = [
			{ transform: `translate(${config.startOut.x.toFixed(1)}px, ${config.startOut.y.toFixed(1)}px) rotate(${config.tiltCss.toFixed(2)}deg)` },
			{ transform: `translate(${config.endOut.x.toFixed(1)}px, ${config.endOut.y.toFixed(1)}px) rotate(${config.tiltCss.toFixed(2)}deg)` }
		];
		const anim = flake.animate(keyframes, {
			duration: config.duration * 1000,
			delay: Math.random() * config.duration * SNOW_START_DELAY_RATIO * 1000,
			easing: "linear",
			fill: "backwards",
			iterations: 1
		});
		snowAnimations.set(flake, anim);
		anim.onfinish = () => startSnowAnimation(flake, config.slot);
	};

	if (targetCount === snowFlakeCount && normalized === snowIntensity) {
		if (forceUpdate) {
			[...container.children].forEach((flake) => {
				const slot = Number(flake.dataset.slot);
				startSnowAnimation(flake, Number.isFinite(slot) ? slot : undefined);
			});
		}
		return;
	}
	snowFlakeCount = targetCount;
	snowIntensity = normalized;

	const slots = shuffle([...Array(targetCount).keys()]);
	[...container.children].forEach(stopSnowAnimation);
	container.replaceChildren();
	for (let i = 0; i < targetCount; i += 1) {
		const flake = document.createElementNS(SVG_NS, "circle");
		flake.setAttribute("class", "flake");
		container.appendChild(flake);
		startSnowAnimation(flake, slots[i]);
	}
};

function setTemperature(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--temperature-intensity', intensity.toString());
}

function setWindSpeed(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--windspeed-intensity', intensity.toString());
	windIntensity = intensity;
	const tilt = Math.pow(intensity, WIND_TILT_EXPONENT) * -WIND_TILT_MAX;
	document.documentElement.style.setProperty('--wind-tilt', `${tilt.toFixed(1)}deg`);
	idleFloatBase = IDLE_FLOAT_BASE_VMIN + ((IDLE_FLOAT_MAX_VMIN - IDLE_FLOAT_BASE_VMIN) * Math.pow(intensity, IDLE_FLOAT_EXPONENT));
	idleFloatDuration = IDLE_FLOAT_BASE_SECONDS - ((IDLE_FLOAT_BASE_SECONDS - IDLE_FLOAT_MIN_SECONDS) * Math.pow(intensity, IDLE_FLOAT_SPEED_EXPONENT));
	document.documentElement.style.setProperty('--idle-float-duration', `${idleFloatDuration.toFixed(2)}s`);
	applyIdleFloatJitter();
	updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity, true);
	updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity, true);
}

function setRainfall(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--rainfall-intensity', intensity.toString());
	updateRainDrops(intensity);
}

function setSnowfall(value){
	const intensity = toIntensity(value);
	document.documentElement.style.setProperty('--snowfall-intensity', intensity.toString());
	updateSnowFlakes(intensity);
}

// set brightness level (0-100)
function setBrightness(userBrightness){
	const brightness = Number(userBrightness);

	if (!Number.isFinite(brightness)) return;

    if (brightness < 0 || brightness > 100) return;

	// convert to 0–1 for opacity
    let opacity = 100;
    if (brightness === 0){
        opacity = 0;
    }
    else if (brightness < 100){
	    opacity = brightness / 100;
    }

	document.documentElement.style.setProperty(
		'--brightness-level',
		opacity.toString()
	);
}


const qs = new URLSearchParams(location.search);
setMood(qs.get('mood') || 'idle');
setRainViewBoxFromSvg();
setTemperature(qs.get('temperature') ?? '0');
setWindSpeed(qs.get('windspeed') ?? '0');
setRainfall(qs.get('rainfall') ?? '0');
setSnowfall(qs.get('snowfall') ?? '0');
setBrightness(qs.get('brightness') ?? '100');

window.addEventListener('resize', () => {
	setRainViewBoxFromSvg();
	updateRainDrops(rainIntensity < 0 ? 0 : rainIntensity);
	updateSnowFlakes(snowIntensity < 0 ? 0 : snowIntensity);
});

window.addEventListener('message', (e) => {
    if (e.source !== window.parent) return;
    if (e.origin !== window.location.origin) return;
    if (!e.data || typeof e.data !== 'object') return;

    if (e.data.type === 'macs:mood') {
        setMood(e.data.mood || 'idle');
        return;
    }
    if (e.data.type === 'macs:temperature') {
        setTemperature(e.data.temperature ?? '0');
        debug("Setting temperature to: " + (e.data.temperature ?? '0'));
        return;
    }
    if (e.data.type === 'macs:windspeed') {
        setWindSpeed(e.data.windspeed ?? '0');
        debug("Setting windspeed to: " + (e.data.windspeed ?? '0'));
        return;
    }
    if (e.data.type === 'macs:rainfall') {
        setRainfall(e.data.rainfall ?? '0');
        debug("Setting rainfall to: " + (e.data.rainfall ?? '0'));
        return;
    }
    if (e.data.type === 'macs:snowfall') {
        setSnowfall(e.data.snowfall ?? '0');
        debug("Setting snowfall to: " + (e.data.snowfall ?? '0'));
        return;
    }
    if (e.data.type === 'macs:brightness') {
        setBrightness(e.data.brightness ?? '100');
        return;
    }
});


debug("Macs Moods Loaded");
