import games from "./games.json" with { type: "json" };

const page = document.getElementById("page-container");
const STORAGE_KEY = "jimmyGamesRecentlyPlayed";
const MAX_RECENT = 5;
const MAX_POPULAR = 3;

function getGameKey(game) {
  return game.slug || game.url;
}

async function fetchGlobalPlayCounts() {
  try {
    const response = await fetch("/api/play-count");
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

async function incrementGlobalPlayCount(gameData) {
  try {
    await fetch("/api/play-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameKey: getGameKey(gameData) }),
    });
  } catch (error) {
    console.error("Failed to sync play count to backend server:", error);
  }
}

function getMostPopular(globalCounts) {
  return games
    .filter((game) => (globalCounts[getGameKey(game)] || 0) > 0)
    .sort(
      (a, b) =>
        (globalCounts[getGameKey(b)] || 0) - (globalCounts[getGameKey(a)] || 0),
    )
    .slice(0, MAX_POPULAR);
}

function getRecentlyPlayed() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return saved
      .map((key) => games.find((game) => getGameKey(game) === key))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveRecentlyPlayed(gameData) {
  const key = getGameKey(gameData);
  let recent = getRecentlyPlayed().filter((game) => getGameKey(game) !== key);

  recent.unshift(gameData);
  recent = recent.slice(0, MAX_RECENT);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.map(getGameKey)));
  } catch (error) {
    console.error("Failed to save recently played games:", error);
  }
}

function createGameButton(gameData, index) {
  const btn = document.createElement("button");
  btn.id = `game-${index}`;
  btn.className = "game-card";
  btn.textContent = gameData.name;

  btn.addEventListener("click", async () => {
    await incrementGlobalPlayCount(gameData);
    saveRecentlyPlayed(gameData);
    loadGame(gameData);
  });

  return btn;
}

async function createGameButtons() {
  page.innerHTML = "";

  const globalCounts = await fetchGlobalPlayCounts();

  const gameSection = document.createElement("section");
  gameSection.className = "game-section";

  const heading = document.createElement("h2");
  heading.textContent = "All Games";

  const menu = document.createElement("div");
  menu.id = "game-menu";
  menu.className = "game-grid";

  games.forEach((gameData, index) => {
    menu.appendChild(createGameButton(gameData, index));
  });

  gameSection.append(heading, menu);
  page.appendChild(gameSection);

  const popularGames = getMostPopular(globalCounts);
  if (popularGames.length > 0) {
    const popularSection = document.createElement("section");
    popularSection.className = "game-section";

    const popularHeading = document.createElement("h2");
    popularHeading.textContent = "Most Popular";

    const popularMenu = document.createElement("div");
    popularMenu.className = "game-grid";
    popularMenu.id = "popular-games";

    popularGames.forEach((gameData, index) => {
      popularMenu.appendChild(createGameButton(gameData, `popular-${index}`));
    });

    popularSection.append(popularHeading, popularMenu);
    page.appendChild(popularSection);
  }

  const recentGames = getRecentlyPlayed();
  if (recentGames.length > 0) {
    const recentSection = document.createElement("section");
    recentSection.className = "game-section";

    const recentHeading = document.createElement("h2");
    recentHeading.textContent = "Recently Played";

    const recentMenu = document.createElement("div");
    recentMenu.className = "game-grid";
    recentMenu.id = "recent-games";

    recentGames.forEach((gameData, index) => {
      recentMenu.appendChild(createGameButton(gameData, `recent-${index}`));
    });

    recentSection.append(recentHeading, recentMenu);
    page.appendChild(recentSection);
  }
}

async function loadGame(gameData) {
  page.innerHTML = `
        <div id="loading" style="
            font-family: monospace;
            color: #4AF626;
            text-align: center;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 20px;
            letter-spacing: 1px;
        ">
            Loading ${gameData.name}...
        </div>
    `;

  try {
    const response = await fetch(gameData.url);
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);

    let html = await response.text();
    const baseTag = `<base href="${gameData.url.substring(0, gameData.url.lastIndexOf("/") + 1)}">`;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
    } else {
      html = baseTag + html;
    }

    const blob = new Blob([html], { type: "text/html" });
    const blobURL = URL.createObjectURL(blob);

    page.innerHTML = `
            <button id="back-button" style="
                position: absolute;
                top: 10px;
                left: 10px;
                z-index: 10000;
            ">BACK</button>

            <iframe
                id="game-frame"
                sandbox="allow-scripts allow-same-origin allow-downloads"
                style="
                    width: 100%;
                    height: 100%;
                    border: none;
                    position: absolute;
                    top: 0;
                    left: 0;
                    background: black;
                "
                src="${blobURL}">
            </iframe>
        `;

    document.getElementById("back-button").addEventListener("click", () => {
      URL.revokeObjectURL(blobURL);
      createGameButtons();
    });
  } catch (error) {
    page.innerHTML = `
            <div style="color: red; font-family: monospace;">
                FAILED TO LOAD ${gameData.name.toUpperCase()}<br>
                ${error.message}
                <br><br>
                <button id="retry-button">RETRY</button>
                <button id="back-button">BACK</button>
            </div>
        `;

    document.getElementById("retry-button").addEventListener("click", () => {
      loadGame(gameData);
    });
    document
      .getElementById("back-button")
      .addEventListener("click", createGameButtons);
  }
}

createGameButtons();
