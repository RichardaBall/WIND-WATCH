\# Project Architecture \& AI Guidelines



\### Project Overview



A 3D multiplayer offshore helicopter flight simulation game built using Three.js, WebGL, Socket.io, and modular ES JavaScript. The simulation features an orthographic 3D view (`sceneSetup.js`), an offshore main base environment (`mainbase.js`), a Eurocopter Dauphin helicopter player and networked remote peers (`player.js`, `game.js`, `networkManager.js`), dynamic weather and cloud systems (`weatherSystem.js`, `cloudSystem.js`), a day/night cycle (`dayNightCycle.js`), a wind farm (`windfarm.js`), automated aviation searchlights, a navigation radar (`navRadar.js`), a rescue mission and firefighting system (`missionManager.js`), collision detection (`collisionManager.js`), a resource HUD (`hudManager.js`), a modular audio manager (`audioManager.js`), and a developer settings/tutorial interface (`settings.js`).



\### File Structure \& Module Responsibilities



\* \*\*`architecture.md`\*\*: Project documentation mapping file dependencies, system rules, networking protocols, and gameplay specifications.

\* \*\*`index.html`\*\*: Main HTML entry point loading the Three.js canvas, HUD overlay elements, fullscreen controls, and settings toggle.

\* \*\*`main.js`\*\*: Central application bootstrap; instantiates and kicks off the core `Game` loop.

\* \*\*`game.js`\*\*: Core game engine orchestration class; manages clock ticks, scene updates, physics loops, camera tracking, rendering passes, multiplayer client synchronization, and remote entity interpolation.

\* \*\*`networkManager.js`\*\*: Handles real-time Socket.io client communication, server connection lifecycle, remote player joining/leaving events, player state transmissions, and synchronized mission state broadcasts.

\* \*\*`server.js` (Server Module)\*\*: Node.js and Socket.io backend server maintaining authoritative active player states, synchronized world/weather configurations, rotating turbine fire mission states, and progress validation.

\* \*\*`sceneSetup.js`\*\*: Initializes the Three.js core environment (`Scene`, `OrthographicCamera`, `WebGLRenderer`, lighting, fog, and window resize handling).

\* \*\*`player.js`\*\*: Controls `HelicopterPlayer` flight physics, momentum, acceleration, rotor animations, landing gear toggling, fuel consumption, load factors, crash handling, and rescue snorkel states.

\* \*\*`inputManager.js`\*\*: Translates raw mouse and keyboard input into flight target coordinates, camera zoom, engine toggles, gear toggles, and tool selection.

\* \*\*`audioManager.js`\*\*: Manages Web Audio API procedural sound effects (startup, shutdown, gear, low fuel, explosions, thunder, splashes), spatial HRTF-based 3D positional audio for remote player rotors, and continuous noise buffers (rain, wind, water spray, snorkel, rotor sound).

\* \*\*`waterSystem.js`\*\*: Manages the aerial firefighting water/foam drop particle system, volumetric blending, gravitational fall, and ocean splash interactions.

\* \*\*`snorkelSystem.js`\*\*: Manages the underwater water-refill snorkel extension, cable rendering, and rotor wash mist particles.

\* \*\*`weatherSystem.js`\*\*: Controls dynamic weather states (Clear, Rain, Fog, Rain+Fog, Snow, Snow+Fog, Storm), particle precipitation, wind force vectors, lightning flashes, and audio transitions.

\* \*\*`cloudSystem.js`\*\*: Manages a dynamic, seed-driven procedural cloud pool with weather-dependent cloud counts, drift speeds, opacities, and taints.

\* \*\*`dayNightCycle.js`\*\*: Manages the 10-minute celestial cycle, sun and moon orbital positions, ambient/sun light intensities, sky color lerping, and night factor outputs.

\* \*\*`windFarm.js`\*\*: Spawns and animates 3D wind turbine generators featuring rotating blades, aviation obstruction lights, and customizable fire/spark/smoke effects.

\* \*\*`mainbase.js`\*\*: Manages the offshore main base platform model, custom night light maps, animated wave-driven foam particles, landing pad collision volumes, and seasonal/weather texture cross-fading.

\* \*\*`missionManager.js`\*\*: Manages active missions (such as network-synchronized wind turbine firefighting), landing pad aircraft servicing (refueling and water tank refills), and mission completion loops.

\* \*\*`collisionManager.js`\*\*: Handles real-time collision detection between the helicopter player, main base collision cylinders, wind turbine towers, and custom obstacles.

\* \*\*`hudManager.js`\*\*: Renders and updates the glass-aviation resource HUD (fuel gauge, water gauge, interactive engine, landing gear, and tool mode buttons).

\* \*\*`navRadar.js`\*\*: Renders screen-edge directional indicator arrows pointing toward key navigation targets, active missions, and remote players.

