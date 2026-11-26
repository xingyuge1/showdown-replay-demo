"use strict";

const byId = (id) => document.getElementById(id);
const demo = window.BATTLE_DEMO;
const notice = byId("notice");
const workspace = byId("workspace");
const slider = byId("turn-slider");
const chart = byId("curve");
const pen = chart.getContext("2d");
const play = byId("play");
const previous = byId("previous");
const next = byId("next");
const reset = byId("reset");
const events = byId("events");
const matchup = byId("matchup");
const turnFormatter = new Intl.NumberFormat("zh-CN");
const percentage = new Intl.NumberFormat("zh-CN", {
  style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1,
});

let turns = [];
let index = 0;
let timer = null;
let area = null;

function isProbability(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function hasValidTurns(data) {
  return data && Array.isArray(data.turns) && data.turns.length > 1 &&
    data.turns.every((item, i) => item.turn === i + 1 && Array.isArray(item.events) &&
      Array.isArray(item.sides) && item.sides.length === 2 &&
      (item.p === null || isProbability(item.p)));
}

function trace(points) {
  points.forEach(({ x, y }, i) => {
    if (i === 0) pen.moveTo(x, y);
    else pen.lineTo(x, y);
  });
}

function paintRun(points, bottom, fill) {
  if (points.length === 0) return;
  if (points.length > 1) {
    pen.beginPath();
    trace(points);
    pen.lineTo(points.at(-1).x, bottom);
    pen.lineTo(points[0].x, bottom);
    pen.closePath();
    pen.fillStyle = fill;
    pen.fill();
    pen.beginPath();
    trace(points);
    pen.strokeStyle = "#2b6b55";
    pen.lineWidth = 2.5;
    pen.lineJoin = "round";
    pen.stroke();
  }
  pen.fillStyle = "#2b6b55";
  for (const { x, y } of points) {
    pen.beginPath();
    pen.arc(x, y, 2.5, 0, Math.PI * 2);
    pen.fill();
  }
}

function paintChart() {
  const w = chart.clientWidth;
  const h = chart.clientHeight;
  if (!w || !h || !pen) return;
  const dpr = window.devicePixelRatio || 1;
  const pixelW = Math.round(w * dpr);
  const pixelH = Math.round(h * dpr);
  if (chart.width !== pixelW || chart.height !== pixelH) {
    chart.width = pixelW;
    chart.height = pixelH;
  }
  pen.setTransform(pixelW / w, 0, 0, pixelH / h, 0, 0);
  pen.clearRect(0, 0, w, h);
  const left = 52;
  const right = w - 19;
  const top = 21;
  const bottom = h - 29;
  const x = (i) => left + i * (right - left) / (turns.length - 1);
  const y = (p) => bottom - p * (bottom - top);
  area = { left, right };
  pen.font = '12px "Segoe UI", sans-serif';
  pen.textBaseline = "middle";
  pen.textAlign = "right";
  pen.lineWidth = 1;
  for (const value of [0, 25, 50, 75, 100]) {
    const gy = y(value / 100);
    pen.strokeStyle = value === 50 ? "#b7c8b8" : "#dde6db";
    pen.setLineDash(value === 50 ? [4, 5] : []);
    pen.beginPath();
    pen.moveTo(left, gy);
    pen.lineTo(right, gy);
    pen.stroke();
    pen.fillStyle = "#546457";
    pen.fillText(value + "%", left - 8, gy);
  }
  pen.setLineDash([]);
  const ticks = Math.min(turns.length, w < 410 ? 5 : 7);
  pen.textAlign = "center";
  for (let tick = 0; tick < ticks; tick++) {
    const i = Math.round(tick * (turns.length - 1) / (ticks - 1));
    pen.fillText(turnFormatter.format(turns[i].turn), x(i), h - 13);
  }
  const fill = pen.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, "#91c0a87d");
  fill.addColorStop(1, "#cce8c626");
  let run = [];
  turns.forEach(({ p }, i) => {
    if (isProbability(p)) run.push({ x: x(i), y: y(p) });
    else {
      paintRun(run, bottom, fill);
      run = [];
    }
  });
  paintRun(run, bottom, fill);

  const selected = turns[index];
  const selectedX = x(index);
  pen.strokeStyle = "#93601e";
  pen.lineWidth = 1.5;
  pen.setLineDash([4, 4]);
  pen.beginPath();
  pen.moveTo(selectedX, top);
  pen.lineTo(selectedX, bottom);
  pen.stroke();
  pen.setLineDash([]);
  if (isProbability(selected.p)) {
    pen.beginPath();
    pen.arc(selectedX, y(selected.p), 6, 0, Math.PI * 2);
    pen.fillStyle = "#8c5819";
    pen.fill();
    pen.strokeStyle = "#fdfcf5";
    pen.lineWidth = 2;
    pen.stroke();
  }
}

