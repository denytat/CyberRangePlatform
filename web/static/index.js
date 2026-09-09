let userId = ""
let userEmail = ""
let teamId = ""
let myRole = ""
let scenarioId = "550e8400-e29b-41d4-a716-446655440000"
let sessionId = ""
let gameEnded = false
let inGame = false
let pollTimer = null
let authMode = "login" // "login" | "register"

const COOKIE_NAME = "cyberrange_session"
const COOKIE_DAYS = 7

const STEP_MAP = {
	"dashboard-screen": "team",
	"game-screen": "game",
}

const STEP_ORDER = ["team", "game"]

function setMessage(el, text, type) {
	if (!el) return
	el.innerText = text || ""
	el.className = "msg" + (type ? ` msg-${type}` : "")
}

function setBusy(btn, busy, busyLabel) {
	if (!btn) return
	if (!btn.dataset.label) {
		btn.dataset.label = btn.innerText.trim()
	}
	btn.disabled = !!busy
	btn.innerText = busy ? busyLabel || "Working…" : btn.dataset.label
}

/* ---------- JSON session cookie ---------- */

function saveSessionCookie() {
	if (!userId) {
		clearSessionCookie()
		return
	}
	const payload = {
		user_id: userId,
		email: userEmail,
		team_id: teamId,
		role: myRole,
		session_id: sessionId,
		in_game: inGame,
		game_ended: gameEnded,
		scenario_id: scenarioId,
	}
	const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString()
	document.cookie =
		COOKIE_NAME +
		"=" +
		encodeURIComponent(JSON.stringify(payload)) +
		"; expires=" +
		expires +
		"; path=/; SameSite=Lax"
}

function readSessionCookie() {
	const parts = document.cookie.split("; ")
	for (const part of parts) {
		const eq = part.indexOf("=")
		if (eq === -1) continue
		const name = part.slice(0, eq)
		if (name !== COOKIE_NAME) continue
		try {
			return JSON.parse(decodeURIComponent(part.slice(eq + 1)))
		} catch (e) {
			return null
		}
	}
	return null
}

function clearSessionCookie() {
	document.cookie =
		COOKIE_NAME + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax"
}

/* ---------- UI chrome ---------- */

function updateHeader() {
	const guestActions = document.getElementById("guest-actions")
	const userMenu = document.getElementById("user-menu")
	const chip = document.getElementById("role-chip")
	const emailEl = document.getElementById("user-email")
	const avatar = document.getElementById("user-avatar")
	const heroGuest = document.getElementById("hero-guest-actions")
	const heroUser = document.getElementById("hero-user-actions")
	const homeVisible = !document.getElementById("home-screen").classList.contains("hidden")
	const dashVisible = !document.getElementById("dashboard-screen").classList.contains("hidden")
	const gameVisible = !document.getElementById("game-screen").classList.contains("hidden")
	const docsVisible = !document.getElementById("docs-screen").classList.contains("hidden")
	const aboutVisible = !document.getElementById("about-screen").classList.contains("hidden")
	const contactVisible = !document.getElementById("contact-screen").classList.contains("hidden")

	let navKey = "home"
	if (gameVisible) navKey = "range"
	else if (dashVisible) navKey = "teams"
	else if (docsVisible) navKey = "docs"
	else if (aboutVisible) navKey = "about"
	else if (contactVisible) navKey = "contact"
	else if (homeVisible) navKey = "home"
	setActiveNav(navKey)

	if (userId) {
		guestActions.classList.add("hidden")
		userMenu.classList.remove("hidden")
		heroGuest?.classList.add("hidden")
		heroUser?.classList.remove("hidden")

		emailEl.innerText = userEmail || "Operator"
		emailEl.title = userEmail || ""

		const initials = (userEmail || "CR")
			.split(/[@.\s]/)
			.filter(Boolean)
			.slice(0, 2)
			.map(p => p[0].toUpperCase())
			.join("")
		avatar.innerText = initials || "CR"

		if (myRole) {
			chip.classList.remove("hidden")
			chip.dataset.role = myRole
			chip.innerText = myRole
		} else {
			chip.classList.add("hidden")
			chip.innerText = ""
			chip.dataset.role = ""
		}
	} else {
		guestActions.classList.remove("hidden")
		userMenu.classList.add("hidden")
		heroGuest?.classList.remove("hidden")
		heroUser?.classList.add("hidden")
		closeUserMenu()
		emailEl.innerText = ""
		chip.classList.add("hidden")
		chip.innerText = ""
		chip.dataset.role = ""
	}
}

