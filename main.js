// ==========================================
// 1. UI 요소 및 변수 선언
// ==========================================
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const canvas = document.getElementById('game-canvas');
const cameraModeText = document.getElementById('camera-mode-text');
const powerBarContainer = document.getElementById('power-bar-container');
const powerBar = document.getElementById('power-bar');
const playerHpBar = document.getElementById('player-hp');
const dummyHpBar = document.getElementById('dummy-hp');
const roundTitleText = document.getElementById('round-title');
const downCountText = document.getElementById('down-count');
const roundMessageText = document.getElementById('round-message');

const setScoreText = document.getElementById('set-score') 
                   || document.getElementById('score') 
                   || document.getElementById('set-score-text')
                   || document.getElementById('round-score');

const upgradeScreen = document.getElementById('upgrade-screen');
const upgradeContainer = document.getElementById('upgrade-container');
const playerUpgradesContainer = document.getElementById('player-upgrades');
const dummyUpgradesContainer = document.getElementById('dummy-upgrades');
const upgradeTooltip = document.getElementById('upgrade-tooltip');

const defenseBtnIndicator = document.getElementById('defense-btn-indicator');
const defenseCdText = document.getElementById('defense-cd-text');
const defenseCdBar = document.getElementById('defense-cd-bar');

let ammoContainerUI = null;
let ammoTextUI = null;
let reloadBarUI = null;

const matchResultScreen = document.getElementById('match-result-screen');
const matchResultTitle = document.getElementById('match-result-title');
const matchResultScore = document.getElementById('match-result-score') || document.getElementById('result-score');
const lobbyReturnBtn = document.getElementById('lobby-return-btn');

// ==========================================
// 2. Socket.IO 네트워크 및 멀티플레이 변수
// ==========================================
let socket = null;
let isMultiplayer = false;
let isHost = false;
let currentRoomId = null;

let remoteShieldMesh = null;
let remoteElectricMesh = null;
let dummyBody = null;

let playerUpgrades = [];
let dummyUpgrades = [];

let maxAmmo = 5;
let currentAmmo = 5;
let baseReloadDuration = 0.3;
let reloadDuration = 0.3;
let isReloading = false;
let reloadTimer = 0;

let shootCooldownDuration = 0.4;
let shootCooldownTimer = 0;

let isKnockbackArrow = false;
let isPrecisionShot = false;

let poisonTimer = 0;
let poisonTicksLeft = 0;
let playerPoisonTimer = 0;
let playerPoisonTicksLeft = 0;

// Audio
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
let drawOsc = null, drawGain = null;

function startDrawSound() {
    initAudio(); if (!audioCtx) return;
    drawOsc = audioCtx.createOscillator();
    drawGain = audioCtx.createGain();
    drawOsc.type = 'sawtooth';
    drawOsc.frequency.setValueAtTime(80, audioCtx.currentTime);
    drawOsc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 1.2);
    drawGain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    drawGain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.3);
    drawOsc.connect(drawGain); drawGain.connect(audioCtx.destination);
    drawOsc.start();
}

function stopDrawSound() {
    if (drawGain && audioCtx) {
        drawGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        setTimeout(() => { if (drawOsc) { drawOsc.stop(); drawOsc.disconnect(); drawOsc = null; } }, 50);
    }
}

function playShootSound() {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.12);
}

function playHitSound(isTarget = true) {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = isTarget ? 'square' : 'sine';
    osc.frequency.setValueAtTime(isTarget ? 300 : 120, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(isTarget ? 80 : 40, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.15);
}

function playJumpSound(isClimb = false) {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isClimb ? 180 : 130, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, audioCtx.currentTime + (isClimb ? 0.08 : 0.15));
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (isClimb ? 0.08 : 0.15));
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + (isClimb ? 0.08 : 0.15));
}

function playDefenseSound(type = 'shield') {
    initAudio(); if (!audioCtx) return;
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    if (type === 'shield') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.2);
    } else if (type === 'reflect') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.3);
    }
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.3);
}

// 3D 변수
let scene, camera, renderer;
let player, playerBody, aimPivot;
let bowVisual, bowString, nockedArrow;
let isFirstPerson = false;
let clock = new THREE.Clock();
let is3DInitialized = false;

let currentMapGroup = null;
let mapObstacles = [];

let playerWins = 0;
let opponentWins = 0;
const targetWins = 5;
let isPlayerDowned = false;

let currentRound = 1;
let dummyDownCount = 0;
let playerDownCount = 0;
let isRoundEnding = false;
let isMatchEnded = false;

let statAtkMulti = 1.0;
let statSpeedMulti = 1.0;
let statChargeMulti = 1.0;
let isDoubleShot = false;
let isTripleShot = false;
let isPoisonArrow = false;
let isExplosiveArrow = false;
let isHomingArrow = false;
let arrowScale = 1.0;
let heavyGravityMulti = 1.0;

// 최대 체력 시스템 (기존엔 hp가 항상 100 고정이라 "체력 +X%" 카드가 실제로 작동하지 않았음)
let maxPlayerHp = 100;

// 명중효과 계열 신규 카드
let isLeechArrow = false;
const LEECH_RATIO = 0.4;
let isTimedDetonation = false;
const TIMED_DETONATION_DAMAGE = 35;
const TIMED_DETONATION_DELAY = 0.5;
let isGrowingArrow = false;
const GROWING_MAX_BONUS = 1.5; // 최대 +150%
const GROWING_TIME_TO_MAX = 1.8; // 이 시간(초)만큼 날아가면 최대 보너스 도달

let isBouncyArrow = false;
const BOUNCE_COUNT = 2;
const BOUNCE_RESTITUTION = 0.8; // 튕길 때마다 속도를 20%씩 잃는다

let isTrickster = false;
const TRICKSTER_DMG_PER_BOUNCE = 0.8; // 튕길 때마다 피해 +80% 중첩

// 스탯 계열 신규 카드
let requiresFullChargeToShoot = false; // WIND UP: 완전 차징 전엔 발사 자체가 안 됨
let explosiveRequiresFullCharge = false; // EXPLOSIVE ARROW: 완전 차징 시에만 폭발 발동

// 조건부/유니크 계열 신규 카드
let hasPhoenix = false;
let phoenixUsed = false;
let isBrawler = false;
let brawlerTimer = 0;
const BRAWLER_DURATION = 3.0;
const BRAWLER_DMG_REDUCTION = 0.66;
let isChase = false;
let isTasteOfBlood = false;
let tasteOfBloodTimer = 0;
const TASTE_OF_BLOOD_DURATION = 3.0;
const TASTE_OF_BLOOD_SPEED_BONUS = 0.5;
let isGlassCannon = false;
let isPristine = false;

// 방어 계열 신규 카드
let isTacticalReloadDefense = false;

const DEFENSE_DURATION = 1.0;
const DEFENSE_COOLDOWN = 8.0;

let isDefending = false;
let defenseTimer = 0;
let defenseCooldownTimer = 0;
let defenseBlockedArrow = false;

let isShockwaveDefense = false;
let isElectricDefense = false;
let isExplosiveDefense = false;
let isReflectDefense = false;
let isHealDefense = false;

let defenseShieldMesh = null;
let electricAuraMesh = null;
let electricTimer = 0;
let electricTickTimer = 0; // 전격 방어 피해 틱 간격 (버그 수정: 기존엔 electricTimer가 감소하지 않았음)
const ELECTRIC_TICK_INTERVAL = 0.5; // 0.5초마다 한 번 피해
const ELECTRIC_TICK_DAMAGE = 8;
const ELECTRIC_RADIUS = 4.0;

const KNOCKBACK_DISTANCE = 3.0; // 넉백 화살 명중 시 밀려나는 거리
const POISON_TICK_COUNT = 3;    // 독화살 도트 틱 횟수
const POISON_TICK_INTERVAL = 1.0; // 독화살 틱 간격(초)
const POISON_TICK_DAMAGE = 6;

