let userId = ""
let userEmail = ""
let teamId = ""
let teamName = ""
let myRole = ""
let scenarioId = ""
let selectedScenarioId = ""
let scenariosCache = []
let sessionId = ""
let containerId = ""
let terminalSocket = null
let gameEnded = false
let inGame = false
let authMode = "login" // "login" | "register"
let lastResult = null

const COOKIE_NAME = "cyberrange_session"
const COOKIE_DAYS = 7
const LS_HAS_TEAM = "hasTeam"
const LS_ROLE = "role"
const LS_TEAM_ID = "teamId"
const LS_TEAM_NAME = "teamName"

const STEP_MAP = {
	"dashboard-screen": "team",
	"game-screen": "game",
}

const STEP_ORDER = ["team", "game"]

const API_BASE = ""
const FLAG_PREFIX = "CR"

const DIFFICULTY_META = {
	easy: { label: "Easy", emoji: "🟢", className: "diff-easy" },
	medium: { label: "Medium", emoji: "🟡", className: "diff-medium" },
	hard: { label: "Hard", emoji: "🔴", className: "diff-hard" },
	expert: { label: "Expert", emoji: "⚫", className: "diff-expert" },
}

const LOCATION_HINTS = {
	easy: "The flag is stored in a file on this container. Try: cat /flag.txt",
	medium:
		"The flag is protected. You may need elevated access. Check /root/flag.txt",
	hard: "The flag requires exploitation to reach. Lateral movement or privilege escalation may be needed.",
	expert:
		"The flag is hidden using advanced techniques. Memory analysis or multi-stage attacks required.",
}

/** Set message. */
function setMessage(el, text, type) {
	if (!el) return
	el.innerText = text || ""
	el.className = "msg" + (type ? ` msg-${type}` : "")
}

/** Set busy. */
function setBusy(btn, busy, busyLabel) {
	if (!btn) return
	if (!btn.dataset.label) {
		const clone = btn.cloneNode(true)
		clone.querySelector(".btn-spinner")?.remove()
		btn.dataset.label = clone.innerText.trim()
	}
	btn.disabled = !!busy
	const label = busy ? busyLabel || "Working…" : btn.dataset.label
	if (busy && (btn.id === "refresh-btn" || btn.dataset.spinner === "true")) {
		btn.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span>${escapeHtml(label)}`
	} else {
		btn.innerText = label
	}
}

/** Is captain. */
function isCaptain() {
	return String(myRole).trim().toLowerCase() === "captain"
}

/** Persist team membership flags. */
function saveTeamState() {
	if (teamId) {
		localStorage.setItem(LS_HAS_TEAM, "true")
		localStorage.setItem(LS_TEAM_ID, teamId)
		localStorage.setItem(LS_TEAM_NAME, teamName || "")
		localStorage.setItem(
			LS_ROLE,
			isCaptain() ? "captain" : "attacker",
		)
	} else {
		clearTeamState()
	}
}

/** Clear team membership flags. */
function clearTeamState() {
	localStorage.removeItem(LS_HAS_TEAM)
	localStorage.removeItem(LS_ROLE)
	localStorage.removeItem(LS_TEAM_ID)
	localStorage.removeItem(LS_TEAM_NAME)
	teamId = ""
	teamName = ""
	myRole = ""
	selectedScenarioId = ""
	scenarioId = ""
}

/** Restore team membership from localStorage. */
function restoreTeamState() {
	const hasTeam = localStorage.getItem(LS_HAS_TEAM) === "true"
	if (!hasTeam) return false
	teamId = localStorage.getItem(LS_TEAM_ID) || ""
	teamName = localStorage.getItem(LS_TEAM_NAME) || ""
	const role = localStorage.getItem(LS_ROLE) || ""
	myRole = role === "captain" ? "Captain" : role === "attacker" ? "Attacker" : ""
	return Boolean(teamId)
}

/** Difficulty display helpers. */
function difficultyMeta(difficulty) {
	const key = String(difficulty || "easy").toLowerCase()
	return DIFFICULTY_META[key] || DIFFICULTY_META.easy
}

function difficultyBadgeHtml(difficulty) {
	const meta = difficultyMeta(difficulty)
	return `<span class="diff-pill ${meta.className}">${meta.emoji} ${meta.label}</span>`
}

function locationHintFor(difficulty) {
	const key = String(difficulty || "easy").toLowerCase()
	return LOCATION_HINTS[key] || LOCATION_HINTS.easy
}

/** Format seconds as Xm Ys. */
function formatDuration(totalSeconds) {
	const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0))
	const m = Math.floor(sec / 60)
	const s = sec % 60
	return `${m}m ${s}s`
}

function formatClock(iso) {
	if (!iso) return "—"
	try {
		return new Date(iso).toLocaleString()
	} catch (e) {
		return iso
	}
}

/** Update deploy button. */
function updateDeployButton() {
	const deployBtn = document.getElementById("deploy-btn")
	if (!deployBtn) return
	deployBtn.classList.add("hidden")
}

/** Escape html. */
function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}