function setActiveNav(key) {
	document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("is-active"))
	const map = {
		home: "nav-home",
		range: "nav-range",
		teams: "nav-teams",
		docs: "nav-docs",
		about: "nav-about",
		contact: "nav-contact",
	}
	const el = document.getElementById(map[key])
	if (el) el.classList.add("is-active")
}

function toggleUserMenu(event) {
	event.stopPropagation()
	const dropdown = document.getElementById("user-menu-dropdown")
	const btn = document.getElementById("user-menu-btn")
	const open = dropdown.classList.contains("hidden")
	dropdown.classList.toggle("hidden", !open)
	btn.setAttribute("aria-expanded", open ? "true" : "false")
}

function closeUserMenu() {
	const dropdown = document.getElementById("user-menu-dropdown")
	const btn = document.getElementById("user-menu-btn")
	if (!dropdown || !btn) return
	dropdown.classList.add("hidden")
	btn.setAttribute("aria-expanded", "false")
}

function openAppFromNav(event) {
	event.preventDefault()
	if (!userId) {
		openAuth("login")
		return
	}
	openApp()
}

function openTeamsFromNav(event) {
	event.preventDefault()
	if (!userId) {
		openAuth("login")
		return
	}
	if (teamId) {
		setupTeamUI()
	} else {
		showScreen("dashboard-screen")
	}
}

function openPlaceholder(event, page) {
	event.preventDefault()
	const screens = {
		docs: "docs-screen",
		about: "about-screen",
		contact: "contact-screen",
	}
	const screenId = screens[page]
	if (!screenId) return
	showScreen(screenId)
}

function updateFlowSteps(screenId) {
	const nav = document.getElementById("flow-steps")
	const current = STEP_MAP[screenId]
	const show = !!current && !!userId
	nav.classList.toggle("is-visible", show)
	if (!show) return

	const currentIdx = STEP_ORDER.indexOf(current)
	nav.querySelectorAll(".flow-step").forEach(step => {
		const idx = STEP_ORDER.indexOf(step.dataset.step)
		step.classList.toggle("is-active", idx === currentIdx)
		step.classList.toggle("is-done", idx < currentIdx)
	})
}

function showScreen(screenId) {
	document.getElementById("home-screen").classList.add("hidden")
	document.querySelectorAll(".screen").forEach(el => {
		if (!el.classList.contains("modal-panel")) el.classList.add("hidden")
	})
	document.querySelector(".app-main")?.classList.remove("is-home")

	const screen = document.getElementById(screenId)
	if (screen) {
		screen.classList.remove("hidden")
		screen.style.animation = "none"
		void screen.offsetWidth
		screen.style.animation = ""
	}

	updateFlowSteps(screenId)
	updateHeader()
	saveSessionCookie()
}

function showHome() {
	document.querySelectorAll(".screen").forEach(el => {
		if (!el.classList.contains("modal-panel")) el.classList.add("hidden")
	})
	document.getElementById("home-screen").classList.remove("hidden")
	document.querySelector(".app-main")?.classList.add("is-home")
	document.getElementById("flow-steps").classList.remove("is-visible")
	updateHeader()
}

function goHome(event) {
	if (event) event.preventDefault()
	closeUserMenu()
	showHome()
}

