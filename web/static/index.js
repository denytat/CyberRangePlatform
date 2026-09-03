let userId = ""
let teamId = ""
let myRole = ""
let scenarioId = "550e8400-e29b-41d4-a716-446655440000"
let sessionId = ""
let gameEnded = false
let inGame = false
let pollTimer = null

function showScreen(screenId) {
	document.querySelectorAll(".screen").forEach(el => el.classList.add("hidden"))
	document.getElementById(screenId).classList.remove("hidden")
}

async function apiCall(url, data, method = "POST") {
	try {
		const options = {
			method: method,
			headers: { "Content-Type": "application/json" },
		}
		if (data) options.body = JSON.stringify(data)
		const res = await fetch(url, options)
		return await res.json()
	} catch (e) {
		return { error: "Network error" }
	}
}

async function register() {
	const msg = document.getElementById("auth-msg")
	const data = await apiCall("/api/register", {
		email: document.getElementById("email").value,
		password: document.getElementById("password").value,
	})
	if (data.id) {
		msg.innerText = "Account created. Please log in."
		msg.className = "text-emerald-400 text-sm text-center mt-4"
	} else {
		msg.innerText = data.error || "Failed to register"
		msg.className = "text-red-400 text-sm text-center mt-4"
	}
}

async function login() {
	const msg = document.getElementById("auth-msg")
	const data = await apiCall("/api/login", {
		email: document.getElementById("email").value,
		password: document.getElementById("password").value,
	})
	if (data.user_id) {
		userId = data.user_id
		showScreen("dashboard-screen")
	} else {
		msg.innerText = data.error || "Invalid credentials"
		msg.className = "text-red-400 text-sm text-center mt-4"
	}
}

async function createTeam() {
	const msg = document.getElementById("team-msg")
	const data = await apiCall("/api/teams/create", {
		user_id: userId,
		name: document.getElementById("team-name").value,
	})
	if (data.team_id) {
		teamId = data.team_id
		myRole = "Captain"
		setupTeamUI()
	} else {
		msg.innerText = data.error || "Failed"
		msg.className = "text-red-400 text-sm text-center mt-2"
	}
}

async function joinTeam() {
	const msg = document.getElementById("team-msg")
	const data = await apiCall("/api/teams/join", {
		user_id: userId,
		team_id: document.getElementById("join-team-id").value,
	})
	if (data.message) {
		teamId = document.getElementById("join-team-id").value
		myRole = "Attacker"
		setupTeamUI()
	} else {
		msg.innerText = data.error || "Failed"
		msg.className = "text-red-400 text-sm text-center mt-2"
	}
}

async function setupTeamUI() {
	showScreen("dashboard-screen")

	// 1. Handle Invite Code Visibility
	document.getElementById("invite-section").classList.remove("hidden")
	document.getElementById("create-join-section").classList.add("hidden")
	document.getElementById("invite-code").value = teamId

	if (myRole === "Captain") {
		document.getElementById("invite-code-box").classList.remove("hidden")
	} else {
		document.getElementById("invite-code-box").classList.add("hidden")
	}

	// 2. Handle Buttons based on Role
	if (myRole === "Captain") {
		document.getElementById("start-game-btn").classList.remove("hidden")
		document.getElementById("wait-msg").classList.add("hidden")
		document.getElementById("refresh-btn").classList.add("hidden")
	} else {
		document.getElementById("start-game-btn").classList.add("hidden")
		document.getElementById("wait-msg").classList.remove("hidden")
		document.getElementById("refresh-btn").classList.remove("hidden") // ATTACKER SEES THIS
	}

	await refreshMembers()
	pollForUpdates()
}

function renderMembers(members) {
	const listEl = document.getElementById("member-list")
	if (!listEl || !Array.isArray(members)) return
	listEl.innerHTML = ""
	members.forEach(m => {
		const li = document.createElement("li")
		li.className =
			"flex justify-between items-center p-2 bg-slate-900/50 rounded border border-slate-700"
		li.innerHTML = `<span class="text-slate-300">${m.email}</span><span class="text-xs font-mono px-2 py-1 rounded ${m.role === "Captain" ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-700 text-slate-400"}">${m.role}</span>`
		listEl.appendChild(li)
	})
}

