let pollIntervalId = null
let currentGamePhase = "lobby"

/** Starts lobby polling at the requested interval. */
function startPolling(intervalMs = POLL_INTERVAL) {
	stopPolling()
	if (currentGamePhase !== "lobby" || !teamId) return
	pollIntervalId = setInterval(pollForUpdates, intervalMs)
}

/** Stops the active lobby polling interval. */
function stopPolling() {
	if (pollIntervalId !== null) {
		clearInterval(pollIntervalId)
		pollIntervalId = null
	}
}

/** Performs a single status check initiated by the member. */
async function checkGameStatus() {
	const msg = document.getElementById("team-msg")
	const btn = document.getElementById("refresh-btn")
	setBusy(btn, true, "Checking…")

	const session = await apiCall(
		`/api/sessions/active?team_id=${teamId}&t=${Date.now()}`,
		null,
		"GET",
	)
	setBusy(btn, false)

	if (session.status === "completed") {
		sessionId = session.session_id || sessionId
		containerId = session.container_id || containerId
		showWinState("A teammate captured the flag. Challenge complete.")
		return
	}
	if (session.session_id && session.status === "running") {
		containerId = session.container_id || containerId
		enterLiveGame(session.session_id)
		return
	}

	setMessage(
		msg,
		"Scenario not started yet. Hang tight — the captain will deploy the container.",
		"info",
	)
}

/** Poll for updates. */
async function pollForUpdates() {
	if (!teamId || currentGamePhase !== "lobby") return

	await refreshMembers()
	const session = await apiCall(
		`/api/sessions/active?team_id=${teamId}&t=${Date.now()}`,
		null,
		"GET",
	)
	if (session.status === "completed") {
		sessionId = session.session_id || sessionId
		containerId = session.container_id || containerId
		showWinState("A teammate captured the flag. Challenge complete.")
		return
	}
	if (session.session_id && session.status === "running") {
		containerId = session.container_id || containerId
		enterLiveGame(session.session_id)
	}
}