function openApp() {
	if (!userId) {
		openAuth("login")
		return
	}
	if (inGame || gameEnded) {
		showScreen("game-screen")
		if (gameEnded) {
			document.getElementById("deploy-btn").classList.add("hidden")
			document.getElementById("active-session").classList.remove("hidden")
			document.getElementById("active-session").classList.add("is-complete")
			document.getElementById("flag-input").disabled = true
			document.getElementById("flag-submit-btn").disabled = true
		} else if (sessionId) {
			document.getElementById("active-session").classList.remove("hidden")
			if (myRole !== "Captain") {
				document.getElementById("deploy-btn").classList.add("hidden")
			}
		}
		return
	}
	if (teamId) {
		setupTeamUI()
		return
	}
	showScreen("dashboard-screen")
}

/* ---------- Auth modal ---------- */

function openAuth(mode) {
	authMode = mode === "register" ? "register" : "login"
	applyAuthMode()
	setMessage(document.getElementById("auth-msg"), "", "")
	document.getElementById("auth-modal").classList.remove("hidden")
	document.body.classList.add("modal-open")
	setTimeout(() => document.getElementById("email")?.focus(), 50)
}

function closeAuth() {
	document.getElementById("auth-modal").classList.add("hidden")
	document.body.classList.remove("modal-open")
}

function toggleAuthMode() {
	authMode = authMode === "login" ? "register" : "login"
	applyAuthMode()
	setMessage(document.getElementById("auth-msg"), "", "")
}

function applyAuthMode() {
	const isLogin = authMode === "login"
	document.getElementById("auth-kicker").innerText = isLogin
		? "Operator access"
		: "New operator"
	document.getElementById("auth-title").innerText = isLogin ? "Sign in" : "Create account"
	document.getElementById("auth-sub").innerText = isLogin
		? "Access your team workspace and live scenarios."
		: "Register once, then sign in to join or create a team."

	const btn = document.getElementById("auth-submit-btn")
	btn.dataset.label = isLogin ? "Sign in" : "Create account"
	btn.innerText = btn.dataset.label

	const switchBtn = document.getElementById("auth-switch-btn")
	switchBtn.innerHTML = isLogin
		? 'New here? <span>Create an account</span>'
		: 'Already registered? <span>Sign in</span>'

	document.getElementById("password").autocomplete = isLogin
		? "current-password"
		: "new-password"
}

function handleAuthSubmit(event) {
	event.preventDefault()
	if (authMode === "register") {
		register()
	} else {
		login()
	}
	return false
}

function logout() {
	userId = ""
	userEmail = ""
	teamId = ""
	myRole = ""
	sessionId = ""
	gameEnded = false
	inGame = false
	clearTimeout(pollTimer)
	pollTimer = null
	clearSessionCookie()
	closeAuth()
	closeUserMenu()

	document.getElementById("invite-section").classList.add("hidden")
	document.getElementById("create-join-section").classList.remove("hidden")
	document.getElementById("active-session").classList.add("hidden")
	document.getElementById("active-session").classList.remove("is-complete")
	document.getElementById("deploy-btn").classList.remove("hidden")
	document.getElementById("flag-input").disabled = false
	document.getElementById("flag-input").value = ""
	document.getElementById("flag-submit-btn").disabled = false

	const dot = document.getElementById("env-live-dot")
	dot.classList.add("is-live")
	dot.classList.remove("is-done")
	document.getElementById("env-live-status").classList.remove("is-done")
	document.getElementById("env-live-label").innerText = "Environment live"

	setMessage(document.getElementById("auth-msg"), "", "")
	setMessage(document.getElementById("team-msg"), "", "")
	setMessage(document.getElementById("game-msg"), "", "")

	showHome()
}