// 라운즈(Rounds) 스타일 업그레이드 풀.
// category: projectile | onhit | defense | stat | conditional
// rarity: common | uncommon | rare
// deferred: true인 카드는 아직 구현 전이라 실제 게임 내 선택지에는 노출하지 않는다 (3차 후순위 작업)
const upgradePool = [
    // ── 발사체 (10) ──────────────────────────────
    { id: 'twin_shot', icon: '🏹', title: 'TWIN SHOT', effect: '화살 2발을 0.12초 간격으로 연속 발사', tradeoff: '발당 피해 -35%, 재장전 +0.3s', category: 'projectile', rarity: 'common' },
    { id: 'triple_volley', icon: '🔱', title: 'TRIPLE VOLLEY', effect: '화살 3발을 넓은 부채꼴로 동시 발사', tradeoff: '발당 피해 -55%, 재장전 +0.4s, 최대 화살 +5', category: 'projectile', rarity: 'uncommon' },
    { id: 'barrage', icon: '🌪️', title: 'BARRAGE', effect: '마우스를 누르고 있으면 0.1초마다 자동 연사, 최대 화살 +5', tradeoff: '발당 피해 -70%, 재장전 +0.3s', category: 'projectile', rarity: 'rare', deferred: true },
    { id: 'big_arrow', icon: '🌲', title: 'BIG ARROW', effect: '화살 크기/판정 +80%', tradeoff: '재장전 +0.25s, 화살 속도 -15%', category: 'projectile', rarity: 'common' },
    { id: 'homing', icon: '🧲', title: 'HOMING', effect: '조준 중인 대상을 향해 화살이 서서히 유도됨', tradeoff: '피해 -30%, 차징 속도 -35%', category: 'projectile', rarity: 'uncommon' },
    { id: 'drill_arrow', icon: '🕳️', title: 'DRILL ARROW', effect: '장애물을 관통해서 날아감', tradeoff: '재장전 +0.3s, 피해 -15%', category: 'projectile', rarity: 'rare', deferred: true },
    { id: 'growing_arrow', icon: '📈', title: 'GROWING ARROW', effect: '날아간 시간에 비례해 피해량이 최대 +150%까지 증가', tradeoff: '기본 피해 -40%, 화살 속도 -20%', category: 'projectile', rarity: 'uncommon' },
    { id: 'bouncy_arrow', icon: '🎾', title: 'BOUNCY ARROW', effect: '화살이 벽/바닥에 2회까지 튕겨나감', tradeoff: '피해 -25%, 재장전 +0.25s', category: 'projectile', rarity: 'rare' },
    { id: 'trickster', icon: '🃏', title: 'TRICKSTER', effect: '화살이 튕길 때마다 피해 +80% 중첩, 튕기기 횟수 +1', tradeoff: '기본 피해 -30%, 재장전 +0.5s', category: 'projectile', rarity: 'rare' },
    { id: 'guided_arrow', icon: '🎮', title: 'GUIDED ARROW', effect: '발사 후 마우스로 화살 방향을 직접 조종 가능', tradeoff: '화살 속도 -40%, 재장전 +0.3s', category: 'projectile', rarity: 'rare', deferred: true },

    // ── 명중효과 (8) ──────────────────────────────
    { id: 'poison_arrow', icon: '☠️', title: 'POISON ARROW', effect: '명중 시 3초간 초당 8데미지 도트', tradeoff: '기본 피해 -40%', category: 'onhit', rarity: 'common' },
    { id: 'explosive_arrow', icon: '💥', title: 'EXPLOSIVE ARROW', effect: '완전히 당긴 화살이 명중하면 고정 +50 폭발피해 추가', tradeoff: '완전 차징 시에만 발동, 재장전 +0.25s', category: 'onhit', rarity: 'uncommon' },
    { id: 'thruster_arrow', icon: '🔥', title: 'THRUSTER ARROW', effect: '명중 시 상대를 강하게 밀쳐냄', tradeoff: '피해 -20%', category: 'onhit', rarity: 'common' },
    { id: 'leech_arrow', icon: '🩸', title: 'LEECH ARROW', effect: '입힌 피해량의 40%만큼 체력 회복', tradeoff: '피해 -15%', category: 'onhit', rarity: 'uncommon' },
    { id: 'timed_detonation', icon: '⏱️', title: 'TIMED DETONATION', effect: '명중 후 0.5초 뒤 +35 고정 추가 폭발피해', tradeoff: '기본 피해 -20%', category: 'onhit', rarity: 'common' },
    { id: 'toxic_cloud', icon: '☁️', title: 'TOXIC CLOUD', effect: '명중 지점에 독구름 생성 (3초간 지속피해+슬로우)', tradeoff: '차징 속도 -30%, 재장전 +0.3s', category: 'onhit', rarity: 'rare', deferred: true },
    { id: 'hunter_arrow', icon: '🎯', title: 'HUNTER ARROW', effect: '빗나간 화살이 근처의 보이는 상대를 향해 다시 튕겨서 추적', tradeoff: '피해 -30%, 재장전 +0.25s', category: 'onhit', rarity: 'uncommon', deferred: true },
    { id: 'decay_arrow', icon: '⌛', title: 'DECAY ARROW', effect: '입힌 피해를 상대가 4초에 걸쳐 나눠서 받음', tradeoff: '즉발 피해 임팩트 감소', category: 'onhit', rarity: 'rare', deferred: true },

    // ── 방어 (8) ──────────────────────────────
    { id: 'def_shockwave', icon: '💨', title: 'SHOCKWAVE', effect: '방어 시 강한 넉백 충격파', tradeoff: '체력 +40%, 방어 쿨타임 +0.3s', category: 'defense', rarity: 'uncommon' },
    { id: 'def_electric', icon: '⚡', title: 'ELECTRIC FIELD', effect: '방어 중 3초간 주변에 지속 전격 피해', tradeoff: '체력 +30%, 방어 쿨타임 +0.3s', category: 'defense', rarity: 'uncommon' },
    { id: 'def_explosive', icon: '💣', title: 'BOMBS AWAY', effect: '방어 종료 시 범위 폭발', tradeoff: '체력 +30%, 방어 쿨타임 +0.3s', category: 'defense', rarity: 'uncommon' },
    { id: 'def_reflect', icon: '↩️', title: 'REFLECT', effect: '막아낸 화살을 상대에게 그대로 반사', tradeoff: '방어 쿨타임 +0.4s', category: 'defense', rarity: 'rare' },
    { id: 'def_heal', icon: '💖', title: 'HEALING FIELD', effect: '방어 사용 시 체력 25% 즉시 회복', tradeoff: '체력 +20%, 방어 쿨타임 +0.25s', category: 'defense', rarity: 'common' },
    { id: 'def_teleport', icon: '🌀', title: 'TELEPORT', effect: '방어 시 짧은 순간이동으로 회피, 장애물 통과 가능', tradeoff: '방어 쿨타임 -30%', category: 'defense', rarity: 'rare', deferred: true },
    { id: 'def_silence', icon: '🔇', title: 'SILENCE', effect: '방어 성공 시 상대의 다음 발사를 0.5초간 봉인', tradeoff: '체력 +25%, 방어 쿨타임 +0.25s', category: 'defense', rarity: 'rare', deferred: true },
    { id: 'def_tactical_reload', icon: '🔄', title: 'TACTICAL RELOAD', effect: '방어 사용 시 화살을 전량 즉시 재장전', tradeoff: '방어 쿨타임 +0.25s', category: 'defense', rarity: 'rare' },

    // ── 패시브 스탯 (8) ──────────────────────────────
    { id: 'power', icon: '💪', title: 'POWER', effect: '피해량 +75%', tradeoff: '화살 속도 -20%, 재장전 +0.25s', category: 'stat', rarity: 'common' },
    { id: 'careful_planning', icon: '🧠', title: 'CAREFUL PLANNING', effect: '피해량 +120%', tradeoff: '차징 속도 -60%, 재장전 +0.5s', category: 'stat', rarity: 'uncommon' },
    { id: 'fastball', icon: '⚾', title: 'FASTBALL', effect: '화살 속도 +150%, 피해량 +15%', tradeoff: '차징 속도 -40%, 재장전 +0.25s', category: 'stat', rarity: 'uncommon' },
    { id: 'steady_shot', icon: '🎯', title: 'STEADY SHOT', effect: '체력 +40%, 화살 속도 +60%', tradeoff: '재장전 +0.25s', category: 'stat', rarity: 'common' },
    { id: 'quick_reload', icon: '⏩', title: 'QUICK RELOAD', effect: '재장전 시간 -70%', tradeoff: '최대 화살 -3', category: 'stat', rarity: 'uncommon' },
    { id: 'tank', icon: '🛡️', title: 'TANK', effect: '체력 +100%', tradeoff: '차징 속도 -25%, 재장전 +0.5s', category: 'stat', rarity: 'common' },
    { id: 'huge', icon: '🐘', title: 'HUGE', effect: '체력 +80%', tradeoff: '없음', category: 'stat', rarity: 'common' },
    { id: 'wind_up', icon: '🌀', title: 'WIND UP', effect: '화살 속도 +100%, 피해 +60%', tradeoff: '완전 차징 전엔 발사 불가, 재장전 +0.5s', category: 'stat', rarity: 'common' },

    // ── 조건부/유니크 (6) ──────────────────────────────
    { id: 'phoenix', icon: '🔥', title: 'PHOENIX', effect: '이번 매치에서 다운 1회를 무효화하고 즉시 부활', tradeoff: '체력 -35%', category: 'conditional', rarity: 'rare' },
    { id: 'brawler', icon: '🥊', title: 'BRAWLER', effect: '명중 성공 후 3초간 받는 피해 66% 감소', tradeoff: '없음', category: 'conditional', rarity: 'uncommon' },
    { id: 'chase', icon: '🏃', title: 'CHASE', effect: '상대를 바라보며 다가갈 때 이동속도 +60%', tradeoff: '체력 +30% (보너스)', category: 'conditional', rarity: 'uncommon' },
    { id: 'taste_of_blood', icon: '🧛', title: 'TASTE OF BLOOD', effect: '명중 성공 후 3초간 이동속도 +50%', tradeoff: '흡혈 +30% (보너스)', category: 'conditional', rarity: 'uncommon' },
    { id: 'glass_cannon', icon: '💎', title: 'GLASS CANNON', effect: '피해량 +100%', tradeoff: '최대 체력이 1로 고정됨 (한 방에 다운 위험)', category: 'conditional', rarity: 'rare' },
    { id: 'pristine', icon: '🕊️', title: 'PRISTINE PERSEVERANCE', effect: '체력 90% 이상일 때 받는 피해 -75%', tradeoff: '없음', category: 'conditional', rarity: 'rare' }
];

let playerHp = 100;
let dummyHp = 100;
let dummyMaxHp = 100; // 상대의 실제 최대체력. 이전엔 항상 100으로 가정해서 체력 카드로 상대 maxHp가 달라지면 체력바가 잘못 표시됐다.
let dummyTarget;

const keys = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, Space: false };
let yaw = 0, pitch = 0;
const moveSpeed = 9;
let playerVelocityY = 0;
let isGrounded = true;
const jumpPower = 8;
let climbSoundCooldown = 0;

let isCharging = false;
let chargePower = 0;
const maxCharge = 100;
let arrows = [];
const gravity = 18;

// ==========================================
// 3. 로비 UI 단일화 및 Socket.IO 바인딩
// ==========================================
function setupLobbyUI() {
    if (!lobbyScreen) return;
    lobbyScreen.innerHTML = `
        <h1 style="font-size: 32px; margin-bottom: 8px;">Archery IO (Multiplayer)</h1>
        <p style="color: #ccc; margin-bottom: 24px;">빠른 매칭으로 모르는 사람과 대전하거나 방을 만들어 친구를 초대하세요!</p>
        
        <div style="max-width: 320px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px;">
            <button id="btn-fast-match" style="padding: 14px; font-size: 16px; font-weight: bold; background: #2a9d8f; color: white; border: none; border-radius: 8px; cursor: pointer;">⚡ 빠른 매칭 (랜덤 대전)</button>
            <button id="btn-create-room" style="padding: 12px; font-size: 15px; background: #e76f51; color: white; border: none; border-radius: 8px; cursor: pointer;">🏠 비밀방 만들기 (Host)</button>
            
            <div style="display: flex; gap: 6px; margin-top: 8px;">
                <input type="text" id="input-room-code" placeholder="방 코드 입력" style="flex: 1; padding: 10px; border-radius: 6px; border: 1px solid #555; text-align: center; text-transform: uppercase;">
                <button id="btn-join-room" style="padding: 10px 16px; background: #264653; color: white; border: none; border-radius: 6px; cursor: pointer;">🔑 접속</button>
            </div>
            
            <button id="btn-single-play" style="padding: 10px; background: #457b9d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">🤖 AI 싱글 플레이</button>
            
            <div id="lobby-status" style="min-height: 24px; color: #e9c46a; font-weight: bold; font-size: 14px; margin-top: 10px;"></div>
        </div>
    `;

    document.getElementById('btn-fast-match')?.addEventListener('click', requestFastMatch);
    document.getElementById('btn-create-room')?.addEventListener('click', createPrivateRoom);
    document.getElementById('btn-join-room')?.addEventListener('click', joinPrivateRoom);
    document.getElementById('btn-single-play')?.addEventListener('click', startSinglePlayer);
}

function setLobbyStatus(msg, showCancel = false) {
    const statusEl = document.getElementById('lobby-status');
    if (!statusEl) return;

    if (showCancel) {
        statusEl.innerHTML = `${msg} <button id="btn-cancel-match" style="margin-left: 8px; padding: 4px 8px; background: #d90429; color: white; border: none; border-radius: 4px; cursor: pointer;">취소</button>`;
        document.getElementById('btn-cancel-match')?.addEventListener('click', cancelMatch);
    } else {
        statusEl.innerText = msg;
    }
}

