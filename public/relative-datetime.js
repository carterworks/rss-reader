/**
 * @example {<relative-time datetime="2021-01-01T00:23:00Z"></relative-time>} displays as "37 minutes ago" or
 * "2 days ago" in the user's locale, etc.
 */
class RelativeTime extends HTMLElement {
	static rtf = new Intl.RelativeTimeFormat();
	#updateIntervalId;

	connectedCallback() {
		const datetime = this.getAttribute("datetime");
		if (!datetime) {
			return;
		}
		// need to wait for the inner text to render before removing it.
		window.requestAnimationFrame(() => {
			this.update(datetime);
		});
	}

	disconnectedCallback() {
		clearInterval(this.#updateIntervalId);
	}

	observedAttribues = ["datetime"];
	attributeChangedCallback(name, oldValue, newValue) {
		if (!this.observedAttribues.includes(name) || oldValue === newValue) {
			return;
		}
		this.update(newValue);
	}

	update(newValue) {
		this.textContent = RelativeTime.getTimeAgo(new Date(newValue));
		this.setAttribute("title", new Date(newValue).toLocaleString());
		if (this.#updateIntervalId) {
			clearInterval(this.#updateIntervalId);
		}
		const updateInterval = RelativeTime.determineUpdateInterval(
			new Date(newValue),
		);
		this.#updateIntervalId = setInterval(() => {
			this.textContent = RelativeTime.getTimeAgo(
				new Date(this.getAttribute("datetime")),
			);
		}, updateInterval);
	}

	/**
	 * Based on how long ago the datetime was, determine how often to update the relative time.
	 * If it was < 1 minute ago, update every second.
	 * If it was < 1 hour ago, update every minute. etc.
	 * @param {Date} datetime
	 * @returns {number} update interval in milliseconds
	 */
	static determineUpdateInterval(datetime) {
		const secondsAgo = (new Date().getTime() - datetime.getTime()) / 1000;

		if (secondsAgo < 60) {
			return 1000; // update every second
		}
		if (secondsAgo < 3600) {
			return 60000; // update every minute
		}
		if (secondsAgo < 86400) {
			return 3600000; // update every hour
		}
		return 86400000; // update every day
	}

	/**
	 * Takes a static datetime ("2021-01-01T00:23:00Z") and returns a human-readable string like "37 minutes ago" or "2 days ago".
	 * @param {Date} date
	 * @returns {string}
	 */
	static getTimeAgo(date) {
		const now = new Date();
		const diffInSeconds = Math.floor((now - date) / 1000);

		if (diffInSeconds < 60) {
			return RelativeTime.rtf.format(-diffInSeconds, "second");
		}

		const diffInMinutes = Math.floor(diffInSeconds / 60);
		if (diffInMinutes < 60) {
			return RelativeTime.rtf.format(-diffInMinutes, "minute");
		}

		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) {
			return RelativeTime.rtf.format(-diffInHours, "hour");
		}

		const diffInDays = Math.floor(diffInHours / 24);
		return RelativeTime.rtf.format(-diffInDays, "day");
	}
}

customElements.define("relative-time", RelativeTime);
