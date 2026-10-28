/** Update header. */
function updateHeader() {
	const guestActions = document.getElementById("guest-actions")
	const userMenu = document.getElementById("user-menu")
	const chip = document.getElementById("role-chip")
	const emailEl = document.getElementById("user-email")
	const avatar = document.getElementById("user-avatar")
	const heroGuest = document.getElementById("hero-guest-actions")
	const heroUser = document.getElementById("hero-user-actions")
	const homeVisible = !document
		.getElementById("home-screen")
		.classList.contains("hidden")
	const dashVisible = !document
		.getElementById("dashboard-screen")
		.classList.contains("hidden")
	const gameVisible = !document
		.getElementById("game-screen")
		.classList.contains("hidden")
	const docsVisible = !document
		.getElementById("docs-screen")
		.classList.contains("hidden")
	const aboutVisible = !document
		.getElementById("about-screen")
		.classList.contains("hidden")
	const contactVisible = !document
		.getElementById("contact-screen")
		.classList.contains("hidden")

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

/** Set active nav. */
function setActiveNav(key) {
	document
		.querySelectorAll(".nav-link")
		.forEach(link => link.classList.remove("is-active"))
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

/** Toggle user menu. */
function toggleUserMenu(event) {
	event.stopPropagation()
	const dropdown = document.getElementById("user-menu-dropdown")
	const btn = document.getElementById("user-menu-btn")
	const open = dropdown.classList.contains("hidden")
	dropdown.classList.toggle("hidden", !open)
	btn.setAttribute("aria-expanded", open ? "true" : "false")
}

/** Close user menu. */
function closeUserMenu() {
	const dropdown = document.getElementById("user-menu-dropdown")
	const btn = document.getElementById("user-menu-btn")
	if (!dropdown || !btn) return
	dropdown.classList.add("hidden")
	btn.setAttribute("aria-expanded", "false")
}

/** Open app from nav. */
function openAppFromNav(event) {
	event.preventDefault()
	if (!userId) {
		openAuth("login")
		return
	}
	openApp()
}

/** Open teams from nav. */
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
		setupTeamUI()
	}
}

/** Open placeholder. */
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

/** Update flow steps. */
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

/** Show screen. */
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
}

/** Restore from cookie + localStorage team flags. */
function restoreFromCookie() {
	const data = readSessionCookie()
	if (!data || !data.user_id) {
		showHome()
		return
	}

	userId = data.user_id
	userEmail = data.email || ""
	sessionId = ""
	inGame = false
	gameEnded = false
	scenarioId = ""
	selectedScenarioId = ""

	const hasTeam = restoreTeamState()
	showScreen("dashboard-screen")
	if (hasTeam) {
		setupTeamUI()
	} else {
		setupTeamUI()
	}
}

/** Show home. */
function showHome() {
	document.querySelectorAll(".screen").forEach(el => {
		if (!el.classList.contains("modal-panel")) el.classList.add("hidden")
	})
	document.getElementById("home-screen").classList.remove("hidden")
	document.querySelector(".app-main")?.classList.add("is-home")
	document.getElementById("flow-steps").classList.remove("is-visible")
	updateHeader()
}

/** Go home. */
function goHome(event) {
	if (event) event.preventDefault()
	closeUserMenu()
	showHome()
}

/** Open app. */
function openApp() {
	if (!userId) {
		openAuth("login")
		return
	}
	if (inGame && !gameEnded) {
		showScreen("game-screen")
		if (sessionId) {
			document.getElementById("active-session").classList.remove("hidden")
		}
		updateDeployButton()
		return
	}
	if (teamId) {
		setupTeamUI()
		return
	}
	showScreen("dashboard-screen")
	setupTeamUI()
}

/** Proceed / deploy selected scenario (captain). */
async function proceedToScenario() {
	if (!teamId) {
		setMessage(
			document.getElementById("team-msg"),
			"Join or create a team before proceeding to a scenario.",
			"error",
		)
		return
	}
	if (!isCaptain()) {
		setMessage(
			document.getElementById("team-msg"),
			"Only the team captain can start the scenario.",
			"error",
		)
		return
	}
	if (!selectedScenarioId) {
		setMessage(
			document.getElementById("team-msg"),
			"Select a scenario first.",
			"error",
		)
		return
	}
	await startSession()
}
