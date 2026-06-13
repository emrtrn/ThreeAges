# Launch Workflow

## VS Code

- `Ctrl+Shift+B`: opens Project Browser.
- `Terminal > Run Task... > Open Active Project Editor`: opens the editor for the active project.
- `Terminal > Run Task... > Open Runtime Preview`: opens the player-facing preview route.
- `Terminal > Run Task... > Stop Dev Server`: stops port `5173`.

Project Browser includes Browse buttons for New/Open/Package paths. On Windows
these open a native folder picker through the local Vite dev server.

## URLs

- Project Browser: `http://127.0.0.1:5173/`
- Active Project Editor: `http://127.0.0.1:5173/?editor&debug`

## Terminal

```sh
powershell -NoProfile -ExecutionPolicy Bypass -File tools/open-dev-server.ps1 -Mode browser
powershell -NoProfile -ExecutionPolicy Bypass -File tools/open-dev-server.ps1 -Mode editor
```

CLI:

```sh
npm run studio -- new basic-three-project C:\Users\emret\Desktop\my-game
npm run studio -- open C:\Users\emret\Desktop\home-makeover
npm run studio -- package C:\Users\emret\Desktop\home-makeover
```
