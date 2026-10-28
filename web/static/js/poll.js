let pollIntervalId = null
let currentGamePhase = "lobby"

/** No-op kept for compatibility — auto-polling is disabled. */
function startPolling() {
	stopPolling()
}

/** Stops any leftover lobby polling interval. */
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
		applyScenarioInfo(session)
		await showVictoryFromPayload(session)
		return
	}
	if (session.session_id && session.status === "running") {
		containerId = session.container_id || containerId
		applyScenarioInfo(session)
		enterLiveGame(session.session_id)
		return
	}

	setMessage(msg, "Captain hasn't started yet", "info")
}

/** Legacy helper — members must use Check Status Now instead. */
async function pollForUpdates() {
	return
}
