/** Apply scenario metadata to the game screen. */
function applyScenarioInfo(info) {
	if (!info) return
	const name = info.scenario_name || info.name
	const desc = info.scenario_description || info.description
	const tactic = info.attack_tactic
	const technique = info.attack_technique_id
	const difficulty = info.difficulty || "easy"

	if (name) {
		document.getElementById("game-title").textContent = name
	}
	if (desc != null && desc !== "") {
		document.getElementById("game-desc").textContent = desc
	}

	const techEl = document.getElementById("game-technique")
	if (techEl) {
		const parts = []
		if (tactic) parts.push(tactic)
		if (technique) parts.push(technique)
		techEl.textContent = parts.length
			? `MITRE ATT&CK · ${parts.join(" · ")}`
			: "MITRE ATT&CK"
	}

	const badge = document.getElementById("game-diff-badge")
	if (badge) {
		const meta = difficultyMeta(difficulty)
		badge.className = `diff-badge ${meta.className}`
		badge.textContent = `${meta.emoji} ${meta.label}`
	}

	const hintText = document.getElementById("mission-hint-text")
	if (hintText) {
		hintText.textContent = locationHintFor(difficulty)
	}
}

/** Enter live game. */
function enterLiveGame(newSessionId) {
	if (gameEnded) return
	currentGamePhase = "active"
	stopPolling()
	sessionId = newSessionId
	const alreadyInGame = inGame
	inGame = true
	showScreen("game-screen")
	document.getElementById("active-session").classList.remove("hidden")
	document.getElementById("env-live-status")?.classList.remove("hidden", "is-done")
	document.getElementById("env-live-dot")?.classList.add("is-live")
	document.getElementById("env-live-dot")?.classList.remove("is-done")
	document.getElementById("env-live-label").innerText = "Environment live"
	connectTerminal()
	updateDeployButton()
	if (!alreadyInGame) {
		setMessage(
			document.getElementById("game-msg"),
			"Environment live. Find the flag.",
			"success",
		)
	}
}

/** Connect terminal. */
function connectTerminal() {
	if (!containerId) return
	document.getElementById("terminal-input").disabled = false
	document.getElementById("terminal-run-btn").disabled = false
	document.getElementById("terminal-input").placeholder = "Enter command"
	if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) return

	if (terminalSocket) terminalSocket.close()
	const protocol = location.protocol === "https:" ? "wss:" : "ws:"
	terminalSocket = new WebSocket(
		`${protocol}//${location.host}/ws/terminal?container_id=${encodeURIComponent(containerId)}`,
	)

	terminalSocket.addEventListener("open", () => {
		appendTerminalOutput("Connected to the target container.\n")
	})
	terminalSocket.addEventListener("message", event => {
		appendTerminalOutput(event.data)
	})
	terminalSocket.addEventListener("close", () => {
		appendTerminalOutput("\nTerminal connection closed.\n")
	})
	terminalSocket.addEventListener("error", () => {
		appendTerminalOutput("\nUnable to connect to the terminal.\n")
	})
}

/** Append terminal output. */
function appendTerminalOutput(text) {
	const output = document.getElementById("terminal-output")
	if (!output) return
	output.textContent += text
	output.scrollTop = output.scrollHeight
}

/** Run terminal command. */
function runTerminalCommand() {
	const input = document.getElementById("terminal-input")
	if (!input || !terminalSocket || terminalSocket.readyState !== WebSocket.OPEN)
		return

	const command = input.value.trim()
	if (!command) return
	appendTerminalOutput(`\n$ ${command}\n`)
	terminalSocket.send(JSON.stringify({ type: "exec", command }))
	input.value = ""
}

/** Reset in-memory game state without leaving the team. */
function resetGameState() {
	gameEnded = false
	inGame = false
	currentGamePhase = "lobby"
	sessionId = ""
	containerId = ""
	lastResult = null
	stopPolling()
	terminalSocket?.close()
	terminalSocket = null

	const output = document.getElementById("terminal-output")
	if (output) output.textContent = ""
	const flagInput = document.getElementById("flag-input")
	if (flagInput) {
		flagInput.value = ""
		flagInput.disabled = false
	}
	document.getElementById("flag-submit-btn").disabled = false
	document.getElementById("active-session")?.classList.add("hidden")
	document.getElementById("active-session")?.classList.remove("is-complete")
	document.getElementById("terminal-input").disabled = true
	document.getElementById("terminal-run-btn").disabled = true
	document.getElementById("terminal-input").placeholder = "Deploy the container first"

	const dot = document.getElementById("env-live-dot")
	dot?.classList.add("is-live")
	dot?.classList.remove("is-done")
	document.getElementById("env-live-status")?.classList.remove("is-done")
	document.getElementById("env-live-label").innerText = "Environment live"
	setMessage(document.getElementById("game-msg"), "", "")
	updateDeployButton()
}

