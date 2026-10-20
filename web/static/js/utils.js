let userId = ""
let userEmail = ""
let teamId = ""
let myRole = ""
let scenarioId = "550e8400-e29b-41d4-a716-446655440000"
let sessionId = ""
let containerId = ""
let terminalSocket = null
let gameEnded = false
let inGame = false
let authMode = "login" // "login" | "register"

const COOKIE_NAME = "cyberrange_session"
const COOKIE_DAYS = 7

const STEP_MAP = {
	"dashboard-screen": "team",
	"game-screen": "game",
}

const STEP_ORDER = ["team", "game"]


const API_BASE = ""
const POLL_INTERVAL = 5000
const FLAG_PREFIX = "CR"

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
		btn.dataset.label = btn.innerText.trim()
	}
	btn.disabled = !!busy
	btn.innerText = busy ? busyLabel || "Working…" : btn.dataset.label
}

/** Is captain. */
function isCaptain() {
	return String(myRole).trim().toLowerCase() === "captain"
}

/** Update deploy button. */
function updateDeployButton() {
	const deployBtn = document.getElementById("deploy-btn")
	if (!deployBtn) return
	deployBtn.classList.toggle("hidden", !isCaptain() || inGame || gameEnded)
}

/** Escape html. */
function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
}