async function apiCall(url, data, method = "POST") {
	try {
		const options = {
			method: method,
			headers: { "Content-Type": "application/json" },
		}
		if (data) options.body = JSON.stringify(data)
		const res = await fetch(url, options)
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

async function register() {
	const msg = document.getElementById("auth-msg")
	const email = document.getElementById("email").value.trim()
	const password = document.getElementById("password").value
	if (!email || !password) {
		setMessage(msg, "Enter an email and password to register.", "error")
		return
	}

	const btn = document.getElementById("auth-submit-btn")
	setBusy(btn, true, "Creating account…")
	const data = await apiCall("/api/register", { email, password })
	setBusy(btn, false)

	if (data.id) {
		authMode = "login"
		applyAuthMode()
		setMessage(msg, "Account created. Sign in with the same credentials.", "success")
	} else {
		setMessage(msg, data.error || "Failed to register", "error")
	}
}

async function login() {
	const msg = document.getElementById("auth-msg")
	const email = document.getElementById("email").value.trim()
	const password = document.getElementById("password").value
	if (!email || !password) {
		setMessage(msg, "Enter your email and password.", "error")
		return
	}

	const btn = document.getElementById("auth-submit-btn")
	setBusy(btn, true, "Signing in…")
	const data = await apiCall("/api/login", { email, password })
	setBusy(btn, false)

	if (data.user_id) {
		userId = data.user_id
		userEmail = data.email || email
		setMessage(msg, "", "")
		closeAuth()
		saveSessionCookie()
		showScreen("dashboard-screen")
	} else {
		setMessage(msg, data.error || "Invalid credentials", "error")
	}
}

async function createTeam() {
	const msg = document.getElementById("team-msg")
	const name = document.getElementById("team-name").value.trim()
	if (!name) {
		setMessage(msg, "Give your team a name first.", "error")
		return
	}

	const btn = document.getElementById("create-team-btn")
	setBusy(btn, true, "Creating…")
	const data = await apiCall("/api/teams/create", {
		user_id: userId,
		name,
	})
	setBusy(btn, false)

	if (data.team_id) {
		teamId = data.team_id
		myRole = "Captain"
		setMessage(msg, "", "")
		saveSessionCookie()
		setupTeamUI()
	} else {
		setMessage(msg, data.error || "Failed to create team", "error")
	}
}

async function joinTeam() {
	const msg = document.getElementById("team-msg")
	const invite = document.getElementById("join-team-id").value.trim()
	if (!invite) {
		setMessage(msg, "Paste the invite code from your captain.", "error")
		return
	}

	const btn = document.getElementById("join-team-btn")
	setBusy(btn, true, "Joining…")
	const data = await apiCall("/api/teams/join", {
		user_id: userId,
		team_id: invite,
	})
	setBusy(btn, false)

	if (data.message) {
		teamId = invite
		myRole = "Attacker"
		setMessage(msg, "", "")
		saveSessionCookie()
		setupTeamUI()
	} else {
		setMessage(msg, data.error || "Failed to join team", "error")
	}
}

async function setupTeamUI() {
	showScreen("dashboard-screen")

	document.getElementById("invite-section").classList.remove("hidden")
	document.getElementById("create-join-section").classList.add("hidden")
	document.getElementById("invite-code").value = teamId

	if (myRole === "Captain") {
		document.getElementById("invite-code-box").classList.remove("hidden")
		document.getElementById("start-game-btn").classList.remove("hidden")
		document.getElementById("wait-msg").classList.add("hidden")
		document.getElementById("refresh-btn").classList.add("hidden")
	} else {
		document.getElementById("invite-code-box").classList.add("hidden")
		document.getElementById("start-game-btn").classList.add("hidden")
		document.getElementById("wait-msg").classList.remove("hidden")
		document.getElementById("refresh-btn").classList.remove("hidden")
	}

	await refreshMembers()
	pollForUpdates()
	saveSessionCookie()
}

function renderMembers(members) {
	const listEl = document.getElementById("member-list")
	const emptyEl = document.getElementById("members-empty")
	if (!listEl) return

	listEl.innerHTML = ""
	const items = Array.isArray(members) ? members : []

	if (!items.length) {
		emptyEl.classList.remove("hidden")
		return
	}

	emptyEl.classList.add("hidden")
	items.forEach(m => {
		const li = document.createElement("li")
		li.className = "member-item"
		const badgeClass = m.role === "Captain" ? "badge badge-captain" : "badge badge-attacker"
		li.innerHTML = `<span class="member-email">${escapeHtml(m.email)}</span><span class="${badgeClass}">${escapeHtml(m.role)}</span>`
		listEl.appendChild(li)
	})
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
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
		setMessage(
			document.getElementById("game-msg"),
			"Captain deployed the container. Find the flag.",
			"success",
		)
	}
	saveSessionCookie()
}

function showWinState(message) {
	gameEnded = true
	inGame = true
	clearTimeout(pollTimer)
	showScreen("game-screen")
	document.getElementById("deploy-btn").classList.add("hidden")
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
	saveSessionCookie()
}

async function copyInvite() {
	const btn = document.getElementById("copy-btn")
	try {
		await navigator.clipboard.writeText(teamId)
		btn.innerText = "Copied!"
		setMessage(document.getElementById("team-msg"), "Invite code copied.", "success")
	} catch (e) {
		document.getElementById("invite-code").select()
		setMessage(
			document.getElementById("team-msg"),
			"Could not copy automatically — select and copy the code.",
			"info",
		)
	}
	setTimeout(() => {
		btn.innerText = "Copy"
	}, 2000)
}

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
		showWinState("A teammate captured the flag. Challenge complete.")
		return
	}
	if (session.session_id && session.status === "running") {
		enterLiveGame(session.session_id)
		return
	}

	setMessage(
		msg,
		"Scenario not started yet. Hang tight — the captain will deploy the container.",
		"info",
	)
}

