const $ = id => document.getElementById(id);

const randomNames = [
  "Dr. Vatson", "Sherlok", "Kardiolojist", "Bio-Detektiv", 
  "Revmatolog", "Lab-Master", "Pulsar", "Doktor House", 
  "Alfa-Detektiv", "Sinaps"
];

let playerName = "";
let currentRoom = "";
let roomPlayers = []; 
let broadcastChannel = null;

let stage = 0, score = 0, time = 90, timer;
let stageScores = [0, 0, 0];
let answers = {}, selected = null, finished = false;

const missions = [
  {
    title: "Dalillarni bog‘la",
    instruction: "Marker va uning vazifasini moslashtiring.",
    type: "match",
    left: [
      ["CRP", "C-reaktiv oqsil"],
      ["ASO", "Antistreptolizin O"],
      ["RF", "Revmatoid faktor"],
      ["ECHT", "Eritrotsitlar cho‘kish tezligi"]
    ],
    right: [
      ["A", "Yallig‘lanish bilan bog‘liq marker"],
      ["B", "Streptokokk bilan uchrashuvga ishora qilishi mumkin"],
      ["C", "Ayrim revmatik kasalliklarda uchraydigan autoantitana"],
      ["D", "Yallig‘lanishning nospetsifik ko‘rsatkichi"]
    ],
    key: { CRP: "A", ASO: "B", RF: "C", ECHT: "D" }
  },
  {
    title: "Dalillarni guruhla",
    instruction: "Elementni tanlang, so‘ng tegishli guruhni bosing.",
    type: "sort",
    items: [
      ["CRP", "inflam"], ["ECHT", "inflam"],
      ["ASO", "strep"], ["Anti-DNase B", "strep"],
      ["RF", "auto"], ["Anti-CCP", "auto"]
    ]
  },
  {
    title: "Detektiv xulosasi",
    instruction: "Har bir vaziyat uchun eng mantiqli xulosani tanlang.",
    type: "case",
    cases: [
      {
        q: "ASO yuqori chiqdi. Eng asosli xulosa qaysi?",
        a: [
          "Streptokokk bilan yaqinda yoki avval uchrashuv bo‘lgan bo‘lishi mumkin",
          "Revmatoid artrit aniq tasdiqlandi",
          "Buyraklar sog‘lomligi isbotlandi"
        ], key: 0
      },
      {
        q: "CRP yuqori. Bu nimani anglatishi mumkin?",
        a: [
          "Faqat bitta aniq kasallik bor",
          "Yallig‘lanish bo‘lishi mumkin; sababini qo‘shimcha baholash kerak",
          "Infeksiya yo‘qligi aniq"
        ], key: 1
      },
      {
        q: "RF musbat natija berdi. To‘g‘ri yondashuv qaysi?",
        a: [
          "Darhol aniq tashxis qo‘yish",
          "Natijani alomatlar va boshqa tekshiruvlar bilan birga baholash",
          "Bu faqat sog‘lom odamlarda uchraydi"
        ], key: 1
      },
      {
        q: "ECHT yuqori. Bu ko‘rsatkich nospetsifik bo‘lsa, nima qilish kerak?",
        a: [
          "Boshqa ma’lumotlar bilan birga baholash",
          "Muayyan kasallik aniq tasdiqlandi deyish",
          "Boshqa tekshiruvlarni e’tiborsiz qoldirish"
        ], key: 0
      }
    ]
  }
];

window.addEventListener("DOMContentLoaded", () => {
  $("randomNickBtn").addEventListener("click", () => {
    const rName = randomNames[Math.floor(Math.random() * randomNames.length)];
    const rNum = Math.floor(Math.random() * 900) + 100;
    $("playerNickname").value = `${rName}_${rNum}`;
  });

  $("showCreateModalBtn").addEventListener("click", () => {
    if (!checkNickname()) return;
    $("createRoomModal").classList.remove("hidden");
  });

  $("closeCreateModal").addEventListener("click", () => {
    $("createRoomModal").classList.add("hidden");
  });

  $("showJoinModalBtn").addEventListener("click", () => {
    if (!checkNickname()) return;
    $("joinRoomModal").classList.remove("hidden");
  });

  $("closeJoinModal").addEventListener("click", () => {
    $("joinRoomModal").classList.add("hidden");
  });

  $("randomCodeBtn").addEventListener("click", () => {
    const code = Math.floor(1000 + Math.random() * 9000);
    $("newRoomCode").value = code;
  });

  $("confirmCreateRoom").addEventListener("click", () => {
    const code = $("newRoomCode").value.trim();
    if (!code) {
      alert("Iltimos, xona kodini kiriting yoki Random tugmasini bosing!");
      return;
    }
    currentRoom = code;
    $("createRoomModal").classList.add("hidden");
    openWaitingRoom();
  });

  $("confirmJoinRoom").addEventListener("click", () => {
    const code = $("enterRoomCode").value.trim();
    if (!code) {
      alert("Iltimos, xona kodini kiriting!");
      return;
    }
    currentRoom = code;
    $("joinRoomModal").classList.add("hidden");
    openWaitingRoom();
  });

  $("startMultiGameBtn").addEventListener("click", () => {
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'START_GAME' });
    }
    startRealGame();
  });
});

