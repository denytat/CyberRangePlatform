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
	connectTerminal()
	updateDeployButton()
	if (!alreadyInGame) {
		setMessage(
			document.getElementById("game-msg"),
			"Captain deployed the container. Find the flag.",
			"success",
		)
	}
}

/** Connect terminal. */
function connectTerminal() {
	if (!containerId) return
	document.getElementById("terminal-input").disabled = false
	document.getElementById("terminal-run-btn").disabled = false
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

/** Show win state. */
function showWinState(message) {
	gameEnded = true
	inGame = true
	currentGamePhase = "completed"
	stopPolling()
	showScreen("game-screen")
	updateDeployButton()
	document.getElementById("active-session").classList.remove("hidden")
	document.getElementById("active-session").classList.add("is-complete")
	document.getElementById("flag-input").disabled = true
	document.getElementById("flag-submit-btn").disabled = true
	const dot = document.getElementById("env-live-dot")
	dot.classList.remove("is-live")
	dot.classList.add("is-done")
	document.getElementById("env-live-status").classList.add("is-done")
	document.getElementById("env-live-label").innerText = "Challenge complete"
	setMessage(document.getElementById("game-msg"), message, "win")
}

/** Start session. */
async function startSession() {
	const msg = document.getElementById("game-msg")
	const btn = document.getElementById("deploy-btn")
	if (!isCaptain()) {
		setMessage(msg, "Only the team captain can deploy the container.", "error")
		updateDeployButton()
		return
	}
	setBusy(btn, true, "Deploying…")
	const data = await apiCall("/api/sessions/start", {
		team_id: teamId,
		scenario_id: scenarioId,
	})
	setBusy(btn, false)

	if (data.session_id) {
		containerId = data.container_id || ""
		currentGamePhase = "active"
		stopPolling()
		enterLiveGame(data.session_id)
		setMessage(msg, "Environment live. Find the flag.", "success")
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
	})
	setBusy(btn, false)

	if (
		data.status === "completed" ||
		(data.message && data.message.includes("Congratulations"))
	) {
		showWinState(data.message || "Congratulations! You found the flag!")
		return
	}
	setMessage(
		msg,
		data.message || data.error || "Incorrect flag. Keep hacking!",
		"error",
	)
}