function initSocketEvents() {
    if (socket) return;
    socket = io();

    socket.on('waitingForMatch', () => {
        setLobbyStatus("상대 플레이어를 찾는 중...", true);
    });

    socket.on('matchCancelled', () => {
        setLobbyStatus("매칭이 취소되었습니다.");
    });

    socket.on('roomCreated', (roomId) => {
        currentRoomId = roomId;
        setLobbyStatus(`방 생성 완료! 코드: [ ${roomId} ] (상대 대기 중...)`);
    });

    socket.on('roomError', (msg) => {
        setLobbyStatus(msg);
    });

    socket.on('gameStarted', (data) => {
        isMultiplayer = true;
        isHost = data.isHost;
        currentRoomId = data.roomId;
        setLobbyStatus("매칭 성공! 게임을 시작합니다.");

        setTimeout(() => {
            startNewGame();
        }, 500);
    });

    socket.on('opponentMovement', (data) => {
        if (dummyTarget) {
            dummyTarget.position.set(data.x, data.y, data.z);
            dummyTarget.rotation.y = data.yaw;

            // 서버의 downed 상태를 기준으로 상대 캐릭터 표시 여부를 항상 동기화한다.
            // 이전 라운드에서 visible=false가 남아 있어도 다음 정상 상태 패킷에서 자동 복구된다.
            dummyTarget.visible = data.downed !== true;

            if (remoteShieldMesh) remoteShieldMesh.visible = !!data.def && data.downed !== true;
            if (remoteElectricMesh) remoteElectricMesh.visible = !!data.elec && data.downed !== true;
            if (Number.isFinite(Number(data.hp))) {
                dummyHp = Number(data.hp);
                if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
            }
        }
    });

    socket.on('opponentShot', (data) => {
        createRemoteArrow(data);
    });

    // 상대의 SHOCKWAVE 등에 의해 밀려났을 때, 내 위치는 내 클라이언트가 직접 옮겨야 진짜로 반영된다.
    socket.on('forceApplied', (data) => {
        if (!player || isMatchEnded || isPlayerDowned) return;
        const dir = new THREE.Vector3(Number(data?.dir?.x) || 0, Number(data?.dir?.y) || 0, Number(data?.dir?.z) || 0);
        if (dir.lengthSq() < 1e-6) return;
        const force = Number.isFinite(Number(data?.force)) ? Number(data.force) : 3.0;
        player.position.addScaledVector(dir, force);
    });

    socket.on('mapSync', (mapIndex) => {
        loadRandomMap(mapIndex);
    });

    socket.on('opponentUpgrade', (upg) => {
        dummyUpgrades.push(upg);
        renderUpgradeIcons(dummyUpgradesContainer, dummyUpgrades);

        // 상대의 최대체력도 함께 추적한다 (서버의 HP_MULTIPLIER_BY_UPGRADE와 동일한 배율).
        // 이걸 안 하면 상대가 체력 카드를 먹었을 때 상대 체력바가 실제 비율과 다르게 표시된다.
        const HP_MULTIPLIER_BY_UPGRADE = {
            def_shockwave: 1.4, def_electric: 1.3, def_explosive: 1.3, def_heal: 1.2,
            steady_shot: 1.4, tank: 2.0, huge: 1.8, chase: 1.3, phoenix: 0.65
        };
        if (HP_MULTIPLIER_BY_UPGRADE[upg.id] !== undefined) {
            dummyMaxHp *= HP_MULTIPLIER_BY_UPGRADE[upg.id];
        }
        if (upg.id === 'glass_cannon') {
            dummyMaxHp = 1;
        }
    });

    // [추가됨] 서버로부터 데미지 수신 이벤트 처리 (발사자 중심 판정 연동)
    socket.on('hitConfirmed', (data) => {
        // 서버가 실제로 명중을 승인했으므로 상대 HP를 서버 값으로 즉시 반영한다.
        if (Number.isFinite(Number(data?.targetHp))) {
            dummyHp = Math.max(0, Number(data.targetHp));
            if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
        }
        console.debug(`[HIT CONFIRMED] ${data?.damage ?? 0} damage, target HP ${data?.targetHp ?? '?'}`);
    });

    socket.on('hitBlocked', (data) => {
        playHitSound(false);
        console.debug(`[HIT BLOCKED] ${data?.damage ?? 0} damage blocked by defense`);
    });

    socket.on('opponentHealthSync', (data) => {
        if (Number.isFinite(Number(data?.hp))) {
            dummyHp = Math.max(0, Number(data.hp));
            if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
        }
    });

    socket.on('takeDamage', (data) => {
        // 서버가 이미 방어 판정을 끝낸 뒤 보내는 이벤트이므로
        // 여기서 isDefending을 확인해 데미지를 무시하면 안 된다.
        playHitSound(true);
        playerHp = Math.max(0, Number.isFinite(Number(data?.hp)) ? Number(data.hp) : playerHp - Number(data?.damage || 0));
        if (playerHpBar) playerHpBar.style.width = `${(playerHp / maxPlayerHp) * 100}%`;

        if (playerBody && playerBody.material) {
            playerBody.material.color.setHex(0xff0000);
            setTimeout(() => playerBody.material.color.setHex(0x0077b6), 100);
        }

        if (playerHp <= 0) onLocalPlayerKilled();
    });

    socket.on('playerDown', (data) => {
        if (data?.loserId === socket.id) {
            isPlayerDowned = true;
            playerHp = 0;
            if (playerHpBar) playerHpBar.style.width = '0%';
            clearArrows();
            isDefending = false;
            defenseTimer = 0;
            if (defenseShieldMesh) defenseShieldMesh.visible = false;
        } else {
            dummyHp = 0;
            if (dummyHpBar) dummyHpBar.style.width = '0%';
            if (dummyTarget) dummyTarget.visible = false;
            if (remoteShieldMesh) remoteShieldMesh.visible = false;
            if (remoteElectricMesh) remoteElectricMesh.visible = false;
        }
    });

    socket.on('playerRespawned', (data) => {
        const isMeTheLoser = data?.loserId === socket.id;

        // 다운됐던 사람 처리
        if (isMeTheLoser) {
            isPlayerDowned = false;
            playerHp = maxPlayerHp;
            if (playerHpBar) playerHpBar.style.width = '100%';
            resetPositions();
            clearArrows();
        } else {
            dummyHp = dummyMaxHp;
            if (dummyHpBar) dummyHpBar.style.width = '100%';
            if (dummyTarget) {
                dummyTarget.visible = true;
                resetPositions();
            }
        }

        // 상대방(승자) 쪽도 체력을 함께 회복시킨다 - 다운된 사람만 풀피가 되고
        // 상대는 이전 체력 그대로 남아있던 불공평한 상황을 고치기 위함.
        if (isMeTheLoser) {
            dummyHp = dummyMaxHp;
            if (dummyHpBar) dummyHpBar.style.width = '100%';
        } else {
            playerHp = maxPlayerHp;
            if (playerHpBar) playerHpBar.style.width = '100%';
        }
    });

    socket.on('roundEnded', (data) => {
        if (data.result === 'win') {
            playerWins = data.myScore;
            opponentWins = data.oppScore;
            updateScoreboard();
            endRound("ROUND WIN!", false);
        } else {
            playerWins = data.oppScore;
            opponentWins = data.myScore;
            updateScoreboard();
            endRound("ROUND LOSE!", true);
        }
    });

    socket.on('startNewRound', () => {
        resetRound();
    });

    socket.on('matchEnded', (data) => {
        if (data.result === 'win') {
            playerWins = data.myScore;
            opponentWins = data.oppScore;
            endMatch(true);
        } else {
            playerWins = data.oppScore;
            opponentWins = data.myScore;
            endMatch(false);
        }
    });

    socket.on('opponentDisconnected', () => {
        alert("상대방의 접속이 끊어졌습니다.");
        returnToLobby();
    });
}

function requestFastMatch() {
    initSocketEvents();
    socket.emit('findMatch');
}

function cancelMatch() {
    if (socket) socket.emit('cancelMatch');
}

function createPrivateRoom() {
    initSocketEvents();
    socket.emit('createRoom');
}

function joinPrivateRoom() {
    const codeInput = document.getElementById('input-room-code');
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

    if (!code) {
        alert("방 코드를 입력해주세요.");
        return;
    }

    initSocketEvents();
    socket.emit('joinRoom', code);
}

function startSinglePlayer() {
    isMultiplayer = false;
    isHost = true;
    startNewGame();
}

document.addEventListener('DOMContentLoaded', () => {
    setupLobbyUI();
});

lobbyReturnBtn?.addEventListener('click', returnToLobby);

// ==========================================
// 4. 게임 핵심 시스템 및 메커니즘
// ==========================================
function createAmmoUI() {
    if (document.getElementById('ammo-container')) return;

    ammoContainerUI = document.createElement('div');
    ammoContainerUI.id = 'ammo-container';
    ammoContainerUI.style.cssText = `
        position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.6); padding: 8px 16px; border-radius: 8px;
        color: white; font-family: sans-serif; text-align: center; pointer-events: none;
        z-index: 10; border: 1px solid rgba(255,255,255,0.2);
    `;

    ammoTextUI = document.createElement('div');
    ammoTextUI.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 4px;';
    ammoContainerUI.appendChild(ammoTextUI);

    const reloadBarBG = document.createElement('div');
    reloadBarBG.style.cssText = 'width: 120px; height: 6px; background: #444; border-radius: 3px; overflow: hidden; margin: 0 auto;';

    reloadBarUI = document.createElement('div');
    reloadBarUI.style.cssText = 'width: 0%; height: 100%; background: #ffb703; transition: width 0.05s linear;';
    reloadBarBG.appendChild(reloadBarUI);
    ammoContainerUI.appendChild(reloadBarBG);

    gameScreen.appendChild(ammoContainerUI);
    updateAmmoUI();
}

function updateAmmoUI() {
    if (!ammoTextUI) return;
    if (isReloading) {
        ammoTextUI.innerText = `RELOADING...`;
        ammoTextUI.style.color = '#ff4d4d';
    } else {
        ammoTextUI.innerText = `🏹 화살 ${currentAmmo} / ${maxAmmo} (R: 재장전)`;
        ammoTextUI.style.color = currentAmmo === 0 ? '#ff4d4d' : '#ffffff';
        if (reloadBarUI) reloadBarUI.style.width = '0%';
    }
}

function renderUpgradeIcons(container, upgrades) {
    if (!container) return;
    container.innerHTML = '';

    upgrades.forEach(upg => {
        const badge = document.createElement('div');
        badge.className = 'upgrade-badge';
        badge.innerText = upg.icon;

        badge.addEventListener('mouseenter', (e) => {
            if (!upgradeTooltip) return;
            upgradeTooltip.innerHTML = `
                <div class="tooltip-title">${upg.icon} ${upg.title}</div>
                <div class="tooltip-desc">${upg.effect}</div>
                ${upg.tradeoff && upg.tradeoff !== '없음' ? `<div class="tooltip-desc" style="color:#ff6b6b; margin-top:4px;">대가: ${upg.tradeoff}</div>` : ''}
            `;
            upgradeTooltip.style.display = 'block';
            updateTooltipPosition(e);
        });

        badge.addEventListener('mousemove', (e) => {
            updateTooltipPosition(e);
        });

        badge.addEventListener('mouseleave', () => {
            if (upgradeTooltip) upgradeTooltip.style.display = 'none';
        });

        container.appendChild(badge);
    });
}

function updateTooltipPosition(e) {
    if (!upgradeTooltip) return;
    upgradeTooltip.style.left = `${e.clientX + 12}px`;
    upgradeTooltip.style.top = `${e.clientY + 12}px`;
}

function resetPositions() {
    if (player) {
        if (isMultiplayer && !isHost) {
            player.position.set(0, 1, -24);
            yaw = Math.PI;
        } else {
            player.position.set(0, 1, 24);
            yaw = 0;
        }
        pitch = 0;
        playerVelocityY = 0;
    }
    if (dummyTarget) {
        if (isMultiplayer && !isHost) {
            dummyTarget.position.set(0, 1, 24);
        } else {
            dummyTarget.position.set(0, 1, -24);
        }
    }
}

function startNewGame() {
    initAudio();
    playerWins = 0;
    opponentWins = 0;
    currentRound = 1;
    dummyDownCount = 0;
    playerDownCount = 0;
    isMatchEnded = false;
    isRoundEnding = false;

    maxAmmo = 5;
    currentAmmo = maxAmmo;
    reloadDuration = baseReloadDuration;
    isReloading = false;
    reloadTimer = 0;
    shootCooldownTimer = 0;
    isKnockbackArrow = false;
    isPrecisionShot = false;

    poisonTicksLeft = 0;
    poisonTimer = 0;
    playerPoisonTicksLeft = 0;
    playerPoisonTimer = 0;

    playerUpgrades = [];
    dummyUpgrades = [];
    renderUpgradeIcons(playerUpgradesContainer, playerUpgrades);
    renderUpgradeIcons(dummyUpgradesContainer, dummyUpgrades);

    maxPlayerHp = 100;
    playerHp = 100;
    dummyMaxHp = 100;
    dummyHp = 100;
    if (playerHpBar) playerHpBar.style.width = '100%';
    if (dummyHpBar) dummyHpBar.style.width = '100%';

    statAtkMulti = 1.0;
    statSpeedMulti = 1.0;
    statChargeMulti = 1.0;
    isDoubleShot = false;
    isTripleShot = false;
    isPoisonArrow = false;
    isExplosiveArrow = false;
    isHomingArrow = false;
    arrowScale = 1.0;
    heavyGravityMulti = 1.0;

    isLeechArrow = false;
    isTimedDetonation = false;
    isGrowingArrow = false;
    isBouncyArrow = false;
    isTrickster = false;
    requiresFullChargeToShoot = false;
    explosiveRequiresFullCharge = false;
    isTacticalReloadDefense = false;

    hasPhoenix = false;
    phoenixUsed = false;
    isBrawler = false;
    brawlerTimer = 0;
    isChase = false;
    isTasteOfBlood = false;
    tasteOfBloodTimer = 0;
    isGlassCannon = false;
    isPristine = false;

    isShockwaveDefense = false;
    isElectricDefense = false;
    isExplosiveDefense = false;
    isReflectDefense = false;
    isHealDefense = false;
    isDefending = false;
    defenseTimer = 0;
    defenseCooldownTimer = 0;
    electricTimer = 0;
    electricTickTimer = 0;

    clearArrows();
    updateScoreboard();

    if (lobbyScreen) lobbyScreen.classList.remove('active');
    if (matchResultScreen) matchResultScreen.style.display = 'none';
    if (upgradeScreen) upgradeScreen.style.display = 'none';
    if (gameScreen) gameScreen.classList.add('active');

    createAmmoUI();

    if (!is3DInitialized) {
        init3D();
        is3DInitialized = true;
    }

    createDummyTarget();
    resetPositions();
    loadRandomMap();
    canvas.requestPointerLock();
}

