export class MessagePoster {
	constructor({ getRecipientWindow, getTargetOrigin, allowNullOrigin = false } = {}) {
		this._getRecipientWindow = typeof getRecipientWindow === "function" ? getRecipientWindow : () => null;
		this._getTargetOrigin = typeof getTargetOrigin === "function" ? getTargetOrigin : () => "";
		this._allowNullOrigin = !!allowNullOrigin;
	}

	post(payload) {
		const recipient = this._getRecipientWindow();
		const origin = this._getTargetOrigin();
		if (!recipient || !origin) return false;
		try {
			recipient.postMessage(payload, origin);
			return true;
		} catch (_) {
			return false;
		}
	}

	isValidEvent(event) {
		if (!event || typeof event !== "object") return false;
		const recipient = this._getRecipientWindow();
		if (recipient && event.source !== recipient) return false;
		const origin = this._getTargetOrigin();
		if (origin && event.origin !== origin) {
			if (!(this._allowNullOrigin && event.origin === "null")) return false;
		}
		return true;
	}
}