async function startSession() {
	const msg = document.getElementById("game-msg")
	const btn = document.getElementById("deploy-btn")
	setBusy(btn, true, "Deploying…")
	const data = await apiCall("/api/sessions/start", {
		team_id: teamId,
		scenario_id: scenarioId,
	})
	setBusy(btn, false)

	if (data.session_id) {
		enterLiveGame(data.session_id)
		setMessage(msg, "Environment live. Find the flag.", "success")
	} else {
		setMessage(msg, data.error || "Failed to start session", "error")
	}
}

async function submitFlag() {
	const msg = document.getElementById("game-msg")
	const flag = document.getElementById("flag-input").value.trim()
	if (!flag) {
		setMessage(msg, "Enter a flag before submitting.", "error")
		return
	}

	const btn = document.getElementById("flag-submit-btn")
	setBusy(btn, true, "Checking…")
	const data = await apiCall("/api/sessions/submit-flag", {
		session_id: sessionId,
		submitted_flag: flag,
	})
	setBusy(btn, false)

	if (data.status === "completed" || (data.message && data.message.includes("Congratulations"))) {
		showWinState(data.message || "Congratulations! You found the flag!")
		return
	}
	setMessage(msg, data.message || data.error || "Incorrect flag. Keep hacking!", "error")
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

async function restoreFromCookie() {
	const data = readSessionCookie()
	if (!data || !data.user_id) {
		showHome()
		return
	}

	userId = data.user_id
	userEmail = data.email || ""
	teamId = data.team_id || ""
	myRole = data.role || ""
	sessionId = data.session_id || ""
	inGame = !!data.in_game
	gameEnded = !!data.game_ended
	if (data.scenario_id) scenarioId = data.scenario_id

	if (gameEnded && sessionId) {
		showWinState("Challenge complete. Refresh restored your session.")
		return
	}

	if (inGame && sessionId) {
		inGame = false // allow enterLiveGame to set welcome only once appropriately
		enterLiveGame(sessionId)
		setMessage(document.getElementById("game-msg"), "Session restored.", "info")
		if (teamId) pollForUpdates()
		return
	}

	if (teamId && myRole) {
		await setupTeamUI()
		return
	}

	showScreen("dashboard-screen")
}

document.addEventListener("DOMContentLoaded", () => {
	document.querySelector(".app-main")?.classList.add("is-home")

	const flagInput = document.getElementById("flag-input")
	if (flagInput) {
		flagInput.addEventListener("keydown", e => {
			if (e.key === "Enter") {
				e.preventDefault()
				submitFlag()
			}
		})
	}

	document.addEventListener("keydown", e => {
		if (e.key === "Escape") {
			closeAuth()
			closeUserMenu()
		}
	})

	document.addEventListener("click", () => closeUserMenu())

	restoreFromCookie()
})
