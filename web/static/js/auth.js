/** Save session cookie. */
function saveSessionCookie() {
	if (!userId) {
		clearSessionCookie()
		return
	}

	const payload = {
		user_id: userId,
		email: userEmail,
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

/** Read session cookie. */
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

/** Clear session cookie. */
function clearSessionCookie() {
	document.cookie =
		COOKIE_NAME +
		"=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax"
}

/** Open auth. */
function openAuth(mode) {
	authMode = mode === "register" ? "register" : "login"
	applyAuthMode()
	setMessage(document.getElementById("auth-msg"), "", "")
	document.getElementById("auth-modal").classList.remove("hidden")
	document.body.classList.add("modal-open")
	setTimeout(() => document.getElementById("email")?.focus(), 50)
}

/** Close auth. */
function closeAuth() {
	document.getElementById("auth-modal").classList.add("hidden")
	document.body.classList.remove("modal-open")
}

/** Toggle auth mode. */
function toggleAuthMode() {
	authMode = authMode === "login" ? "register" : "login"
	applyAuthMode()
	setMessage(document.getElementById("auth-msg"), "", "")
}

/** Apply auth mode. */
function applyAuthMode() {
	const isLogin = authMode === "login"
	document.getElementById("auth-kicker").innerText = isLogin
		? "Operator access"
		: "New operator"
	document.getElementById("auth-title").innerText = isLogin
		? "Sign in"
		: "Create account"
	document.getElementById("auth-sub").innerText = isLogin
		? "Access your team workspace and live scenarios."
		: "Register once, then sign in to join or create a team."

	const btn = document.getElementById("auth-submit-btn")
	btn.dataset.label = isLogin ? "Sign in" : "Create account"
	btn.innerText = btn.dataset.label

	const switchBtn = document.getElementById("auth-switch-btn")
	switchBtn.innerHTML = isLogin
		? "New here? <span>Create an account</span>"
		: "Already registered? <span>Sign in</span>"

	document.getElementById("password").autocomplete = isLogin
		? "current-password"
		: "new-password"
}

/** Handle auth submit. */
function handleAuthSubmit(event) {
	event.preventDefault()
	if (authMode === "register") {
		register()
	} else {
		login()
	}
	return false
}

/** Logout. */
function logout() {
	userId = ""
	userEmail = ""
	clearTeamState()
	resetGameState()
	clearSessionCookie()
	closeAuth()
	closeUserMenu()
	hideVictoryModal()
	hideStayTeamModal()

	document.getElementById("invite-section")?.classList.add("hidden")
	document.getElementById("create-join-section")?.classList.remove("hidden")

	setMessage(document.getElementById("auth-msg"), "", "")
	setMessage(document.getElementById("team-msg"), "", "")
	setMessage(document.getElementById("game-msg"), "", "")

	showHome()
}

/** Register. */
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
		setMessage(
			msg,
			"Account created. Sign in with the same credentials.",
			"success",
		)
	} else {
		setMessage(msg, data.error || "Failed to register", "error")
	}
}

/** Login. */
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
		restoreTeamState()
		showScreen("dashboard-screen")
		await setupTeamUI()
	} else {
		setMessage(msg, data.error || "Invalid credentials", "error")
	}
}
