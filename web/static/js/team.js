/** Create team. */
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
		teamName = data.team_name || name
		myRole = data.role || "Captain"
		saveTeamState()
		setMessage(msg, "", "")
		setupTeamUI()
	} else {
		setMessage(msg, data.error || "Failed to create team", "error")
	}
}

/** Join team. */
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

	if (data.message && !data.error) {
		teamId = data.team_id || invite
		teamName = data.team_name || "Your team"
		myRole = data.role || "Attacker"
		saveTeamState()
		setMessage(msg, "", "")
		setupTeamUI()
	} else {
		setMessage(msg, data.error || "Failed to join team", "error")
	}
}

/** Configures the team dashboard (no auto-refresh). */
async function setupTeamUI() {
	stopPolling()
	showScreen("dashboard-screen")
	const hasTeam = Boolean(teamId)
	const captain = isCaptain()
	const startGameBtn = document.getElementById("start-game-btn")
	const memberList = document.getElementById("member-list")
	const emptyState = document.getElementById("members-empty")
	const inviteSection = document.getElementById("invite-section")
	const createJoinSection = document.getElementById("create-join-section")
	const inviteCodeBox = document.getElementById("invite-code-box")
	const waitMsg = document.getElementById("wait-msg")
	const refreshBtn = document.getElementById("refresh-btn")
	const scenarioSelector = document.getElementById("scenario-selector")
	const teamHeading = document.getElementById("team-heading")
	const memberBanner = document.getElementById("member-role-banner")
	const dashTitle = document.getElementById("dash-title")
	const dashSub = document.getElementById("dash-sub")

	inviteSection.classList.toggle("hidden", !hasTeam)
	createJoinSection.classList.toggle("hidden", hasTeam)

	if (hasTeam) {
		dashTitle.classList.add("hidden")
		dashSub.classList.add("hidden")
		teamHeading.textContent = teamName || "Your team"
		teamHeading.classList.remove("hidden")
	} else {
		dashTitle.classList.remove("hidden")
		dashSub.classList.remove("hidden")
		dashTitle.textContent = "Assemble your squad"
		teamHeading.textContent = ""
		memberBanner.classList.add("hidden")
	}

	document.getElementById("invite-code").value = hasTeam ? teamId : ""

	if (hasTeam && captain) {
		inviteCodeBox.classList.remove("hidden")
		waitMsg.classList.add("hidden")
		refreshBtn.classList.add("hidden")
		memberBanner.classList.add("hidden")
		scenarioSelector.classList.remove("hidden")
		startGameBtn.classList.remove("hidden")
		updateProceedButton()
		await loadScenarios()
	} else if (hasTeam) {
		inviteCodeBox.classList.add("hidden")
		waitMsg.classList.remove("hidden")
		refreshBtn.classList.remove("hidden")
		memberBanner.classList.remove("hidden")
		scenarioSelector.classList.add("hidden")
		startGameBtn.classList.add("hidden")
	} else {
		inviteCodeBox.classList.add("hidden")
		waitMsg.classList.add("hidden")
		refreshBtn.classList.add("hidden")
		scenarioSelector.classList.add("hidden")
		startGameBtn.classList.add("hidden")
	}

	if (memberList) {
		memberList.innerHTML = ""
		memberList.classList.add("hidden")
	}
	if (emptyState) {
		emptyState.classList.remove("hidden")
		emptyState.innerText = "No members loaded yet. Invite teammates to join."
	}

	updateHeader()
	if (hasTeam) await refreshMembers()
}

/** Load scenarios for captain selector. */
async function loadScenarios() {
	const grid = document.getElementById("scenario-grid")
	const empty = document.getElementById("scenario-empty")
	if (!grid) return

	const data = await apiCall("/api/scenarios", null, "GET")
	scenariosCache = Array.isArray(data) ? data : []
	grid.innerHTML = ""

	if (!scenariosCache.length) {
		empty?.classList.remove("hidden")
		return
	}
	empty?.classList.add("hidden")

	scenariosCache.forEach(scenario => {
		const card = document.createElement("button")
		card.type = "button"
		card.className = "scenario-card"
		card.dataset.scenarioId = scenario.id
		if (scenario.id === selectedScenarioId) card.classList.add("is-selected")

		const meta = difficultyMeta(scenario.difficulty)
		card.innerHTML = `
			<div class="scenario-card-top">
				<strong class="scenario-card-name">${escapeHtml(scenario.name)}</strong>
				${difficultyBadgeHtml(scenario.difficulty)}
			</div>
			<p class="scenario-card-mitre">${escapeHtml(scenario.attack_tactic || "")} · ${escapeHtml(scenario.attack_technique_id || "")}</p>
			<p class="scenario-card-desc">${escapeHtml(scenario.description || "")}</p>
		`
		card.title = meta.label
		card.addEventListener("click", () => selectScenario(scenario.id))
		grid.appendChild(card)
	})
}