function returnToLobby() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    isMultiplayer = false;

    if (gameScreen) gameScreen.classList.remove('active');
    if (matchResultScreen) matchResultScreen.style.display = 'none';
    if (upgradeScreen) upgradeScreen.style.display = 'none';
    if (lobbyScreen) lobbyScreen.classList.add('active');
    setupLobbyUI();
    document.exitPointerLock();
}

function clearArrows() {
    for (let a of arrows) {
        scene.remove(a.mesh);
    }
    arrows = [];
}

function updateScoreboard() {
    if (setScoreText) setScoreText.innerText = `나 ${playerWins} : ${opponentWins} 상대 (9판 5선승)`;
    if (roundTitleText) roundTitleText.innerText = `ROUND ${currentRound}`;
    if (downCountText) downCountText.innerText = `상대 다운: ${dummyDownCount} / 2`;
}

// ==========================================
// 5. 3D Scene 구성 및 맵 생성
// ==========================================
function init3D() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
    scene.add(grid);

    player = new THREE.Group();
    scene.add(player);

    const playerGeo = new THREE.BoxGeometry(1, 2, 1);
    const playerMat = new THREE.MeshLambertMaterial({ color: 0x0077b6 });
    playerBody = new THREE.Mesh(playerGeo, playerMat);
    player.add(playerBody);

    const shieldGeo = new THREE.SphereGeometry(1.6, 24, 24);
    const shieldMat = new THREE.MeshLambertMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.45, wireframe: true });
    defenseShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    defenseShieldMesh.visible = false;
    player.add(defenseShieldMesh);

    const electricGeo = new THREE.IcosahedronGeometry(1.9, 1);
    const electricMat = new THREE.MeshBasicMaterial({ color: 0xffe600, wireframe: true });
    electricAuraMesh = new THREE.Mesh(electricGeo, electricMat);
    electricAuraMesh.visible = false;
    player.add(electricAuraMesh);

    aimPivot = new THREE.Group();
    aimPivot.position.set(0.35, 0.3, -0.2);
    player.add(aimPivot);

    createBow();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function createDummyTarget() {
    if (dummyTarget) scene.remove(dummyTarget);

    if (isMultiplayer) {
        dummyTarget = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(1, 2, 1);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd90429 });
        dummyBody = new THREE.Mesh(bodyGeo, bodyMat);
        dummyTarget.add(dummyBody);

        const shieldGeo = new THREE.SphereGeometry(1.6, 24, 24);
        const shieldMat = new THREE.MeshLambertMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.45, wireframe: true });
        remoteShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
        remoteShieldMesh.visible = false;
        dummyTarget.add(remoteShieldMesh);

        const electricGeo = new THREE.IcosahedronGeometry(1.9, 1);
        const electricMat = new THREE.MeshBasicMaterial({ color: 0xffe600, wireframe: true });
        remoteElectricMesh = new THREE.Mesh(electricGeo, electricMat);
        remoteElectricMesh.visible = false;
        dummyTarget.add(remoteElectricMesh);

        dummyTarget.position.set(0, 1, -24);
    } else {
        const dummyGeo = new THREE.CylinderGeometry(0.8, 0.8, 2.5, 16);
        const dummyMat = new THREE.MeshLambertMaterial({ color: 0xd90429 });
        dummyTarget = new THREE.Mesh(dummyGeo, dummyMat);
        dummyBody = dummyTarget;
        dummyTarget.position.set(0, 1.25, -24);
    }
    scene.add(dummyTarget);
}

function createMap1() {
    const mapGroup = new THREE.Group();
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x7f7f7f });
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
    const brickMat = new THREE.MeshLambertMaterial({ color: 0x9e472a });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 60), floorMat);
    floor.position.set(0, -0.1, 0);
    mapGroup.add(floor);

    const wallHeight = 6, wallThick = 1;
    const wallData = [
        { w: 40, h: wallHeight, d: wallThick, x: 0, y: wallHeight / 2, z: -30 },
        { w: 40, h: wallHeight, d: wallThick, x: 0, y: wallHeight / 2, z: 30 },
        { w: wallThick, h: wallHeight, d: 60, x: -20, y: wallHeight / 2, z: 0 },
        { w: wallThick, h: wallHeight, d: 60, x: 20, y: wallHeight / 2, z: 0 }
    ];

    wallData.forEach(w => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
        wall.position.set(w.x, w.y, w.z);
        mapGroup.add(wall);
        mapObstacles.push(wall);
    });

    function addObstacle(geo, mat, x, y, z) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mapGroup.add(mesh);
        mapObstacles.push(mesh);
    }

    function addSymmetricObstacles(geo, mat, x, y, z) {
        addObstacle(geo, mat, x, y, z);
        if (x !== 0) addObstacle(geo, mat, -x, y, z);
        if (z !== 0) addObstacle(geo, mat, x, y, -z);
        if (x !== 0 && z !== 0) addObstacle(geo, mat, -x, y, -z);
    }

    addSymmetricObstacles(new THREE.BoxGeometry(6, 3.5, 1), woodMat, 0, 1.75, 17);
    addSymmetricObstacles(new THREE.BoxGeometry(4, 4, 1), brickMat, 6, 2.0, 0);
    addSymmetricObstacles(new THREE.BoxGeometry(2.5, 5, 2.5), wallMat, 11, 2.5, 11);

    return mapGroup;
}

function createFlatMap() {
    const mapGroup = new THREE.Group();
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x3a5a40 });
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x588157 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(50, 0.2, 70), floorMat);
    floor.position.set(0, -0.1, 0);
    mapGroup.add(floor);

    const wallHeight = 6, wallThick = 1;
    const wallData = [
        { w: 50, h: wallHeight, d: wallThick, x: 0, y: wallHeight / 2, z: -35 },
        { w: 50, h: wallHeight, d: wallThick, x: 0, y: wallHeight / 2, z: 35 },
        { w: wallThick, h: wallHeight, d: 70, x: -25, y: wallHeight / 2, z: 0 },
        { w: wallThick, h: wallHeight, d: 70, x: 25, y: wallHeight / 2, z: 0 }
    ];

    wallData.forEach(w => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), wallMat);
        wall.position.set(w.x, w.y, w.z);
        mapGroup.add(wall);
        mapObstacles.push(wall);
    });

    return mapGroup;
}

const mapList = [createMap1, createFlatMap];

function loadRandomMap(syncMapIndex = -1) {
    if (currentMapGroup) scene.remove(currentMapGroup);
    mapObstacles = [];

    let randomIndex;
    if (syncMapIndex >= 0) {
        randomIndex = syncMapIndex;
    } else {
        randomIndex = Math.floor(Math.random() * mapList.length);
        if (isMultiplayer && isHost && socket) {
            socket.emit('mapSync', randomIndex);
        }
    }
    currentMapGroup = mapList[randomIndex]();
    scene.add(currentMapGroup);
}

function createBow() {
    bowVisual = new THREE.Group();

    const topTip = new THREE.Vector3(0, 0.4, -0.05);
    const bottomTip = new THREE.Vector3(0, -0.4, -0.05);
    const midControl = new THREE.Vector3(0, 0, -0.28);

    const bowCurve = new THREE.QuadraticBezierCurve3(bottomTip, midControl, topTip);
    const bowGeo = new THREE.TubeGeometry(bowCurve, 16, 0.025, 6, false);
    const bowMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    const bowMesh = new THREE.Mesh(bowGeo, bowMat);
    bowVisual.add(bowMesh);

    const stringGeo = new THREE.BufferGeometry().setFromPoints([
        topTip,
        new THREE.Vector3(0, 0, 0.02),
        bottomTip
    ]);
    const stringMat = new THREE.LineBasicMaterial({ color: 0xdddddd });
    bowString = new THREE.Line(stringGeo, stringMat);
    bowVisual.add(bowString);

    const nockGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6);
    nockGeo.rotateX(Math.PI / 2);
    const nockMat = new THREE.MeshLambertMaterial({ color: 0xffb703 });
    nockedArrow = new THREE.Mesh(nockGeo, nockMat);
    bowVisual.add(nockedArrow);

    aimPivot.add(bowVisual);
    updateBowDraw(0);
}

function updateBowDraw(power) {
    if (!bowString || !nockedArrow) return;
    const t = Math.min(1, power / maxCharge);
    const drawZ = 0.02 + t * 0.35;

    const pos = bowString.geometry.attributes.position;
    pos.setXYZ(1, 0, 0, drawZ);
    pos.needsUpdate = true;

    nockedArrow.position.set(0, 0, drawZ - 0.35);
}

// ==========================================
// 6. 전투, 발사, 방어 메커니즘
// ==========================================
function startReload() {
    if (isReloading || currentAmmo >= maxAmmo || isRoundEnding || isMatchEnded) return;

    isReloading = true;
    reloadTimer = reloadDuration;

    if (isCharging) {
        isCharging = false;
        if (powerBarContainer) powerBarContainer.style.display = 'none';
        stopDrawSound();
    }
    updateAmmoUI();
}

function activateDefense() {
    if (isDefending || defenseCooldownTimer > 0 || isRoundEnding || isMatchEnded) return;

    isDefending = true;
    defenseTimer = DEFENSE_DURATION;
    defenseCooldownTimer = DEFENSE_COOLDOWN;
    defenseBlockedArrow = false;

    playDefenseSound('shield');
    if (defenseShieldMesh) defenseShieldMesh.visible = true;

    if (isHealDefense) {
        const healAmount = maxPlayerHp * 0.25;
        playerHp = Math.min(maxPlayerHp, playerHp + healAmount);
        if (playerHpBar) playerHpBar.style.width = `${(playerHp / maxPlayerHp) * 100}%`;
        triggerVisualEffect(player.position, 0x00ff88, 1.2);
    }

    if (isTacticalReloadDefense) {
        currentAmmo = maxAmmo;
        isReloading = false;
        reloadTimer = 0;
        updateAmmoUI();
        triggerVisualEffect(player.position, 0xffd60a, 1.5);
    }

    if (isShockwaveDefense) {
        playDefenseSound('shockwave');
        triggerVisualEffect(player.position, 0x00b4d8, 3.5);

        if (dummyTarget && dummyHp > 0) {
            const dist = player.position.distanceTo(dummyTarget.position);
            if (dist <= 8.0) {
                const knockDir = dummyTarget.position.clone().sub(player.position).normalize();

                if (isMultiplayer && socket) {
                    // 버그 수정: dummyTarget.position을 직접 밀면 상대의 실제 위치가 아니라
                    // 이 클라이언트의 "복사본"만 잠깐 움직였다가 다음 opponentMovement 패킷에
                    // 원래 위치로 즉시 덮어써졌다. 실제로 상대를 밀려면 상대 본인 클라이언트가
                    // 자기 자신의 player.position을 움직여야 하므로, 네트워크로 방향/세기를 전달한다.
                    socket.emit('applyForce', {
                        dir: { x: knockDir.x, y: 0.15, z: knockDir.z },
                        force: 4.0
                    });
                } else {
                    dummyTarget.position.addScaledVector(knockDir, 4.0);
                }
            }
        }
    }

    if (isElectricDefense) {
        electricTimer = 3.0;
        electricTickTimer = 0; // 활성화 즉시 첫 틱이 발생하도록
        if (electricAuraMesh) electricAuraMesh.visible = true;
    }
}

// 두 프레임 사이를 한 번에 지나가는 빠른 화살도 놓치지 않도록
// 선분(start -> end)이 구(sphere) 히트박스와 교차하는지 검사한다.
function segmentIntersectsSphere(start, end, center, radius) {
    const segment = end.clone().sub(start);
    const lengthSq = segment.lengthSq();
    if (lengthSq <= 1e-8) return start.distanceTo(center) <= radius;

    const toCenter = center.clone().sub(start);
    const t = THREE.MathUtils.clamp(toCenter.dot(segment) / lengthSq, 0, 1);
    const closest = start.clone().addScaledVector(segment, t);
    return closest.distanceTo(center) <= radius;
}