async function refreshMembers() {
	const members = await apiCall(
		`/api/teams/members?team_id=${teamId}&t=${Date.now()}`,
		null,
		"GET",
	)
	renderMembers(members)
}

function schedulePoll() {
	if (gameEnded) return
	clearTimeout(pollTimer)
	pollTimer = setTimeout(pollForUpdates, 3000)
}

function enterLiveGame(newSessionId) {
	if (gameEnded) return
	sessionId = newSessionId
	const alreadyInGame = inGame
	inGame = true
	showScreen("game-screen")
	document.getElementById("active-session").classList.remove("hidden")
	if (myRole !== "Captain") {
		document.getElementById("deploy-btn").classList.add("hidden")
	}
	if (!alreadyInGame) {
		document.getElementById("game-msg").innerText =
			"Captain deployed the container. Find the flag."
		document.getElementById("game-msg").className =
			"text-emerald-400 text-sm text-center mt-4"
	}
}

function showWinState(message) {
	gameEnded = true
	inGame = true
	clearTimeout(pollTimer)
	showScreen("game-screen")
	document.getElementById("deploy-btn").classList.add("hidden")
	document.getElementById("active-session").classList.remove("hidden")
	document.getElementById("flag-input").disabled = true
	document.getElementById("flag-submit-btn").disabled = true
	const dot = document.getElementById("env-live-dot")
	dot.classList.remove("animate-pulse", "bg-emerald-400")
	dot.classList.add("bg-slate-500")
	document.getElementById("env-live-label").innerText = "Challenge complete"
	document.getElementById("game-msg").innerText = message
	document.getElementById("game-msg").className =
		"text-emerald-400 text-sm text-center mt-4 font-bold text-lg"
}

function copyInvite() {
	navigator.clipboard.writeText(teamId)
	const btn = document.getElementById("copy-btn")
	btn.innerText = "Copied!"
	setTimeout(() => (btn.innerText = "Copy"), 2000)
}

async function checkGameStatus() {
	console.log("Checking game status for team:", teamId) // DEBUG 1
	const session = await apiCall(
		`/api/sessions/active?team_id=${teamId}&t=${Date.now()}`,
		null,
		"GET",
	)

	console.log("Server replied with:", session) // DEBUG 2

	if (session.status === "completed") {
		sessionId = session.session_id || sessionId
		showWinState("A teammate captured the flag. Challenge complete.")
		return
	}
	if (session.session_id && session.status === "running") {
		enterLiveGame(session.session_id)
	} else {
		alert(
			"Captain hasn't started the game yet. Server said: " +
				JSON.stringify(session),
		)
	}
}

async function startSession() {
	const msg = document.getElementById("game-msg")
	const data = await apiCall("/api/sessions/start", {
		team_id: teamId,
		scenario_id: scenarioId,
	})
	if (data.session_id) {
		enterLiveGame(data.session_id)
		msg.innerText = "Environment live. Find the flag."
		msg.className = "text-emerald-400 text-sm text-center mt-4"
	} else {
		msg.innerText = data.error || "Failed to start"
		msg.className = "text-red-400 text-sm text-center mt-4"
	}
}

async function submitFlag() {
	const msg = document.getElementById("game-msg")
	const data = await apiCall("/api/sessions/submit-flag", {
		session_id: sessionId,
		submitted_flag: document.getElementById("flag-input").value,
	})
	if (data.status === "completed" || (data.message && data.message.includes("Congratulations"))) {
		showWinState(data.message || "🎉 Congratulations! You found the flag!")
		return
	}
	msg.innerText = data.message || data.error || "❌ Incorrect flag. Keep hacking!"
	msg.className = "text-red-400 text-sm text-center mt-4"
}

async function pollForUpdates() {
	if (!teamId || gameEnded) return
	try {
		await refreshMembers()
		const session = await apiCall(
			`/api/sessions/active?team_id=${teamId}&t=${Date.now()}`,
			null,
			"GET",
		)
		if (session.status === "completed") {
			sessionId = session.session_id || sessionId
			if (!gameEnded) {
				showWinState("A teammate captured the flag. Challenge complete.")
			}
			return
		}
		if (session.session_id && session.status === "running") {
			enterLiveGame(session.session_id)
		}
	} finally {
		schedulePoll()
	}
}