/** Select a scenario card. */
function selectScenario(id) {
	selectedScenarioId = id
	scenarioId = id
	document.querySelectorAll(".scenario-card").forEach(card => {
		card.classList.toggle("is-selected", card.dataset.scenarioId === id)
	})
	updateProceedButton()
}

/** Enable/label the proceed button from selection. */
function updateProceedButton() {
	const btn = document.getElementById("start-game-btn")
	if (!btn) return
	const selected = scenariosCache.find(s => s.id === selectedScenarioId)
	if (selected) {
		btn.disabled = false
		btn.dataset.label = `Deploy ${selected.name}`
		btn.innerText = btn.dataset.label
	} else {
		btn.disabled = true
		btn.dataset.label = "Proceed to scenario"
		btn.innerText = btn.dataset.label
	}
}

/** Render members. */
function renderMembers(members) {
	const listEl = document.getElementById("member-list")
	const emptyEl = document.getElementById("members-empty")
	if (!listEl || !emptyEl) return

	listEl.innerHTML = ""
	const items = Array.isArray(members) ? members : []

	if (!items.length) {
		listEl.classList.add("hidden")
		emptyEl.classList.remove("hidden")
		return
	}

	items.forEach(member => {
		const li = document.createElement("li")
		li.className = "member-item"
		const badgeClass =
			member.role === "Captain" ? "badge badge-captain" : "badge badge-attacker"
		const initials = String(member.email || "CR")
			.split(/[@.\s_-]/)
			.filter(Boolean)
			.slice(0, 2)
			.map(part => part[0].toUpperCase())
			.join("")
		li.innerHTML = `<span class="member-identity"><span class="member-avatar" aria-hidden="true">${escapeHtml(initials || "CR")}</span><span class="member-email">${escapeHtml(member.email)}</span></span><span class="${badgeClass}">${escapeHtml(member.role)}</span>`
		listEl.appendChild(li)
	})

	listEl.classList.remove("hidden")
	emptyEl.classList.add("hidden")
}

/** Refresh members. */
async function refreshMembers() {
	if (!teamId) return []
	const members = await apiCall(
		`/api/teams/members?team_id=${teamId}&t=${Date.now()}`,
		null,
		"GET",
	)
	renderMembers(members)
	return Array.isArray(members) ? members : []
}

/** Copies the team's invite code to the clipboard. */
async function copyInviteCode() {
	const btn = document.getElementById("copy-btn")
	try {
		await navigator.clipboard.writeText(teamId)
		btn.innerText = "Copied!"
		setMessage(
			document.getElementById("team-msg"),
			"Invite code copied.",
			"success",
		)
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

/** Leave the current team and return to create/join panels. */
async function leaveTeam() {
	const msg =
		document.getElementById("team-msg") || document.getElementById("game-msg")
	if (!teamId || !userId) {
		clearTeamState()
		hideVictoryModal()
		hideStayTeamModal()
		resetGameState()
		showScreen("dashboard-screen")
		setupTeamUI()
		return
	}

	const data = await apiCall("/api/teams/leave", {
		user_id: userId,
		team_id: teamId,
	})

	hideVictoryModal()
	hideStayTeamModal()
	resetGameState()
	clearTeamState()

	if (data.success === false || data.error) {
		setMessage(msg, data.error || "Failed to leave team", "error")
	}

	document.getElementById("create-join-section")?.classList.remove("hidden")
	document.getElementById("invite-section")?.classList.add("hidden")
	showScreen("dashboard-screen")
	await setupTeamUI()
}

/** Stay in team after ending a scenario. */
function stayInTeam() {
	hideStayTeamModal()
	hideVictoryModal()
	resetGameState()
	selectedScenarioId = ""
	scenarioId = ""
	setupTeamUI()
}

/** Play again after victory — back to team dashboard. */
function playAgain() {
	hideVictoryModal()
	resetGameState()
	selectedScenarioId = ""
	scenarioId = ""
	setupTeamUI()
}