function segmentIntersectsBox(start, end, box, padding = 0) {
    const expanded = box.clone();
    if (padding > 0) expanded.expandByScalar(padding);

    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length <= 1e-8) return expanded.containsPoint(start);

    direction.multiplyScalar(1 / length);
    const ray = new THREE.Ray(start, direction);
    const hitPoint = new THREE.Vector3();
    const hit = ray.intersectBox(expanded, hitPoint);
    if (!hit) return false;
    return hitPoint.distanceTo(start) <= length + 0.001;
}

function triggerVisualEffect(pos, colorHex, maxScale) {
    const ringGeo = new THREE.RingGeometry(0.5, 0.8, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos).add(new THREE.Vector3(0, 0.1, 0));
    scene.add(ring);

    let scale = 1.0;
    const expandInterval = setInterval(() => {
        scale += 0.25;
        ring.scale.set(scale, scale, scale);
        ringMat.opacity -= 0.08;
        if (ringMat.opacity <= 0 || scale >= maxScale) {
            clearInterval(expandInterval);
            scene.remove(ring);
        }
    }, 25);
}

// 화살의 최종 명중 피해를 계산한다. GROWING ARROW의 비행시간 보너스와
// EXPLOSIVE ARROW의 고정 폭발피해를 여기서 한 번에 합산한다.
function computeFinalArrowDamage(a) {
    let dmg = a.damage;

    if (a.isGrowing) {
        const elapsed = (a.maxLife || 5.0) - a.life;
        const growthRatio = Math.min(1, elapsed / GROWING_TIME_TO_MAX);
        dmg *= (1 + growthRatio * GROWING_MAX_BONUS);
    }

    // TRICKSTER: 튕길 때마다 피해 +80% 중첩
    if (a.isTrickster && a.bounceHits) {
        dmg *= (1 + TRICKSTER_DMG_PER_BOUNCE * a.bounceHits);
    }

    if (a.isExplosive) dmg += 50;

    return Math.max(1, Math.floor(dmg));
}

// BOUNCY ARROW: 화살이 맞은 장애물의 AABB를 보고 대략적인 충돌면 방향을 추정한다.
// 박스 형태 장애물이라 완벽한 물리는 아니지만, 저폴리 게임 수준에선 충분히 자연스럽게 튕긴다.
function estimateBounceNormal(arrowBox, obsBox) {
    const overlapX1 = obsBox.max.x - arrowBox.min.x, overlapX2 = arrowBox.max.x - obsBox.min.x;
    const overlapY1 = obsBox.max.y - arrowBox.min.y, overlapY2 = arrowBox.max.y - obsBox.min.y;
    const overlapZ1 = obsBox.max.z - arrowBox.min.z, overlapZ2 = arrowBox.max.z - obsBox.min.z;

    const minX = Math.min(overlapX1, overlapX2);
    const minY = Math.min(overlapY1, overlapY2);
    const minZ = Math.min(overlapZ1, overlapZ2);
    const smallest = Math.min(minX, minY, minZ);

    if (smallest === minX) return new THREE.Vector3(overlapX1 < overlapX2 ? -1 : 1, 0, 0);
    if (smallest === minY) return new THREE.Vector3(0, overlapY1 < overlapY2 ? -1 : 1, 0);
    return new THREE.Vector3(0, 0, overlapZ1 < overlapZ2 ? -1 : 1);
}

// 주어진 법선(normal)을 기준으로 화살 속도를 반사시키고, 튕김 횟수를 1 소모한다.
function bounceArrow(a, normal) {
    const dot = a.velocity.dot(normal);
    a.velocity.addScaledVector(normal, -2 * dot);
    a.velocity.multiplyScalar(BOUNCE_RESTITUTION);
    a.bouncesLeft--;
    a.bounceHits = (a.bounceHits || 0) + 1; // TRICKSTER: 튕긴 횟수를 세서 데미지에 반영
    playHitSound(false);
}

// 넉백 화살에 맞았을 때 날아온 방향으로 플레이어를 밀어낸다
function applyKnockbackToPlayer(incomingVelocity) {
    if (!player || !incomingVelocity) return;
    const dir = incomingVelocity.clone();
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    player.position.addScaledVector(dir, KNOCKBACK_DISTANCE);
    playerVelocityY = Math.max(playerVelocityY, 3); // 살짝 공중에 뜨는 느낌
}

// 반사 방어로 막아낸 화살을 상대방 쪽으로 다시 쏘아 보낸다
function reflectArrowBack(hitArrow) {
    if (!dummyTarget || !player) return;

    const dir = new THREE.Vector3().subVectors(dummyTarget.position, player.position);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();

    const arrowGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshLambertMaterial({ color: 0x00f0ff }); // 반사 화살은 색을 다르게 표시
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);

    const spawnPos = new THREE.Vector3();
    nockedArrow.getWorldPosition(spawnPos);
    arrow.position.copy(spawnPos).addScaledVector(dir, 0.4);

    const reflectedDamage = Math.max(1, Math.floor(hitArrow?.damage || 15));
    const speed = hitArrow?.velocity ? hitArrow.velocity.length() : 30;

    scene.add(arrow);
    arrows.push({
        mesh: arrow,
        velocity: dir.clone().multiplyScalar(speed),
        life: 5.0,
        damage: reflectedDamage,
        isExplosive: false,
        isPoison: false,
        isHoming: false,
        isKnockback: false,
        gravityMulti: 1.0,
        isPlayerArrow: true
    });

    playDefenseSound('reflect');

    if (isMultiplayer && socket) {
        socket.emit('shootArrow', {
            pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            dir: { x: dir.x, y: dir.y, z: dir.z },
            power: 60,
            damage: reflectedDamage,
            speedMulti: 1.0,
            isExplosive: false,
            isPoison: false,
            isHoming: false,
            isKnockback: false,
            scale: 1.0,
            gravityMulti: 1.0
        });
    }
}