/** Show victory overlay from API payload. */
async function showVictoryFromPayload(payload) {
	lastResult = payload || {}
	gameEnded = true
	inGame = false
	currentGamePhase = "completed"
	stopPolling()
	terminalSocket?.close()
	terminalSocket = null

	const members = await refreshMembers()
	const victoryMembers = document.getElementById("victory-members")
	if (victoryMembers) {
		victoryMembers.innerHTML = ""
		;(members || []).forEach(member => {
			const li = document.createElement("li")
			li.className = "member-item"
			const badgeClass =
				member.role === "Captain"
					? "badge badge-captain"
					: "badge badge-attacker"
			li.innerHTML = `<span class="member-email">${escapeHtml(member.email)}</span><span class="${badgeClass}">${escapeHtml(member.role)}</span>`
			victoryMembers.appendChild(li)
		})
	}

	document.getElementById("victory-scenario").textContent =
		payload.scenario_name || document.getElementById("game-title")?.textContent || "Scenario"
	document.getElementById("victory-winner").textContent =
		payload.winner_email || "A teammate"
	document.getElementById("victory-winner-role").textContent = payload.winner_role
		? `Role: ${payload.winner_role}`
		: ""
	document.getElementById("victory-duration").textContent = formatDuration(
		payload.duration_seconds,
	)
	document.getElementById("victory-times").textContent =
		`Start: ${formatClock(payload.started_at)} · End: ${formatClock(payload.completed_at)}`

	document.getElementById("victory-modal").classList.remove("hidden")
	document.body.classList.add("modal-open")
}

function hideVictoryModal() {
	document.getElementById("victory-modal")?.classList.add("hidden")
	if (document.getElementById("stay-team-modal")?.classList.contains("hidden")) {
		document.body.classList.remove("modal-open")
	}
}

function hideStayTeamModal() {
	document.getElementById("stay-team-modal")?.classList.add("hidden")
	if (document.getElementById("victory-modal")?.classList.contains("hidden")) {
		document.body.classList.remove("modal-open")
	}
}

function showStayTeamModal() {
	document.getElementById("stay-team-modal")?.classList.remove("hidden")
	document.body.classList.add("modal-open")
}

/** Legacy win banner — routes to victory modal when possible. */
function showWinState(message) {
	showVictoryFromPayload({
		scenario_name: document.getElementById("game-title")?.textContent,
		winner_email: userEmail || "Teammate",
		winner_role: myRole,
		duration_seconds: 0,
		message,
	})
}

/** Start session (captain deploy from dashboard or game). */
async function startSession() {
	const msg =
		document.getElementById("game-msg") || document.getElementById("team-msg")
	const btn =
		document.getElementById("start-game-btn") ||
		document.getElementById("deploy-btn")

	if (!isCaptain()) {
		setMessage(msg, "Only the team captain can deploy the container.", "error")
		return
	}
	const sid = selectedScenarioId || scenarioId
	if (!sid) {
		setMessage(msg, "Select a scenario first.", "error")
		return
	}

	setBusy(btn, true, "Deploying…")
	const data = await apiCall("/api/sessions/start", {
		team_id: teamId,
		scenario_id: sid,
	})
	setBusy(btn, false)
	updateProceedButton()

	if (data.session_id) {
		containerId = data.container_id || ""
		scenarioId = sid
		applyScenarioInfo(data)
		const selected = scenariosCache.find(s => s.id === sid)
		if (selected) applyScenarioInfo(selected)
		currentGamePhase = "active"
		stopPolling()
		enterLiveGame(data.session_id)
		setMessage(
			document.getElementById("game-msg"),
			"Environment live. Find the flag.",
			"success",
		)
	} else {
		setMessage(msg, data.error || "Failed to start session", "error")
	}
}

/** Submit flag. */
async function submitFlag() {
	const msg = document.getElementById("game-msg")
	const flag = document.getElementById("flag-input").value.trim()
	if (!flag) {
		setMessage(msg, "Enter a flag before submitting.", "error")
		return
	}
	if (!new RegExp(`^${FLAG_PREFIX}\\{[A-Za-z0-9_-]+\\}$`).test(flag)) {
		setMessage(msg, `Flags must use the ${FLAG_PREFIX}{...} format.`, "error")
		return
	}

	const btn = document.getElementById("flag-submit-btn")
	setBusy(btn, true, "Checking…")
	const data = await apiCall("/api/sessions/submit-flag", {
		session_id: sessionId,
		submitted_flag: flag,
		user_id: userId,
	})
	setBusy(btn, false)

	if (
		data.correct === true ||
		data.status === "completed" ||
		(data.message && data.message.includes("Congratulations"))
	) {
		await showVictoryFromPayload({
			...data,
			scenario_name:
				data.scenario_name ||
				document.getElementById("game-title")?.textContent,
			winner_email: data.winner_email || userEmail,
			winner_role: data.winner_role || myRole,
		})
		return
	}
	setMessage(
		msg,
		data.message || data.error || "Incorrect flag. Keep hacking!",
		"error",
	)
}

/** End the current scenario (captain or member). */
async function endScenario() {
	if (!sessionId) {
		setMessage(
			document.getElementById("game-msg"),
			"No active scenario to end.",
			"info",
		)
		return
	}
	const confirmed = window.confirm(
		"Are you sure you want to end this scenario? Your progress will be lost.",
	)
	if (!confirmed) return

	const btn = document.getElementById("end-scenario-btn")
	setBusy(btn, true, "Ending…")
	const data = await apiCall("/api/sessions/end", { session_id: sessionId })
	setBusy(btn, false)

	if (data.success || !data.error) {
		resetGameState()
		showStayTeamModal()
	} else {
		setMessage(
			document.getElementById("game-msg"),
			data.error || "Failed to end scenario",
			"error",
		)
	}
}
