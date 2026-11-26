"use strict";

// The player's DOM is isolated in an opaque-origin iframe. Turn commands are
// accepted only from the embedding page, and no replay text passes in messages.
const CHANNEL = "showdown-demo-replay-v2";
const parentOrigin = new URL(window.location.href).origin;
const source = "https://play.pokemonshowdown.com";
const scripts = [
  "/js/lib/ps-polyfill.js",
  "/config/config.js?a7",
  "/js/lib/jquery-1.11.0.min.js",
  "/js/lib/html-sanitizer-minified.js",
  "/js/battle-sound.js",
  "/js/battledata.js?a7",
  "/js/battle-animations.js?a7",
  "/data/pokedex-mini.js?a7",
  "/data/pokedex-mini-bw.js?a7",
  "/data/graphics.js?a7",
  "/data/pokedex.js?a7",
  "/data/moves.js?a7",
  "/data/abilities.js?a7",
  "/data/items.js?a7",
  "/data/teambuilder-tables.js?a7",
  "/js/battle-tooltips.js?a7",
  "/js/battle.js?a7",
];

const scene = document.getElementById("scene");
const battleFrame = document.getElementById("battle");
const battleLog = document.getElementById("battle-log");
const status = document.getElementById("player-status");
const log = typeof window.SHOWDOWN_PUBLIC_REPLAY === "string" ?
  window.SHOWDOWN_PUBLIC_REPLAY.trimEnd().split("\n") : [];
const cursors = new Map();
log.forEach((line, i) => {
  const turn = /^\|turn\|([1-9][0-9]*)$/.exec(line);
  if (turn) cursors.set(Number(turn[1]), i + 1);
});

let battle = null;
let seekSequence = 0;
let seeking = false;
let seekTimer;

function send(type, properties = {}) {
  window.parent.postMessage({ channel: CHANNEL, type, seq: seekSequence, ...properties }, parentOrigin);
}

function fitScene() {
  scene.style.setProperty("--scene-scale", Math.min(1, scene.clientWidth / 640));
}

function pinAssets() {
  if (window.Dex) {
    window.Dex.resourcePrefix = source + "/";
    window.Dex.fxPrefix = source + "/fx/";
  }
  if (window.Config?.routes) window.Config.routes.client = "play.pokemonshowdown.com";
}

function loadScript(path) {
  return new Promise((resolve, reject) => {
    const element = document.createElement("script");
    const timeout = setTimeout(() => {
      element.remove();
      reject(new Error("Runtime request timed out"));
    }, 12000);
    element.src = source + path;
    element.onload = () => { clearTimeout(timeout); resolve(); };
    element.onerror = () => { clearTimeout(timeout); reject(new Error("Runtime request failed")); };
    document.head.append(element);
  });
}

function update(state) {
  if (!battle || seeking) return;
  if (state === "turn" && cursors.has(battle.turn)) {
    send("turn", { turn: battle.turn, playing: !battle.paused });
  }
  if (state === "playing" || state === "paused" || state === "ended") {
    send("playback", { playing: state === "playing", ended: state === "ended" });
  }
}

function failSeek() {
  clearTimeout(seekTimer);
  seeking = false;
  send("seek-error");
}

function seek(turn, seq) {
  if (!cursors.has(turn) || seq <= seekSequence) return;
  seekSequence = seq;
  clearTimeout(seekTimer);
  seeking = true;
  try {
    battle.pause();
    battle.seekTurn(turn, true);
  } catch (_) {
    failSeek();
    return;
  }
  const deadline = performance.now() + 5000;
  const expected = cursors.get(turn);
  function confirm() {
    if (seekSequence !== seq) return;
    const atBoundary = battle.paused === true && battle.seeking == null &&
      battle.turn === turn && battle.currentStep === expected &&
      battle.stepQueue[expected - 1] === "|turn|" + turn;
    if (atBoundary) {
      seeking = false;
      scene.dataset.turn = String(turn);
      send("positioned", { turn, cursor: expected });
    } else if (performance.now() < deadline) {
      seekTimer = setTimeout(confirm, 16);
    } else {
      failSeek();
    }
  }
  seekTimer = setTimeout(confirm, 0);
}

window.addEventListener("message", (event) => {
  const data = event.data;
  if (event.source !== window.parent || event.origin !== parentOrigin ||
      !data || data.channel !== CHANNEL || !Number.isSafeInteger(data.seq) || !battle) return;
  if (data.type === "seek") seek(data.turn, data.seq);
  if (data.type === "playback" && data.seq === seekSequence && !seeking) {
    if (data.playing === true) battle.play();
    if (data.playing === false) battle.pause();
  }
});

async function start() {
  try {
    if (cursors.size !== 23 || [...cursors.keys()].some((turn, i) => turn !== i + 1)) {
      throw new Error("Replay turn markers invalid");
    }
    window.exports = window;
    for (const path of scripts) {
      await loadScript(path);
      if (path.startsWith("/js/battledata.js")) pinAssets();
    }
    pinAssets();
    battle = new window.Battle({
      id: "showdown-public-demo",
      $frame: window.$(battleFrame),
      $logFrame: window.$(battleLog),
      log,
      isReplay: true,
      paused: true,
      autoresize: true,
    });
    battle.subscribe(update);
    battle.setMute(true);
    fitScene();
    new ResizeObserver(fitScene).observe(scene);
    status.hidden = true;
    send("ready", { turns: cursors.size });
  } catch (_) {
    status.textContent = "动画暂时无法加载。";
    send("error");
  }
}

start();
