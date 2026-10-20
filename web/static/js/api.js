/** Sends a JSON request to the platform API. */
async function apiCall(url, data, method = "POST") {
	try {
		const options = {
			method: method,
			headers: { "Content-Type": "application/json" },
		}
		if (data) options.body = JSON.stringify(data)
		const res = await fetch(API_BASE + url, options)
		const contentType = res.headers.get("content-type") || ""
		if (contentType.includes("application/json")) {
			return await res.json()
		}
		const text = await res.text()
		return { error: text || "Request failed" }
	} catch (e) {
		return { error: "Network error — check your connection and try again." }
	}
}