function checkNickname() {
  const nick = $("playerNickname").value.trim();
  if (!nick) {
    alert("Iltimos, oldin o'zingizga nik kiriting yoki Random ism tanlang!");
    return false;
  }
  playerName = nick;
  return true;
}

function openWaitingRoom() {
  $("room-menu").classList.add("hidden");
  $("waiting-room").classList.remove("hidden");
  $("lobbyRoomCode").textContent = currentRoom;

  if (broadcastChannel) broadcastChannel.close();

  // Brauzer tablararo real ulanish uchun kanal ochamiz (botlar yo'q!)
  broadcastChannel = new BroadcastChannel('revmolab_room_' + currentRoom);

  roomPlayers = [playerName];
  updatePlayerListUI();

  // Boshqalarga qo'shilganimizni bildiramiz
  broadcastChannel.postMessage({ type: 'JOIN', player: playerName });

  broadcastChannel.onmessage = (event) => {
    const data = event.data;
    if (data.type === 'JOIN') {
      if (!roomPlayers.includes(data.player)) {
        roomPlayers.push(data.player);
        updatePlayerListUI();
      }
      broadcastChannel.postMessage({ type: 'SYNC', players: roomPlayers });
    } else if (data.type === 'SYNC') {
      data.players.forEach(p => {
        if (!roomPlayers.includes(p)) {
          roomPlayers.push(p);
        }
      });
      updatePlayerListUI();
    } else if (data.type === 'START_GAME') {
      startRealGame();
    }
  };
}

function updatePlayerListUI() {
  const listEl = $("playerList");
  listEl.innerHTML = roomPlayers.map(p => `<li>👤 ${p} ${p === playerName ? "(Siz)" : ""}</li>`).join("");
  
  const statusEl = $("waitingStatus");
  const startBtn = $("startMultiGameBtn");

  if (roomPlayers.length >= 2) {
    statusEl.textContent = `Yetarli o'yinchilar yig'ildi (${roomPlayers.length} kishi)! O'yinni boshlashingiz mumkin.`;
    statusEl.style.color = "var(--mint)";
    startBtn.disabled = false;
    startBtn.style.opacity = "1";
    startBtn.style.cursor = "pointer";
  } else {
    statusEl.textContent = `O'yin boshlanishi uchun yana kamida ${2 - roomPlayers.length} kishi kerak... Kutilmoqda.`;
    statusEl.style.color = "#ffb74d";
    startBtn.disabled = true;
    startBtn.style.opacity = "0.5";
    startBtn.style.cursor = "not-allowed";
  }
}

function leaveLobby() {
  if (broadcastChannel) broadcastChannel.close();
  $("waiting-room").classList.add("hidden");
  $("room-menu").classList.remove("hidden");
}

function resetToMenu() {
  clearInterval(timer);
  if (broadcastChannel) broadcastChannel.close();
  $("game").classList.add("hidden");
  $("result").classList.add("hidden");
  $("waiting-room").classList.add("hidden");
  $("room-menu").classList.remove("hidden");
}

function startRealGame() {
  $("waiting-room").classList.add("hidden");
  $("game").classList.remove("hidden");
  startGameEngine();
}

function startGameEngine() {
  clearInterval(timer);
  stage = 0;
  score = 0;
  stageScores = [0, 0, 0];
  render();
}

function render() {
  clearInterval(timer);
  time = 90;
  answers = {};
  selected = null;
  finished = false;

  const m = missions[stage];
  $("title").textContent = m.title;
  $("mission").textContent = `XONA: ${currentRoom} | MISSIYA ${stage + 1} / 3 (${playerName})`;
  $("stage").textContent = `BOSQICH ${stage + 1}`;
  $("instruction").textContent = m.instruction;
  $("time").textContent = time;
  $("score").textContent = score;
  $("bar").style.width = `${(stage / 3) * 100}%`;
  $("feedback").textContent = "";
  $("check").textContent = "JAVOBNI TEKSHIRISH →";
  $("check").onclick = checkAnswer;

  if (m.type === "match") renderMatch(m);
  if (m.type === "sort") renderSort(m);
  if (m.type === "case") renderCases(m);

  timer = setInterval(() => {
    time--;
    $("time").textContent = time;
    if (time <= 0) {
      clearInterval(timer);
      checkAnswer();
    }
  }, 1000);
}

