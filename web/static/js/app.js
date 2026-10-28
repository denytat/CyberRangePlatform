/** Initializes event handlers and restores the saved session. */
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

	const terminalInput = document.getElementById("terminal-input")
	if (terminalInput) {
		terminalInput.addEventListener("keydown", e => {
			if (e.key === "Enter") {
				e.preventDefault()
				runTerminalCommand()
			}
		})
	}

	document.addEventListener("keydown", e => {
		if (e.key === "Escape") {
			closeAuth()
			closeUserMenu()
		}
	})

	document.addEventListener("click", event => {
		const target = event.target.closest("[data-action], [data-page]")
		if (!target) {
			closeUserMenu()
			return
		}

		if (target.dataset.page) {
			openPlaceholder(event, target.dataset.page)
		} else {
			switch (target.dataset.action) {
				case "home":
					goHome(event)
					break
				case "range":
					openAppFromNav(event)
					break
				case "teams":
					openTeamsFromNav(event)
					break
				case "login":
					openAuth("login")
					break
				case "register":
					openAuth("register")
					break
				case "toggle-user-menu":
					toggleUserMenu(event)
					break
				case "open-app":
					openApp()
					closeUserMenu()
					break
				case "logout":
					logout()
					break
				case "create-team":
					createTeam()
					break
				case "join-team":
					joinTeam()
					break
				case "copy-invite":
					copyInviteCode()
					break
				case "proceed":
					proceedToScenario()
					break
				case "check-status":
					checkGameStatus()
					break
				case "start-session":
					startSession()
					break
				case "submit-flag":
					submitFlag()
					break
				case "run-terminal":
					runTerminalCommand()
					break
				case "end-scenario":
					endScenario()
					break
				case "play-again":
					playAgain()
					break
				case "leave-team":
					leaveTeam()
					break
				case "stay-team":
					stayInTeam()
					break
				case "close-auth":
					closeAuth()
					break
				case "toggle-auth-mode":
					toggleAuthMode()
					break
			}
		}

		if (!target.closest("#user-menu")) closeUserMenu()
	})

	document
		.getElementById("auth-form")
		.addEventListener("submit", handleAuthSubmit)

	restoreFromCookie()
})
