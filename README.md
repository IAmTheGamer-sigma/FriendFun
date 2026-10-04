# FriendFun

A Roblox-style game platform that runs in the browser. It's built with Node.js, Express, WebSockets and Three.js. Every asset is procedural or original.

## Features
- **Accounts**: sign up, log in, and earn FunTix (the in-game currency: daily rewards, playtime, coins, and wins)
- **Home / Discover**: browse and search experiences, rate them, add favorites, and see visit and player counts
- **Avatar editor**: a blocky 3D avatar with body colors, head shapes, hats, faces, and shirts
- **FunTix Leaderboard**: the top 50 players ranked by FunTix, plus your own rank
- **Marketplace**: buy avatar items with FunTix
- **Friends and profiles**: friend requests, bios, online/in-game status, and creations
- **Play**: multiplayer 3D worlds with a third-person camera, chat bubbles, a leaderboard, coins, checkpoints, kill bricks, bounce and speed pads, and win pads
- **FriendFun Studio**: edit worlds (insert, move, scale, color, materials, undo/redo), playtest them, and publish
- Starter experiences: Baseplate, Mega Fun Obby, Hangout Town, Tower Climb, and Coin Islands

## Run
```bash
npm install
npm start   # http://localhost:3000  (PORT env to override)
```
Data is saved to `data/db.json`. The file is created when the server first runs.

## Controls
Desktop: WASD/arrows to move · Space to jump · right-drag to orbit the camera · wheel to zoom · `/` to chat · Esc for the menu · R to reset

Mobile: on-screen thumbstick to move · jump button · drag to look · pinch to zoom (toggle under Esc → Touch controls)