function renderMatch(m) {
  $("board").innerHTML = `
    <div class="grid">
      <div><p class="eyebrow">MARKERLAR</p>
        ${m.left.map(([k, v]) =>
          `<button class="choice" data-left="${k}">${k} —${v}</button>`
        ).join("")}
      </div>
      <div><p class="eyebrow">DALILLAR</p>
        ${[...m.right].sort(() => Math.random() - 0.5).map(([k, v]) =>
          `<button class="choice" data-right="${k}">${k} —${v}</button>`
        ).join("")}
      </div>
    </div>`;

  document.querySelectorAll("[data-left]").forEach(btn => {
    btn.onclick = () => {
      if (finished) return;
      selected = btn.dataset.left;
      document.querySelectorAll("[data-left]").forEach(x =>
        x.classList.toggle("selected", x === btn)
      );
      $("feedback").textContent = `${selected} tanlandi. Mos dalilni bosing.`;
    };
  });

  document.querySelectorAll("[data-right]").forEach(btn => {
    btn.onclick = () => {
      if (finished || !selected) return;
      answers[selected] = btn.dataset.right;
      btn.classList.add("selected");
      btn.disabled = true;

      const left = document.querySelector(`[data-left="${selected}"]`);
      if (left) {
        left.classList.add("correct");
        left.disabled = true;
      }

      selected = null;
      $("feedback").textContent = "Juftlik saqlandi.";
    };
  });
}

function renderSort(m) {
  $("board").innerHTML = `
    <div class="grid">
      <div><p class="eyebrow">DALILLAR</p>
        ${m.items.map(([k]) =>
          `<button class="choice" data-item="${k}">${k}</button>`
        ).join("")}
      </div>
      <div>
        <p class="eyebrow">GURUHLAR</p>
        <div class="case bin" data-bin="inflam"><b>🟢 Yallig‘lanish markerlari</b><div></div></div>
        <div class="case bin" data-bin="strep"><b>🔵 Streptokokk bilan bog‘liq</b><div></div></div>
        <div class="case bin" data-bin="auto"><b>🟣 Autoantitanalar</b><div></div></div>
      </div>
    </div>`;

  document.querySelectorAll("[data-item]").forEach(btn => {
    btn.onclick = () => {
      if (finished) return;
      selected = btn.dataset.item;
      document.querySelectorAll("[data-item]").forEach(x =>
        x.classList.toggle("selected", x === btn)
      );
      $("feedback").textContent = `${selected} tanlandi. Endi guruhni bosing.`;
    };
  });

  document.querySelectorAll("[data-bin]").forEach(bin => {
    bin.onclick = () => {
      if (finished || !selected) return;
      answers[selected] = bin.dataset.bin;

      const source = document.querySelector(`[data-item="${selected}"]`);
      if (source) {
        source.disabled = true;
        source.classList.add("correct");
      }

      const chip = document.createElement("p");
      chip.textContent = selected;
      chip.style.color = "#65f4c5";
      chip.style.margin = "4px 0";
      bin.querySelector("div").appendChild(chip);

      selected = null;
      $("feedback").textContent = "Dalil guruhlandi.";
    };
  });
}

function renderCases(m) {
  $("board").innerHTML = m.cases.map((c, i) => `
    <div class="case">
      <p><b>VAZIYAT ${i + 1}.</b> ${c.q}</p>
      ${c.a.map((text, j) => `
        <label><input type="radio" name="case${i}" value="${j}"> ${text}</label>
      `).join("")}
    </div>
  `).join("");
}

function checkAnswer() {
  if (finished) return;
  finished = true;
  clearInterval(timer);

  const m = missions[stage];
  let correct = 0, total = 0;

  if (m.type === "match") {
    total = 4;
    for (const k in m.key) if (answers[k] === m.key[k]) correct++;
  } else if (m.type === "sort") {
    total = 6;
    m.items.forEach(([k, v]) => {
      if (answers[k] === v) correct++;
    });
  } else {
    total = m.cases.length;
    m.cases.forEach((c, i) => {
      const chosen = document.querySelector(`input[name="case${i}"]:checked`);
      if (chosen && Number(chosen.value) === c.key) correct++;
    });
  }

  const points = Math.round((correct / total) * 80) + Math.round((time / 90) * 20);
  stageScores[stage] = points;
  score += points;
  $("score").textContent = score;
  $("feedback").textContent = `To‘g‘ri javoblar: ${correct}/${total}. Ball: ${points}.`;
  $("bar").style.width = `${((stage + 1) / 3) * 100}%`;
  $("check").textContent = stage < 2 ? "KEYINGI MISSIYA →" : "NATIJANI KO‘RISH →";
  $("check").onclick = () => {
    if (stage < 2) {
      stage++;
      render();
    } else {
      showResult();
    }
  };
}

function showResult() {
  $("game").classList.add("hidden");
  $("result").classList.remove("hidden");
  $("finalScore").textContent = score;
  $("resultNick").textContent = playerName;
  $("resultRoom").textContent = currentRoom;
  $("resultTitle").textContent =
    score >= 240 ? "Laboratoriya ustasi!" :
    score >= 160 ? "Yaxshi ish, detektiv!" : "Yana bir bor urinib ko‘ring!";

  $("details").innerHTML = stageScores.map((v, i) =>
    `<div><b>${v}</b><small> MISSIYA ${i + 1}</small></div>`
  ).join("");
}