function makeSide(name, sideIndex) {
  const card = document.createElement("div");
  card.className = sideIndex === 0 ? "side" : "side opponent";
  const label = document.createElement("span");
  label.textContent = sideIndex === 0 ? "模型方" : "对手方";
  const species = document.createElement("strong");
  species.textContent = name || "—";
  card.append(label, species);
  return card;
}

function makeEvent(event) {
  const row = document.createElement("li");
  row.className = "event";
  const kind = document.createElement("span");
  kind.className = "event-kind";
  kind.textContent = event.kind;
  const description = document.createElement("span");
  description.textContent = event.text;
  row.append(kind, description);
  return row;
}

function showTurn(newIndex, announce = true) {
  index = Math.min(turns.length - 1, Math.max(0, newIndex));
  const item = turns[index];
  const label = "第 " + item.turn + " 回合";
  const probability = isProbability(item.p) ? percentage.format(item.p) : "缺失";
  byId("probability").textContent = probability;
  byId("probability-turn").textContent = label;
  byId("replay-turn").textContent = label;
  byId("turn-counter").value = item.turn + " / " + turns.length;
  slider.value = String(item.turn);
  slider.setAttribute("aria-valuetext", label + "，预测胜率 " + probability);
  previous.disabled = reset.disabled = index === 0;
  next.disabled = index === turns.length - 1;
  matchup.replaceChildren(...item.sides.map(makeSide));
  events.replaceChildren(...item.events.map(makeEvent));
  if (item.events.length === 0) {
    const row = document.createElement("li");
    row.className = "empty-event";
    row.textContent = "本回合没有展示的事件。";
    events.append(row);
  }
  events.scrollTop = 0;
  if (announce) byId("selected-status").textContent = label + "，预测胜率 " + probability;
  paintChart();
}

function pausePlayback() {
  if (timer === null) return;
  window.clearInterval(timer);
  timer = null;
  play.textContent = "播放";
  play.setAttribute("aria-pressed", "false");
}

function togglePlayback() {
  if (timer !== null) {
    pausePlayback();
    return;
  }
  if (index === turns.length - 1) showTurn(0);
  play.textContent = "暂停";
  play.setAttribute("aria-pressed", "true");
  timer = window.setInterval(() => {
    showTurn(index + 1, false);
    if (index === turns.length - 1) {
      pausePlayback();
      byId("selected-status").textContent = "已播放至最后一回合。";
    }
  }, 1400);
}

function seek(newIndex) {
  pausePlayback();
  showTurn(newIndex);
}

function prepareOfficialReplay(url) {
  const official = byId("official");
  const animation = byId("animation");
  const container = byId("animation-content");
  official.href = url;
  official.hidden = false;
  animation.hidden = false;
  animation.addEventListener("toggle", () => {
    if (!animation.open || container.firstChild) return;
    const frame = document.createElement("iframe");
    frame.title = "Pokémon Showdown 官方动画回放";
    frame.referrerPolicy = "no-referrer";
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
    frame.src = url;
    container.append(frame);
  });
}

function start() {
  if (!hasValidTurns(demo)) {
    notice.textContent = "示例对局载入失败。请刷新页面后重试。";
    return;
  }
  turns = demo.turns;
  if (typeof demo.replayUrl === "string" &&
      /^https:\/\/replay\.pokemonshowdown\.com\/gen9ou-\d+$/.test(demo.replayUrl)) {
    prepareOfficialReplay(demo.replayUrl);
  }
  byId("sample-label").textContent = demo.label;
  byId("total").textContent = turns.length + " 回合";
  byId("result").textContent = "终局 " + demo.result;
  byId("source-note").textContent = demo.sourceNote;
  slider.max = String(turns.length);
  play.addEventListener("click", togglePlayback);
  previous.addEventListener("click", () => seek(index - 1));
  next.addEventListener("click", () => seek(index + 1));
  reset.addEventListener("click", () => seek(0));
  slider.addEventListener("input", () => seek(Number(slider.value) - 1));
  chart.addEventListener("click", (event) => {
    if (!area) return;
    const px = event.clientX - chart.getBoundingClientRect().left;
    const fraction = (px - area.left) / (area.right - area.left);
    seek(Math.round(fraction * (turns.length - 1)));
  });
  new ResizeObserver(paintChart).observe(chart);
  notice.hidden = true;
  workspace.hidden = false;
  showTurn(0, false);
}

start();
