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
		myRole = "Captain"
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

	if (data.message) {
		teamId = invite
		myRole = "Attacker"
		setMessage(msg, "", "")
		setupTeamUI()
	} else {
		setMessage(msg, data.error || "Failed to join team", "error")
	}
}

/** Configures the team dashboard and begins lobby updates. */
async function setupTeamUI() {
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

	inviteSection.classList.toggle("hidden", !hasTeam)
	createJoinSection.classList.toggle("hidden", hasTeam)
	document.getElementById("invite-code").value = hasTeam ? teamId : ""
	startGameBtn.disabled = !hasTeam
	startGameBtn.classList.toggle("hidden", !hasTeam || !captain)

	if (hasTeam && captain) {
		inviteCodeBox.classList.remove("hidden")
		waitMsg.classList.add("hidden")
		refreshBtn.classList.add("hidden")
	} else if (hasTeam) {
		inviteCodeBox.classList.add("hidden")
		waitMsg.classList.remove("hidden")
		refreshBtn.classList.remove("hidden")
	} else {
		inviteCodeBox.classList.add("hidden")
		waitMsg.classList.add("hidden")
		refreshBtn.classList.add("hidden")
	}

	if (memberList) {
		memberList.innerHTML = ""
		memberList.classList.add("hidden")
	}
	if (emptyState) {
		emptyState.classList.remove("hidden")
		emptyState.innerText =
			"No members loaded yet. Status refreshes automatically."
	}

	await refreshMembers()
	if (currentGamePhase === "lobby") {
		startPolling(POLL_INTERVAL)
		await pollForUpdates()
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
	const members = await apiCall(
		`/api/teams/members?team_id=${teamId}&t=${Date.now()}`,
		null,
		"GET",
	)
	renderMembers(members)
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