function createSingleArrow(dir, power, dmgPenaltyMulti = 1.0) {
    const arrowGeo = new THREE.CylinderGeometry(0.03 * arrowScale, 0.03 * arrowScale, 1.2 * arrowScale, 8);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshLambertMaterial({ color: 0xffb703 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);

    const spawnPos = new THREE.Vector3();
    nockedArrow.getWorldPosition(spawnPos);

    arrow.position.copy(spawnPos).addScaledVector(dir, 0.4);

    const baseSpeed = 15 + (power / 100) * 45;
    const speed = baseSpeed * statSpeedMulti;
    const velocity = dir.clone().multiplyScalar(speed);

    let baseDamage = 15 + (power / 100) * 25;
    if (isPoisonArrow) baseDamage *= 0.6;       // POISON ARROW: 기본 피해 -40%
    if (isGrowingArrow) baseDamage *= 0.6;      // GROWING ARROW: 기본 피해 -40%
    if (isLeechArrow) baseDamage *= 0.85;       // LEECH ARROW: 피해 -15%
    if (isTimedDetonation) baseDamage *= 0.8;   // TIMED DETONATION: 기본 피해 -20%
    if (isKnockbackArrow) baseDamage *= 0.8;    // THRUSTER ARROW: 피해 -20%
    if (isBouncyArrow) baseDamage *= 0.75;      // BOUNCY ARROW: 피해 -25%
    if (isTrickster) baseDamage *= 0.7;         // TRICKSTER: 기본 피해 -30%
    baseDamage *= dmgPenaltyMulti;

    const finalDamage = Math.max(1, Math.floor(baseDamage * statAtkMulti));

    // EXPLOSIVE ARROW: 완전히 당겼을 때만 폭발이 발동한다.
    const explosiveActive = isExplosiveArrow && (!explosiveRequiresFullCharge || power >= maxCharge - 0.5);

    // TRICKSTER는 BOUNCY ARROW 없이도 자체적으로 튕길 수 있게 해주며(+1회),
    // BOUNCY ARROW를 이미 가지고 있으면 그 위에 +1회가 추가로 붙는다.
    let bounceCharges = 0;
    if (isBouncyArrow) bounceCharges += BOUNCE_COUNT;
    if (isTrickster) bounceCharges += 1;

    scene.add(arrow);
    arrows.push({
        mesh: arrow,
        velocity: velocity,
        life: 5.0,
        maxLife: 5.0,
        damage: finalDamage,
        isExplosive: explosiveActive,
        isPoison: isPoisonArrow,
        isHoming: isHomingArrow,
        isKnockback: isKnockbackArrow,
        isLeech: isLeechArrow,
        isTimedDetonation: isTimedDetonation,
        isGrowing: isGrowingArrow,
        isBouncy: isBouncyArrow || isTrickster,
        isTrickster: isTrickster,
        bounceHits: 0,
        bouncesLeft: bounceCharges,
        gravityMulti: heavyGravityMulti,
        isPlayerArrow: true
    });

    if (isMultiplayer && socket) {
        socket.emit('shootArrow', {
            pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            dir: { x: dir.x, y: dir.y, z: dir.z },
            power: power,
            damage: finalDamage,
            speedMulti: statSpeedMulti,
            isExplosive: explosiveActive,
            isPoison: isPoisonArrow,
            isHoming: isHomingArrow,
            isKnockback: isKnockbackArrow,
            isBouncy: isBouncyArrow || isTrickster,
            isTrickster: isTrickster,
            bounceCharges: bounceCharges,
            scale: arrowScale, // 발사자의 스케일을 전달
            gravityMulti: heavyGravityMulti
        });
    }
}

function createRemoteArrow(data) {
    const arrowGeo = new THREE.CylinderGeometry(0.03 * data.scale, 0.03 * data.scale, 1.2 * data.scale, 8);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshLambertMaterial({ color: 0xff0055 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);

    arrow.position.set(data.pos.x, data.pos.y, data.pos.z);

    const baseSpeed = 15 + (data.power / 100) * 45;
    const dirVec = new THREE.Vector3(data.dir.x, data.dir.y, data.dir.z).normalize();
    const speed = baseSpeed * (data.speedMulti || 1.0);
    const velocity = dirVec.clone().multiplyScalar(speed);

    scene.add(arrow);
    arrows.push({
        mesh: arrow,
        velocity: velocity,
        life: 5.0,
        damage: data.damage,
        isExplosive: data.isExplosive,
        isPoison: data.isPoison,
        isHoming: data.isHoming,
        isKnockback: data.isKnockback,
        isBouncy: data.isBouncy,
        isTrickster: data.isTrickster,
        bounceHits: 0,
        bouncesLeft: Number.isFinite(Number(data.bounceCharges)) ? Number(data.bounceCharges) : BOUNCE_COUNT,
        gravityMulti: data.gravityMulti || 1.0,
        isPlayerArrow: false
    });
}

function shootArrow(power) {
    const baseDir = new THREE.Vector3();
    camera.getWorldDirection(baseDir);

    if (isTripleShot) {
        const count = Math.min(currentAmmo, 3);
        if (count <= 0) return;

        // TRIPLE VOLLEY: 넓은 부채꼴로 3발 동시발사
        let angles = [0, 0.15, -0.15];
        if (count === 1) angles = [0];
        else if (count === 2) angles = [0.08, -0.08];

        for (let i = 0; i < count; i++) {
            let dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angles[i]);
            createSingleArrow(dir, power, 0.45); // 발당 피해 -55%
        }
        currentAmmo -= count;
    } else if (isDoubleShot) {
        // TWIN SHOT: 0.12초 간격 연속 발사, 발당 피해 -35%
        createSingleArrow(baseDir.clone(), power, 0.65);
        currentAmmo--;

        if (currentAmmo > 0) {
            setTimeout(() => {
                if (isMatchEnded || isRoundEnding || isReloading || currentAmmo <= 0) return;
                const secondDir = new THREE.Vector3();
                camera.getWorldDirection(secondDir);
                playShootSound();
                createSingleArrow(secondDir, power, 0.65);
                currentAmmo--;
                updateAmmoUI();
                if (currentAmmo <= 0) startReload();
            }, 120);
        }
    } else {
        createSingleArrow(baseDir.clone(), power, 1.0);
        currentAmmo--;
    }

    shootCooldownTimer = shootCooldownDuration / statSpeedMulti;
    updateAmmoUI();

    if (currentAmmo <= 0) startReload();
}

// ==========================================
// 7. 라운드 및 업그레이드 처리
// ==========================================
function onLocalPlayerKilled() {
    if (isRoundEnding) return;

    playerPoisonTicksLeft = 0;
    playerPoisonTimer = 0;

    clearArrows();
    resetPositions();

    if (isMultiplayer && socket) {
        // 멀티플레이에서는 서버가 HP 0을 확인해 이미 다운/라운드 처리를 담당한다.
        // 클라이언트가 playerDied를 다시 보내지 않는다.
        isPlayerDowned = true;
        return;
    } else {
        // PHOENIX: 이번 매치에서 처음 다운될 때 한 번만 다운을 무효화한다.
        if (hasPhoenix && !phoenixUsed) {
            phoenixUsed = true;
            playerHp = maxPlayerHp;
            if (playerHpBar) playerHpBar.style.width = '100%';
            triggerVisualEffect(player.position, 0xff9500, 2.5);
            return;
        }

        playerDownCount++;
        if (playerDownCount >= 2) {
            opponentWins++;
            updateScoreboard();
            if (opponentWins >= targetWins) {
                endMatch(false);
            } else {
                endRound("ROUND LOSE!", true);
            }
        } else {
            playerHp = maxPlayerHp;
            if (playerHpBar) playerHpBar.style.width = '100%';
        }
    }
}

function onDummyKilled() {
    if (isRoundEnding) return;

    poisonTicksLeft = 0;
    poisonTimer = 0;

    clearArrows();
    resetPositions();

    if (!isMultiplayer) {
        dummyDownCount++;
        if (downCountText) downCountText.innerText = `상대 다운: ${dummyDownCount} / 2`;

        if (dummyDownCount >= 2) {
            playerWins++;
            updateScoreboard();

            if (playerWins >= targetWins) {
                endMatch(true);
            } else {
                const availableDummyPool = upgradePool.filter(upg => !upg.deferred && !dummyUpgrades.some(d => d.id === upg.id));
                if (availableDummyPool.length > 0) {
                    const randomDummyUpg = availableDummyPool[Math.floor(Math.random() * availableDummyPool.length)];
                    dummyUpgrades.push(randomDummyUpg);
                    renderUpgradeIcons(dummyUpgradesContainer, dummyUpgrades);
                }
                endRound("ROUND WIN!", false);
            }
        } else {
            scene.remove(dummyTarget);
            setTimeout(() => {
                if (!isRoundEnding && !isMatchEnded) {
                    dummyHp = 100;
                    if (dummyHpBar) dummyHpBar.style.width = '100%';
                    if (dummyTarget && !scene.children.includes(dummyTarget)) scene.add(dummyTarget);
                }
            }, 1200);
        }
    }
}

function endRound(message, isPlayerDefeated) {
    isRoundEnding = true;
    if (roundMessageText) {
        roundMessageText.innerText = message;
        roundMessageText.style.display = 'block';
    }

    if (dummyTarget && !isMultiplayer) scene.remove(dummyTarget);

    setTimeout(() => {
        if (roundMessageText) roundMessageText.style.display = 'none';
        if (isPlayerDefeated) {
            showUpgradeScreen();
        } else if (!isMultiplayer) {
            resetRound();
        }
    }, 2000);
}

// 희귀도별 가중치 (라운즈 비율과 유사하게: Common 45% / Uncommon 35% / Rare 20%)
const RARITY_WEIGHT = { common: 45, uncommon: 35, rare: 20 };

// 40여 장의 풀에서 카테고리가 한쪽으로 쏠리지 않도록 가중치 랜덤으로 N장을 뽑는다.
function pickWeightedUpgrades(pool, count) {
    const remaining = [...pool];
    const picked = [];
    const usedCategories = new Set();

    while (picked.length < count && remaining.length > 0) {
        // 아직 등장하지 않은 카테고리를 우선 후보로 삼아 다양성을 확보한다.
        let candidates = remaining.filter(u => !usedCategories.has(u.category));
        if (candidates.length === 0) candidates = remaining;

        const totalWeight = candidates.reduce((sum, u) => sum + (RARITY_WEIGHT[u.rarity] || 30), 0);
        let roll = Math.random() * totalWeight;
        let chosen = candidates[candidates.length - 1];

        for (const u of candidates) {
            roll -= (RARITY_WEIGHT[u.rarity] || 30);
            if (roll <= 0) { chosen = u; break; }
        }

        picked.push(chosen);
        usedCategories.add(chosen.category);
        remaining.splice(remaining.indexOf(chosen), 1);
    }

    return picked;
}

function showUpgradeScreen() {
    // deferred: true (아직 미구현) 카드와 이미 보유한 카드는 선택지에서 제외한다.
    const availableUpgrades = upgradePool.filter(upg => !upg.deferred && !playerUpgrades.some(p => p.id === upg.id));
    if (availableUpgrades.length === 0) {
        if (!isMultiplayer) resetRound();
        return;
    }

    const selectedUpgrades = pickWeightedUpgrades(availableUpgrades, Math.min(5, availableUpgrades.length));

    if (upgradeContainer) {
        // 5장이 화면 폭에 맞게 줄바꿈되도록 컨테이너 레이아웃을 인라인으로 보정
        upgradeContainer.style.cssText = 'display:flex; flex-wrap:wrap; justify-content:center; gap:14px; max-width:1100px; margin:0 auto;';

        upgradeContainer.innerHTML = '';
        const rarityColor = { common: '#a8dadc', uncommon: '#2ec4b6', rare: '#ffb703' };

        selectedUpgrades.forEach(upg => {
            const color = rarityColor[upg.rarity] || '#ffffff';
            const btn = document.createElement('button');
            btn.className = 'upgrade-card';
            btn.style.cssText = `width:190px; flex:0 0 auto; border-color:${color};`;
            btn.innerHTML = `
                <div class="icon">${upg.icon}</div>
                <div class="title">${upg.title}</div>
                <div style="font-size:11px; font-weight:bold; letter-spacing:1px; color:${color}; margin-bottom:6px;">${upg.rarity.toUpperCase()}</div>
                <div class="desc" style="color:#e6e6e6;">${upg.effect}</div>
                ${upg.tradeoff && upg.tradeoff !== '없음' ? `<div class="desc" style="color:#ff6b6b; margin-top:6px;">대가: ${upg.tradeoff}</div>` : ''}
            `;
            btn.addEventListener('click', () => applyUpgrade(upg));
            upgradeContainer.appendChild(btn);
        });
    }

    document.exitPointerLock();
    if (upgradeScreen) upgradeScreen.style.display = 'flex';
}

function applyUpgrade(upg) {
    switch (upg.id) {
        // ── 발사체 ──
        case 'twin_shot':
            isDoubleShot = true;
            reloadDuration += 0.3;
            break;
        case 'triple_volley':
            isTripleShot = true;
            reloadDuration += 0.4;
            maxAmmo += 5; currentAmmo += 5;
            break;
        case 'big_arrow':
            arrowScale += 0.8;
            statSpeedMulti = Math.max(0.3, statSpeedMulti - 0.15);
            reloadDuration += 0.25;
            break;
        case 'homing':
            isHomingArrow = true;
            statChargeMulti = Math.max(0.2, statChargeMulti - 0.35);
            break;
        case 'growing_arrow':
            isGrowingArrow = true;
            statSpeedMulti = Math.max(0.3, statSpeedMulti - 0.2);
            break;
        case 'bouncy_arrow':
            isBouncyArrow = true;
            reloadDuration += 0.25;
            break;
        case 'trickster':
            isTrickster = true;
            reloadDuration += 0.5;
            break;

        // ── 명중효과 ──
        case 'poison_arrow':
            isPoisonArrow = true;
            break;
        case 'explosive_arrow':
            isExplosiveArrow = true;
            explosiveRequiresFullCharge = true;
            reloadDuration += 0.25;
            break;
        case 'thruster_arrow':
            isKnockbackArrow = true;
            break;
        case 'leech_arrow':
            isLeechArrow = true;
            break;
        case 'timed_detonation':
            isTimedDetonation = true;
            break;

        // ── 방어 ──
        case 'def_shockwave':
            isShockwaveDefense = true;
            maxPlayerHp *= 1.4; playerHp = Math.min(playerHp * 1.4, maxPlayerHp);
            break;
        case 'def_electric':
            isElectricDefense = true;
            maxPlayerHp *= 1.3; playerHp = Math.min(playerHp * 1.3, maxPlayerHp);
            break;
        case 'def_explosive':
            isExplosiveDefense = true;
            maxPlayerHp *= 1.3; playerHp = Math.min(playerHp * 1.3, maxPlayerHp);
            break;
        case 'def_reflect':
            isReflectDefense = true;
            break;
        case 'def_heal':
            isHealDefense = true;
            maxPlayerHp *= 1.2; playerHp = Math.min(playerHp * 1.2, maxPlayerHp);
            break;
        case 'def_tactical_reload':
            isTacticalReloadDefense = true;
            break;

        // ── 패시브 스탯 ──
        case 'power':
            statAtkMulti += 0.75;
            statSpeedMulti = Math.max(0.3, statSpeedMulti - 0.2);
            reloadDuration += 0.25;
            break;
        case 'careful_planning':
            statAtkMulti += 1.2;
            statChargeMulti = Math.max(0.2, statChargeMulti - 0.6);
            reloadDuration += 0.5;
            break;
        case 'fastball':
            statSpeedMulti += 1.5;
            statAtkMulti += 0.15;
            statChargeMulti = Math.max(0.2, statChargeMulti - 0.4);
            reloadDuration += 0.25;
            break;
        case 'steady_shot':
            maxPlayerHp *= 1.4; playerHp = Math.min(playerHp * 1.4, maxPlayerHp);
            statSpeedMulti += 0.6;
            reloadDuration += 0.25;
            break;
        case 'quick_reload':
            reloadDuration = Math.max(0.1, reloadDuration * 0.3);
            maxAmmo = Math.max(1, maxAmmo - 3);
            currentAmmo = Math.min(currentAmmo, maxAmmo);
            break;
        case 'tank':
            maxPlayerHp *= 2.0; playerHp = Math.min(playerHp * 2.0, maxPlayerHp);
            statChargeMulti = Math.max(0.2, statChargeMulti - 0.25);
            reloadDuration += 0.5;
            break;
        case 'huge':
            maxPlayerHp *= 1.8; playerHp = Math.min(playerHp * 1.8, maxPlayerHp);
            break;
        case 'wind_up':
            statSpeedMulti += 1.0;
            statAtkMulti += 0.6;
            requiresFullChargeToShoot = true;
            reloadDuration += 0.5;
            break;

        // ── 조건부/유니크 ──
        case 'phoenix':
            hasPhoenix = true;
            maxPlayerHp *= 0.65; playerHp = Math.min(playerHp, maxPlayerHp);
            break;
        case 'brawler':
            isBrawler = true;
            break;
        case 'chase':
            isChase = true;
            maxPlayerHp *= 1.3; playerHp = Math.min(playerHp * 1.3, maxPlayerHp);
            break;
        case 'taste_of_blood':
            isTasteOfBlood = true;
            break;
        case 'glass_cannon':
            statAtkMulti += 1.0;
            maxPlayerHp = 1; playerHp = Math.min(playerHp, maxPlayerHp);
            isGlassCannon = true;
            break;
        case 'pristine':
            isPristine = true;
            break;
    }

    playerUpgrades.push(upg);
    renderUpgradeIcons(playerUpgradesContainer, playerUpgrades);

    if (isMultiplayer && socket) {
        socket.emit('upgradeSelected', upg);
    }
    updateAmmoUI();

    if (upgradeScreen) upgradeScreen.style.display = 'none';
    canvas.requestPointerLock();

    if (!isMultiplayer) resetRound();
}

function resetRound() {
    isPlayerDowned = false;
    dummyDownCount = 0;
    playerDownCount = 0;
    currentRound++;
    isRoundEnding = false;

    currentAmmo = maxAmmo;
    isReloading = false;
    reloadTimer = 0;
    shootCooldownTimer = 0;

    poisonTicksLeft = 0;
    poisonTimer = 0;
    playerPoisonTicksLeft = 0;
    playerPoisonTimer = 0;

    updateScoreboard();
    updateAmmoUI();

    dummyHp = dummyMaxHp;
    if (dummyHpBar) dummyHpBar.style.width = '100%';
    playerHp = maxPlayerHp;
    if (playerHpBar) playerHpBar.style.width = '100%';

    // 라운드 한정 임시 버프 타이머 초기화 (BRAWLER/TASTE OF BLOOD).
    // 카드 보유 여부(isBrawler 등) 자체는 매치 내내 유지된다.
    brawlerTimer = 0;
    tasteOfBloodTimer = 0;

    isDefending = false;
    defenseTimer = 0;
    defenseCooldownTimer = 0;
    electricTimer = 0;
    electricTickTimer = 0;

    if (defenseShieldMesh) defenseShieldMesh.visible = false;
    if (electricAuraMesh) electricAuraMesh.visible = false;

    clearArrows();
    resetPositions();
    loadRandomMap();

    if (dummyTarget) {
        // 이전 라운드의 playerDown에서 숨겨진 상태가 남아 있지 않도록
        // 새 라운드 시작 시 상대 캐릭터를 반드시 다시 표시한다.
        dummyTarget.visible = true;
        if (remoteShieldMesh) remoteShieldMesh.visible = false;
        if (remoteElectricMesh) remoteElectricMesh.visible = false;
        if (!scene.children.includes(dummyTarget)) scene.add(dummyTarget);
    }
}

function endMatch(isVictory) {
    isMatchEnded = true;
    document.exitPointerLock();

    if (matchResultTitle) {
        matchResultTitle.innerText = isVictory ? "VICTORY!" : "DEFEAT";
        matchResultTitle.style.color = isVictory ? "#ffb703" : "#e63946";
    }
    if (matchResultScore) {
        matchResultScore.innerText = `최종 스코어 ${playerWins} : ${opponentWins}`;
    }

    if (matchResultScreen) matchResultScreen.style.display = 'flex';
}

// ==========================================
// 8. 이벤트 및 메인 루프
// ==========================================
function onKeyDown(e) {
    if (e.code in keys) keys[e.code] = true;
    if (e.code === 'KeyR') startReload();
    if (e.code === 'KeyE') activateDefense();

    if (e.code === 'Tab') {
        e.preventDefault();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        else canvas.requestPointerLock();
    }

    if (e.code === 'KeyV') {
        isFirstPerson = !isFirstPerson;
        playerBody.visible = !isFirstPerson;
        if (cameraModeText) {
            cameraModeText.innerText = `시점: ${isFirstPerson ? '1인칭' : '3인칭'} (V: 시점전환 / E: 방어 / R: 재장전 / Tab: 마우스 잠금 / Space: 점프)`;
        }
    }
}

function onKeyUp(e) {
    if (e.code in keys) keys[e.code] = false;
}

function onMouseMove(e) {
    if (document.pointerLockElement !== canvas || isMatchEnded) return;
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
}

function onMouseDown(e) {
    if (document.pointerLockElement !== canvas || e.button !== 0 || isRoundEnding || isMatchEnded) return;
    if (currentAmmo <= 0) { startReload(); return; }
    if (shootCooldownTimer > 0 || isReloading) return;

    isCharging = true;
    chargePower = 0;
    if (powerBarContainer) powerBarContainer.style.display = 'block';
    startDrawSound();
}

function onMouseUp(e) {
    if (!isCharging || e.button !== 0) return;
    isCharging = false;
    if (powerBarContainer) powerBarContainer.style.display = 'none';
    stopDrawSound();

    // WIND UP: 완전히 당기기 전에 놓으면 발사되지 않는다.
    if (requiresFullChargeToShoot && chargePower < maxCharge - 0.5) {
        chargePower = 0;
        return;
    }

    if (currentAmmo > 0 && !isReloading && shootCooldownTimer <= 0) {
        playShootSound();
        shootArrow(chargePower);
    }
    chargePower = 0;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    climbSoundCooldown = Math.max(0, climbSoundCooldown - delta);

    if (shootCooldownTimer > 0) shootCooldownTimer -= delta;

    if (isReloading) {
        reloadTimer -= delta;
        const progress = Math.min(100, Math.max(0, ((reloadDuration - reloadTimer) / reloadDuration) * 100));
        if (reloadBarUI) reloadBarUI.style.width = `${progress}%`;

        if (reloadTimer <= 0) {
            isReloading = false;
            currentAmmo = maxAmmo;
            updateAmmoUI();
        }
    }

    if (isCharging && !isPlayerDowned) {
        chargePower = Math.min(maxCharge, chargePower + delta * 150 * statChargeMulti);
        if (powerBar) powerBar.style.width = `${chargePower}%`;
    }

    if (isDefending) {
        defenseTimer -= delta;
        if (defenseShieldMesh) defenseShieldMesh.rotation.y += delta * 3;

        if (defenseTimer <= 0) {
            isDefending = false;
            if (defenseShieldMesh) defenseShieldMesh.visible = false;

            // 폭발 방어: 방어가 끝나는 순간 주변에 범위 피해를 준다
            if (isExplosiveDefense) {
                triggerVisualEffect(player.position, 0xff6600, 3.0);
                playDefenseSound('shockwave');

                const EXPLOSIVE_DEF_RADIUS = 6.0;
                const EXPLOSIVE_DEF_DAMAGE = 25;
                if (dummyTarget && dummyHp > 0 && !isRoundEnding && !isMatchEnded) {
                    const dist = player.position.distanceTo(dummyTarget.position);
                    if (dist <= EXPLOSIVE_DEF_RADIUS) {
                        if (isMultiplayer && socket) {
                            socket.emit('hitOpponent', {
                                damage: EXPLOSIVE_DEF_DAMAGE,
                                timestamp: Date.now(),
                                hitType: 'explosive_defense'
                            });
                        } else {
                            dummyHp = Math.max(0, dummyHp - EXPLOSIVE_DEF_DAMAGE);
                            if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
                            if (dummyHp <= 0) onDummyKilled();
                        }
                    }
                }
            }
        }
    }

    // 전격 방어(Electric Defense) 처리
    // 버그 수정: 기존엔 electricTimer가 세팅만 되고 한 번도 감소하지 않아
    // 전격을 한 번이라도 쓰면 오라가 게임이 끝날 때까지 계속 켜져 있었음.
    // 여기서 타이머를 실제로 소모시키고, 그동안 주변 상대에게 주기적으로 피해를 준다.
    if (electricTimer > 0) {
        electricTimer -= delta;
        if (electricAuraMesh) electricAuraMesh.rotation.y += delta * 5;

        electricTickTimer -= delta;
        if (electricTickTimer <= 0) {
            electricTickTimer = ELECTRIC_TICK_INTERVAL;

            if (dummyTarget && dummyHp > 0 && !isRoundEnding && !isMatchEnded && !isPlayerDowned) {
                const dist = player.position.distanceTo(dummyTarget.position);
                if (dist <= ELECTRIC_RADIUS) {
                    playHitSound(true);
                    if (isMultiplayer && socket) {
                        // 멀티플레이에서는 서버가 최종 데미지를 검증/반영한다.
                        socket.emit('hitOpponent', {
                            damage: ELECTRIC_TICK_DAMAGE,
                            timestamp: Date.now(),
                            hitType: 'electric'
                        });
                    } else {
                        dummyHp = Math.max(0, dummyHp - ELECTRIC_TICK_DAMAGE);
                        if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
                        if (dummyHp <= 0) onDummyKilled();
                    }
                }
            }
        }

        if (electricTimer <= 0) {
            electricTimer = 0;
            if (electricAuraMesh) electricAuraMesh.visible = false;
        }
    }

    // 독화살 도트(DOT) 처리
    // 버그 수정: 기존엔 poisonTicksLeft/poisonTimer가 선언·리셋만 되고
    // 실제로 시간이 지나며 피해를 주는 로직이 없어 독화살이 순수 데미지 손해였음.
    if (poisonTicksLeft > 0) {
        poisonTimer -= delta;
        if (poisonTimer <= 0) {
            poisonTimer = POISON_TICK_INTERVAL;
            poisonTicksLeft--;

            if (dummyHp > 0 && !isRoundEnding && !isMatchEnded) {
                playHitSound(true);
                if (isMultiplayer && socket) {
                    socket.emit('hitOpponent', {
                        damage: POISON_TICK_DAMAGE,
                        timestamp: Date.now(),
                        hitType: 'poison'
                    });
                } else if (dummyTarget) {
                    dummyHp = Math.max(0, dummyHp - POISON_TICK_DAMAGE);
                    if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
                    if (dummyHp <= 0) onDummyKilled();
                }
            } else {
                poisonTicksLeft = 0; // 대상이 이미 죽었거나 라운드가 끝났으면 중단
            }
        }
    }

    if (defenseCooldownTimer > 0) {
        defenseCooldownTimer -= delta;
        const remaining = Math.max(0, defenseCooldownTimer);
        const ratio = (1 - remaining / DEFENSE_COOLDOWN) * 100;
        if (defenseCdBar) defenseCdBar.style.width = `${ratio}%`;
        if (defenseCdText) defenseCdText.innerText = `${remaining.toFixed(1)}s`;
        if (defenseBtnIndicator) defenseBtnIndicator.className = 'cooling';
    } else if (defenseBtnIndicator) {
        if (defenseCdBar) defenseCdBar.style.width = '100%';
        if (defenseCdText) defenseCdText.innerText = 'READY';
        defenseBtnIndicator.className = isDefending ? 'active-def' : 'ready';
    }

    // BRAWLER / TASTE OF BLOOD 임시 버프 타이머 감소
    if (brawlerTimer > 0) brawlerTimer = Math.max(0, brawlerTimer - delta);
    if (tasteOfBloodTimer > 0) tasteOfBloodTimer = Math.max(0, tasteOfBloodTimer - delta);

    // 캐릭터 이동 처리
    if (player && !isMatchEnded && !isPlayerDowned) {
        player.rotation.y = yaw;
        aimPivot.rotation.x = pitch;

        const oldPos = player.position.clone();
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const side = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

        // CHASE: 상대를 바라보며 다가갈 때 이동속도 증가 / TASTE OF BLOOD: 명중 후 3초간 이동속도 증가
        let speedMultiplier = 1.0;
        if (isTasteOfBlood && tasteOfBloodTimer > 0) speedMultiplier += TASTE_OF_BLOOD_SPEED_BONUS;
        if (isChase && dummyTarget && keys.KeyW) {
            const toOpponent = dummyTarget.position.clone().sub(player.position);
            toOpponent.y = 0;
            if (toOpponent.lengthSq() > 0.01) {
                toOpponent.normalize();
                if (forward.dot(toOpponent) > 0.7) speedMultiplier += 0.6;
            }
        }

        const frameSpeed = moveSpeed * delta * speedMultiplier;
        if (keys.KeyW) player.position.addScaledVector(forward, frameSpeed);
        if (keys.KeyS) player.position.addScaledVector(forward, -frameSpeed);
        if (keys.KeyD) player.position.addScaledVector(side, frameSpeed);
        if (keys.KeyA) player.position.addScaledVector(side, -frameSpeed);

        let isTouchingWall = false;
        const playerRadius = 0.5;

        for (let obs of mapObstacles) {
            const obsBox = new THREE.Box3().setFromObject(obs);
            const pMinX = player.position.x - playerRadius, pMaxX = player.position.x + playerRadius;
            const pMinZ = player.position.z - playerRadius, pMaxZ = player.position.z + playerRadius;
            const pMinY = player.position.y - 1.0, pMaxY = player.position.y + 1.0;

            if (pMaxX > obsBox.min.x && pMinX < obsBox.max.x &&
                pMaxZ > obsBox.min.z && pMinZ < obsBox.max.z &&
                pMaxY > obsBox.min.y && pMinY < obsBox.max.y) {

                if (oldPos.y - 1.0 >= obsBox.max.y - 0.3) continue;
                isTouchingWall = true;

                const overlapX1 = obsBox.max.x - pMinX, overlapX2 = pMaxX - obsBox.min.x;
                const overlapZ1 = obsBox.max.z - pMinZ, overlapZ2 = pMaxZ - obsBox.min.z;

                if (Math.min(overlapX1, overlapX2) < Math.min(overlapZ1, overlapZ2)) {
                    player.position.x = (overlapX1 < overlapX2) ? obsBox.max.x + playerRadius : obsBox.min.x - playerRadius;
                } else {
                    player.position.z = (overlapZ1 < overlapZ2) ? obsBox.max.z + playerRadius : obsBox.min.z - playerRadius;
                }
            }
        }

        if (keys.Space) {
            if (isGrounded) {
                playerVelocityY = jumpPower;
                isGrounded = false;
                playJumpSound(false);
            } else if (isTouchingWall) {
                playerVelocityY = 7;
                if (climbSoundCooldown <= 0) {
                    playJumpSound(true);
                    climbSoundCooldown = 0.25;
                }
            }
        }

        if (!isGrounded) playerVelocityY -= gravity * delta;
        player.position.y += playerVelocityY * delta;

        let highestFloorY = 1.0;
        for (let obs of mapObstacles) {
            const obsBox = new THREE.Box3().setFromObject(obs);
            if (player.position.x + 0.4 > obsBox.min.x && player.position.x - 0.4 < obsBox.max.x &&
                player.position.z + 0.4 > obsBox.min.z && player.position.z - 0.4 < obsBox.max.z) {
                const topY = obsBox.max.y + 1.0;
                if (oldPos.y - 1.0 >= obsBox.max.y - 0.4 && topY > highestFloorY) highestFloorY = topY;
            }
        }

        if (player.position.y <= highestFloorY) {
            player.position.y = highestFloorY;
            playerVelocityY = 0;
            isGrounded = true;
        } else {
            isGrounded = false;
        }

        if (isFirstPerson) {
            camera.position.copy(player.position).add(new THREE.Vector3(0, 0.6, 0));
        } else {
            const offset = new THREE.Vector3(0, 3, 6).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            camera.position.copy(player.position).add(offset);
        }
        camera.rotation.set(pitch, yaw, 0, 'YXZ');

        if (isMultiplayer && socket) {
            const pristineActive = isPristine && maxPlayerHp > 0 && (playerHp / maxPlayerHp) >= 0.9;
            socket.emit('playerMovement', {
                x: player.position.x, y: player.position.y, z: player.position.z,
                yaw: yaw, pitch: pitch,
                def: isDefending && !isPlayerDowned, elec: electricTimer > 0,
                hp: playerHp,
                pristine: pristineActive,
                brawler: brawlerTimer > 0
            });
        }
    }

    updateBowDraw(chargePower);

    // 화살 비행 연산
    for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];

        if (a.isHoming && dummyTarget && dummyHp > 0) {
            const dirToTarget = dummyTarget.position.clone().sub(a.mesh.position).normalize();
            const currentSpeed = a.velocity.length();
            a.velocity.lerp(dirToTarget.multiplyScalar(currentSpeed), 0.04);
        }

        // 이전 위치를 저장해 빠른 화살의 관통(터널링)을 방지한다.
        const previousPos = a.mesh.position.clone();

        a.velocity.y -= gravity * a.gravityMulti * delta;
        a.mesh.position.addScaledVector(a.velocity, delta);

        const nextPos = a.mesh.position.clone().add(a.velocity);
        a.mesh.lookAt(nextPos);

        // 먼저 상대 플레이어를 검사한다. 빠른 화살이 한 프레임 안에 지나가도
        // 이전 위치 -> 현재 위치 구간 전체를 검사해 명중을 잡는다.
        if (a.isPlayerArrow && isMultiplayer && dummyTarget && dummyTarget.visible && dummyHp > 0 && !isRoundEnding && !isMatchEnded) {
            const targetBox = new THREE.Box3().setFromObject(dummyBody || dummyTarget);
            const arrowHitRadius = Math.max(0.18, 0.12 * arrowScale);
            const hitCenter = dummyTarget.position.clone().add(new THREE.Vector3(0, 0.15, 0));
            const hitBySweep = segmentIntersectsSphere(previousPos, a.mesh.position, hitCenter, Math.max(1.5, 1.25 * arrowScale));
            const hitByBox = segmentIntersectsBox(previousPos, a.mesh.position, targetBox, 0.55 + 0.2 * arrowScale);

            if (hitBySweep || hitByBox) {
                playHitSound(true);
                const finalDamage = computeFinalArrowDamage(a);

                if (socket && currentRoomId) {
                    socket.emit('hitOpponent', {
                        damage: finalDamage,
                        timestamp: Date.now(),
                        hitType: 'arrow'
                    });
                }

                // 독화살 명중: 이후 몇 초간 추가 도트 피해를 예약한다 (버그 수정: 기존엔 예약 코드가 없었음)
                if (a.isPoison) {
                    poisonTicksLeft = POISON_TICK_COUNT;
                    poisonTimer = POISON_TICK_INTERVAL;
                }

                // 흡혈 화살: 입힌 피해의 40%만큼 즉시 회복
                if (a.isLeech) {
                    playerHp = Math.min(maxPlayerHp, playerHp + finalDamage * LEECH_RATIO);
                    if (playerHpBar) playerHpBar.style.width = `${(playerHp / maxPlayerHp) * 100}%`;
                }

                // BRAWLER: 명중 성공 후 3초간 받는 피해 감소
                if (isBrawler) brawlerTimer = BRAWLER_DURATION;

                // TASTE OF BLOOD: 명중 성공 후 3초간 이동속도 증가 + 소량 흡혈
                if (isTasteOfBlood) {
                    tasteOfBloodTimer = TASTE_OF_BLOOD_DURATION;
                    playerHp = Math.min(maxPlayerHp, playerHp + finalDamage * 0.3);
                    if (playerHpBar) playerHpBar.style.width = `${(playerHp / maxPlayerHp) * 100}%`;
                }

                // 지연 폭발: 0.5초 뒤 추가 피해를 한 번 더 보낸다
                if (a.isTimedDetonation) {
                    setTimeout(() => {
                        if (isRoundEnding || isMatchEnded || !socket || !currentRoomId) return;
                        socket.emit('hitOpponent', {
                            damage: TIMED_DETONATION_DAMAGE,
                            timestamp: Date.now(),
                            hitType: 'timed_detonation'
                        });
                    }, TIMED_DETONATION_DELAY * 1000);
                }

                scene.remove(a.mesh);
                arrows.splice(i, 1);
                continue;
            }
        }

        // 싱글플레이 더미는 로컬에서 직접 판정한다.
        if (a.isPlayerArrow && !isMultiplayer && dummyTarget && dummyTarget.visible && dummyHp > 0 && !isRoundEnding && !isMatchEnded) {
            const hitCenter = dummyTarget.position.clone().add(new THREE.Vector3(0, 0.15, 0));
            const hitRadius = Math.max(1.5, 1.25 * arrowScale);
            const hitBySweep = segmentIntersectsSphere(previousPos, a.mesh.position, hitCenter, hitRadius);
            if (hitBySweep) {
                playHitSound(true);
                const finalDamage = computeFinalArrowDamage(a);
                dummyHp = Math.max(0, dummyHp - finalDamage);
                if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;

                // 흡혈 화살: 입힌 피해의 40%만큼 즉시 회복
                if (a.isLeech) {
                    playerHp = Math.min(maxPlayerHp, playerHp + finalDamage * LEECH_RATIO);
                    if (playerHpBar) playerHpBar.style.width = `${(playerHp / maxPlayerHp) * 100}%`;
                }

                // BRAWLER: 명중 성공 후 3초간 받는 피해 감소
                if (isBrawler) brawlerTimer = BRAWLER_DURATION;

                // TASTE OF BLOOD: 명중 성공 후 3초간 이동속도 증가 + 소량 흡혈
                if (isTasteOfBlood) {
                    tasteOfBloodTimer = TASTE_OF_BLOOD_DURATION;
                    playerHp = Math.min(maxPlayerHp, playerHp + finalDamage * 0.3);
                    if (playerHpBar) playerHpBar.style.width = `${(playerHp / maxPlayerHp) * 100}%`;
                }

                if (dummyHp <= 0) onDummyKilled();

                // 독화살 명중: 이후 몇 초간 추가 도트 피해를 예약한다
                if (a.isPoison && dummyHp > 0) {
                    poisonTicksLeft = POISON_TICK_COUNT;
                    poisonTimer = POISON_TICK_INTERVAL;
                }

                // 지연 폭발: 0.5초 뒤 추가 피해를 한 번 더 준다
                if (a.isTimedDetonation) {
                    setTimeout(() => {
                        if (isRoundEnding || isMatchEnded || dummyHp <= 0) return;
                        dummyHp = Math.max(0, dummyHp - TIMED_DETONATION_DAMAGE);
                        if (dummyHpBar) dummyHpBar.style.width = `${(dummyHp / dummyMaxHp) * 100}%`;
                        if (dummyHp <= 0) onDummyKilled();
                    }, TIMED_DETONATION_DELAY * 1000);
                }

                // 넉백 화살: 더미를 날아온 방향으로 밀어낸다
                if (a.isKnockback) {
                    const knockDir = a.velocity.clone();
                    knockDir.y = 0;
                    if (knockDir.lengthSq() > 1e-6) {
                        knockDir.normalize();
                        dummyTarget.position.addScaledVector(knockDir, KNOCKBACK_DISTANCE);
                    }
                }

                scene.remove(a.mesh);
                arrows.splice(i, 1);
                continue;
            }
        }

        // 적 화살은 내 캐릭터와 닿으면 시각적으로 제거한다.
        // 실제 데미지/방어 판정은 서버에서 담당한다.
        if (!a.isPlayerArrow) {
            const playerBox = new THREE.Box3().setFromObject(playerBody || player);
            if (segmentIntersectsBox(previousPos, a.mesh.position, playerBox, 0.55)) {
                if (isDefending) {
                    defenseBlockedArrow = true;
                    playHitSound(false);

                    // 반사 방어: 막아낸 화살을 상대방 쪽으로 반사해서 되쏜다
                    if (isReflectDefense) {
                        reflectArrowBack(a);
                    }
                } else if (a.isKnockback) {
                    // 넉백 화살: 방어하지 못하고 맞으면 날아온 방향으로 밀려난다
                    applyKnockbackToPlayer(a.velocity);
                }
                scene.remove(a.mesh);
                arrows.splice(i, 1);
                continue;
            }
        }

        // 마지막으로 맵 장애물을 검사한다.
        let hitObstacle = false;
        const arrowBox = new THREE.Box3().setFromObject(a.mesh);
        for (let obs of mapObstacles) {
            const obsBox = new THREE.Box3().setFromObject(obs);
            if (arrowBox.intersectsBox(obsBox)) {
                if (a.isBouncy && a.bouncesLeft > 0) {
                    const normal = estimateBounceNormal(arrowBox, obsBox);
                    bounceArrow(a, normal);
                    a.mesh.position.addScaledVector(normal, 0.2); // 같은 프레임에 다시 걸리지 않도록 살짝 밀어냄
                } else {
                    playHitSound(false);
                    scene.remove(a.mesh);
                    arrows.splice(i, 1);
                }
                hitObstacle = true;
                break;
            }
        }
        if (hitObstacle) continue;

        if (a.mesh.position.y <= 0.05 || a.life <= 0) {
            if (a.mesh.position.y <= 0.05 && a.life > 0 && a.isBouncy && a.bouncesLeft > 0) {
                bounceArrow(a, new THREE.Vector3(0, 1, 0));
                a.mesh.position.y = 0.06;
            } else {
                scene.remove(a.mesh);
                arrows.splice(i, 1);
            }
        } else {
            a.life -= delta;
        }
    }

    renderer.render(scene, camera);
}