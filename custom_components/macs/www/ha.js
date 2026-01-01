/* ===========================
	MACS CARD — BRIDGE MODE
	- NO token handling in iframe
	- Card uses authenticated hass.callWS + hass event bus
	- Iframe is display-only

@todo test non admin user
=========================== */

import {MacsCard} from "./ha/MacsCard.js";
import {MacsCardEditor} from "./ha/MacsCardEditor.js";


if (!customElements.get("macs-card")) customElements.define("macs-card", MacsCard);
window.customCards = window.customCards || [];
window.customCards.push({
    type: "macs-card",
    name: "M.A.C.S.",
    description: "M.A.C.S. (Macs) - Mood-Aware Character SVG",
    preview: true
});

if (!customElements.get("macs-card-editor")) customElements.define("macs-card-editor", MacsCardEditor);