\* \*\*`settings.js`\*\*: Manages the tutorial overlay screen and developer settings toggle interface.

\* \*\*`crash.js`\*\*: Manages the aircraft destruction overlay and flight restart flow.



\### Core Controls \& Key Bindings



\* \*\*`\[E]`\*\*: Toggle Engine Ignition / Fuel Cutoff

\* \*\*`\[G]`\*\*: Toggle Landing Gear

\* \*\*`\[1]`\*\*: Select Water Drop Tool Mode

\* \*\*`\[2]`\*\*: Select Water Fill (Snorkel) Tool Mode

\* \*\*`\[Space Bar]`\*\*: Hold to dispense firefighting water spray (when Water tool is active) or toggle snorkel extension (when Snorkel tool is active)

\* \*\*`Mouse Left Click \& Drag`\*\*: Set flight movement target on the ground plane

\* \*\*`Mouse Wheel`\*\*: Adjust camera zoom level (1.0x to 3.0x)

\* \*\*`Top-Left Settings Button`\*\*: Open / Close Tutorial \& Settings Overlay

\* \*\*`Top-Right Fullscreen Button`\*\*: Toggle Fullscreen Mode



\### Multiplayer \& Server Networking Architecture



\* \*\*Client-Server Topologies\*\*: Built on Socket.io, utilizing a centralized Node.js server (`server.js`) paired with the client-side `NetworkManager`.

\* \*\*State Synchronization\*\*:

\* Clients transmit high-frequency position, rotation quaternions, rotor speeds, gear states, snorkel deployments, and firefighting water-drop flags via throttled `player-update` socket events.

\* The server broadcasts authoritative updates (`remote-player-update`, `player-joined`, `player-disconnected`) to synchronize remote peers smoothly with linear interpolation and slerped orientations inside `game.js`.





\* \*\*Procedural Spatial Audio\*\*: Remote helicopter rotor sounds are mapped through Web Audio API positional HRTF panner nodes (`createRemoteRotorSource`, `updateRemoteRotorPosition`), scaling volume inversely with distance.

\* \*\*Cooperative Mission Networking\*\*: Server-managed wind turbine fire states (`wtg-fire-progress`, `wtg-fire-extinguished`, `complete-mission`, `sync-mission`) ensure all connected pilots collaborate on shared firefighting objectives in real time.



\### Key Gameplay \& Simulation Features



\* \*\*Aircraft Model\*\*: Eurocopter Dauphin helicopter sprite sheet animation system with animated rotor blades and responsive momentum-based flight physics.

\* \*\*Environment \& Lighting\*\*: Offshore main base platform equipped with helipads, custom night lighting, and dynamic weather/day-night cycles.

\* \*\*Flight Systems\*\*: Modeled fuel depletion, low-fuel audio warnings, landing gear drag, water tank resource management, and collision detection.

\* \*\*Firefighting \& Rescue Mechanics\*\*: Extinguish wind turbine fires using water drops, refill water tanks using the deployment snorkel at sea level, and service aircraft at designated landing pads.

\* \*\*Modular Architecture\*\*: Cleanly separated ES6 module structure ensuring maintainability and robust performance across rendering, physics, audio, networking, and UI systems.



\---



\### Strict AI Coding Rules



1\. \*\*Full File Outputs Only\*\*: ALWAYS provide complete, ready-to-use updated code files. NEVER use placeholders, truncation, or partial snippets like `// ... rest of code stays the same ...`.

2\. \*\*Strict Modular Isolation\*\*: Keep features in separate modules. Do NOT mix new, unrelated functionality into existing modules. If a requested feature does not cleanly fit into an existing file, instruct me to create a NEW module file and provide that code separately alongside minimal imports.

3\. \*\*Preserve Existing Features\*\*: Do NOT remove or refactor unmentioned game objects, lights, controls, shadow mechanics, or camera lerp systems unless explicitly instructed.

4\. \*\*Maintain Code Cleanliness\*\*: Keep code well-organized, clean, and commented to prevent codebase degradation over time.

5\. \*\*Ask for Missing Code\*\*: If a requested feature requires modifying an existing file and I have not provided that file in the chat, ask me to paste it before generating updated code.

6\. \*\*Scope Isolation \& Zero Unrequested Changes\*\*: Strictly no unprompted edits to working code, key bindings, or core flight mechanics. If a change impacts outside systems, you must explicitly notify me of the side effects before generating code.

7\. \*\*Strict User Code Retention\*\*: When a modification is requested for an existing module file, the AI MUST use the exact user-supplied source code as the baseline. The AI is strictly prohibited from substituting generic or placeholder class implementations when updating code, and must patch or integrate requested additions directly into the user's provided file structure.

8\. \*\*Do not add citations to code\*\*

