const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

// 방 상태 및 매칭 대기열 관리
const roomData = {};
let waitingQueue = []; // 빠른 매칭 대기열 (Queue)

function createPlayerState() {
    return {
        x: 0, y: 1, z: 0, yaw: 0, pitch: 0, hp: 100, maxHp: 100, defending: false, downCount: 0, downed: false,
        // 데미지 위조 방지를 위해 서버가 직접 추적하는 공격 관련 스탯
        statAtkMulti: 1.0,
        hasExplosive: false,
        hasTrickster: false,
        recentHitTimes: [],
        // 자기 자신을 방어하는 카드는 대상(target)이 스스로 신고하는 상태를 서버가 신뢰하고 적용한다
        // (기존 defending 필드와 동일한 신뢰 모델)
        pristineActive: false,
        brawlerActive: false,
        phoenixAvailable: false
    };
}

// 클라이언트의 applyUpgrade()와 동일한 공격력 계수만 서버에도 반영한다.
// (넉백/독화살 등 데미지에 영향 없는 업그레이드는 검증에 필요 없어 생략)
const ATK_MULTIPLIER_BY_UPGRADE = {
    power: 0.75,
    careful_planning: 1.2,
    fastball: 0.15,
    wind_up: 0.6,
    glass_cannon: 1.0
};

// 체력 관련 카드의 최대체력 배율 (클라이언트 applyUpgrade()와 동일한 배율을 곱한다)
const HP_MULTIPLIER_BY_UPGRADE = {
    def_shockwave: 1.4,
    def_electric: 1.3,
    def_explosive: 1.3,
    def_heal: 1.2,
    steady_shot: 1.4,
    tank: 2.0,
    huge: 1.8,
    chase: 1.3,
    phoenix: 0.65
};

function applyUpgradeToServerState(playerState, upg) {
    if (!playerState || !upg || !upg.id) return;
    if (ATK_MULTIPLIER_BY_UPGRADE[upg.id] !== undefined) {
        playerState.statAtkMulti = (playerState.statAtkMulti || 1.0) + ATK_MULTIPLIER_BY_UPGRADE[upg.id];
    }
    if (HP_MULTIPLIER_BY_UPGRADE[upg.id] !== undefined) {
        playerState.maxHp = (playerState.maxHp || 100) * HP_MULTIPLIER_BY_UPGRADE[upg.id];
        playerState.hp = Math.min(playerState.hp, playerState.maxHp);
    }
    if (upg.id === 'explosive_arrow') playerState.hasExplosive = true;
    if (upg.id === 'trickster') playerState.hasTrickster = true;
    if (upg.id === 'glass_cannon') {
        playerState.maxHp = 1;
        playerState.hp = Math.min(playerState.hp, 1);
    }
    if (upg.id === 'phoenix') playerState.phoenixAvailable = true;
}

function getOpponentId(roomId, socketId) {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    return clients.find(id => id !== socketId) || null;
}

io.on('connection', (socket) => {
    console.log(`유저 접속: ${socket.id}`);

    // 대기열 제거 헬퍼 함수
    const removeFromQueue = (socketId) => {
        waitingQueue = waitingQueue.filter(id => id !== socketId);
    };

    // ==========================================
    // 1. 빠른 랜덤 매칭 (Matchmaking)
    // ==========================================
    socket.on('findMatch', () => {
        if (socket.roomId || waitingQueue.includes(socket.id)) return;

        if (waitingQueue.length > 0) {
            const opponentId = waitingQueue.shift();
            const opponentSocket = io.sockets.sockets.get(opponentId);

            if (opponentSocket && opponentSocket.connected) {
                const roomId = 'MATCH_' + Math.random().toString(36).substring(2, 8).toUpperCase();

                socket.join(roomId);
                opponentSocket.join(roomId);

                socket.roomId = roomId;
                opponentSocket.roomId = roomId;

                roomData[roomId] = {
                    hostId: opponentId,
                    scores: {
                        [opponentId]: 0,
                        [socket.id]: 0
                    },
                    players: {
                        [opponentId]: createPlayerState(),
                        [socket.id]: createPlayerState()
                    },
                    isRoundActive: true,
                    roundTimer: null
                };

                io.to(opponentId).emit('gameStarted', { isHost: true, opponentId: socket.id, roomId });
                io.to(socket.id).emit('gameStarted', { isHost: false, opponentId: opponentId, roomId });
                console.log(`[매칭 완료] ${roomId} : ${opponentId} vs ${socket.id}`);
            } else {
                waitingQueue.push(socket.id);
                socket.emit('waitingForMatch');
            }
        } else {
            waitingQueue.push(socket.id);
            socket.emit('waitingForMatch');
            console.log(`[매칭 대기 중...] ${socket.id}`);
        }
    });

    socket.on('cancelMatch', () => {
        removeFromQueue(socket.id);
        socket.emit('matchCancelled');
        console.log(`[매칭 취소] ${socket.id}`);
    });

    // ==========================================
    // 2. 코드 입력형 커스텀 방 (Private Room)
    // ==========================================
    socket.on('createRoom', () => {
        removeFromQueue(socket.id);

        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        socket.join(roomId);
        socket.roomId = roomId;

        roomData[roomId] = {
            hostId: socket.id,
            scores: { [socket.id]: 0 },
            players: { [socket.id]: createPlayerState() },
            isRoundActive: false,
            roundTimer: null
        };

        socket.emit('roomCreated', roomId);
    });

    socket.on('joinRoom', (roomId) => {
        removeFromQueue(socket.id);

        const room = io.sockets.adapter.rooms.get(roomId);
        if (room && room.size === 1 && roomData[roomId]) {
            socket.join(roomId);
            socket.roomId = roomId;
            
            const clients = Array.from(room);
            const hostId = clients[0];
            const joinerId = socket.id;

            roomData[roomId].scores[joinerId] = 0;
            roomData[roomId].players[joinerId] = createPlayerState();
            roomData[roomId].isRoundActive = true;

            socket.emit('roomJoined', roomId);

            io.to(hostId).emit('gameStarted', { isHost: true, opponentId: joinerId, roomId });
            io.to(joinerId).emit('gameStarted', { isHost: false, opponentId: hostId, roomId });
        } else {
            socket.emit('roomError', '방이 가득 찼거나 존재하지 않는 코드입니다.');
        }
    });

    // ==========================================
    // 3. 실시간 위치, 화살, 맵, 강화 동기화
    // ==========================================
    socket.on('playerMovement', (data) => {
        const roomId = socket.roomId;
        const room = roomId ? roomData[roomId] : null;
        if (!room || !room.players[socket.id]) return;

        const p = room.players[socket.id];
        p.x = Number.isFinite(Number(data?.x)) ? Number(data.x) : p.x;
        p.y = Number.isFinite(Number(data?.y)) ? Number(data.y) : p.y;
        p.z = Number.isFinite(Number(data?.z)) ? Number(data.z) : p.z;
        p.yaw = Number.isFinite(Number(data?.yaw)) ? Number(data.yaw) : p.yaw;
        p.pitch = Number.isFinite(Number(data?.pitch)) ? Number(data.pitch) : p.pitch;
        p.defending = !!data?.def;
        p.pristineActive = !!data?.pristine;
        p.brawlerActive = !!data?.brawler;

        socket.to(roomId).emit('opponentMovement', {
            x: p.x, y: p.y, z: p.z,
            yaw: p.yaw, pitch: p.pitch,
            def: p.defending,
            elec: !!data?.elec,
            hp: p.hp,
            downed: p.downed
        });
    });

    socket.on('shootArrow', (data) => {
        if (socket.roomId && roomData[socket.roomId]) {
            socket.to(socket.roomId).emit('opponentShot', data);
        }
    });

    socket.on('mapSync', (mapIndex) => {
        if (socket.roomId && roomData[socket.roomId]) {
            socket.to(socket.roomId).emit('mapSync', mapIndex);
        }
    });

    // SHOCKWAVE 등 "내가 상대를 밀친다" 계열 효과는 상대 본인의 클라이언트가
    // 자기 자신의 위치를 움직여야 실제로 반영되므로, 방향/세기만 그대로 릴레이한다.
    socket.on('applyForce', (data) => {
        if (socket.roomId && roomData[socket.roomId]) {
            socket.to(socket.roomId).emit('forceApplied', data);
        }
    });

    socket.on('upgradeSelected', (upgradeData) => {
        const roomId = socket.roomId;
        const room = roomId ? roomData[roomId] : null;
        if (!room) return;

        // 데미지 검증에 쓰기 위해 서버도 공격자의 스탯 변화를 함께 추적한다.
        applyUpgradeToServerState(room.players[socket.id], upgradeData);
        socket.to(roomId).emit('opponentUpgrade', upgradeData);
    });

    // ==========================================
    // 4. 서버 권위형 피격/방어/다운 판정
    // ==========================================
    socket.on('hitOpponent', (data) => {
        const roomId = socket.roomId;
        const room = roomId ? roomData[roomId] : null;
        if (!room || !room.isRoundActive || !room.players[socket.id]) return;

        const opponentId = getOpponentId(roomId, socket.id);
        if (!opponentId || !room.players[opponentId]) return;

        const attacker = room.players[socket.id];
        const target = room.players[opponentId];
        if (attacker.downed || target.downed) return;

        // [보안 수정 1] 호출 빈도 제한: 실제 화살로는 나올 수 없는 빈도로
        // hitOpponent를 반복 호출해 데미지를 위조하는 것을 막는다.
        // 주의: TRIPLE VOLLEY처럼 화살 여러 발이 "같은 순간"에 동시에 명중하는 정상적인
        // 경우가 있으므로, 단순히 "직전 히트와의 최소 간격"으로 막으면 이런 정상 히트까지
        // 잘려나간다. 그래서 짧은 시간(250ms) 창 안에서 몇 번까지 맞았는지로 판단한다.
        const now = Date.now();
        const HIT_WINDOW_MS = 250;
        const MAX_HITS_PER_WINDOW = 6; // 트리플샷(3발)이나 바라지 연사도 넉넉히 커버
        attacker.recentHitTimes = (attacker.recentHitTimes || []).filter(t => now - t < HIT_WINDOW_MS);
        if (attacker.recentHitTimes.length >= MAX_HITS_PER_WINDOW) {
            return;
        }
        attacker.recentHitTimes.push(now);

        const damage = Number(data?.damage);
        if (!Number.isFinite(damage) || damage <= 0) return;

        // [보안 수정 2] 클라이언트가 보낸 damage를 그대로 믿지 않고,
        // 서버가 알고 있는 공격자의 실제 스탯(statAtkMulti, 폭발 화살 보유 여부) 기준
        // "이론상 나올 수 있는 최대 데미지"를 넘지 못하도록 재검증한다.
        // 기본 화살 데미지 범위: 15 ~ 40 (차징 0~100% 기준) + 폭발 화살 +50 고정
        let theoreticalMaxDamage = 40 * (attacker.statAtkMulti || 1.0);
        if (attacker.hasExplosive) theoreticalMaxDamage += 50;
        // TRICKSTER: 최대 3회 튕김 기준 데미지가 최대 3.4배까지 중첩될 수 있으므로 상한도 함께 늘려준다.
        // (안 그러면 정상적으로 여러 번 튕겨서 쌓인 데미지가 여기서 깎여버린다)
        if (attacker.hasTrickster) theoreticalMaxDamage *= 3.4;
        const marginedMax = theoreticalMaxDamage * 1.15 + 5; // 부동소수점 오차 및 전격 방어 틱 등 예외 케이스 여유분

        let safeDamage = Math.min(Math.max(Math.floor(damage), 1), 200, Math.floor(marginedMax));

        // 방어 판정은 상대 클라이언트가 아니라 서버 상태를 기준으로 한다.
        if (target.defending) {
            socket.emit('hitBlocked', { damage: safeDamage });
            return;
        }

        // PRISTINE PERSEVERANCE: 대상의 체력이 90% 이상일 때 받는 피해 75% 감소
        const targetMaxHp = target.maxHp || 100;
        if (target.pristineActive && target.hp / targetMaxHp >= 0.9) {
            safeDamage = Math.ceil(safeDamage * 0.25);
        }
        // BRAWLER: 명중 성공 후 3초간 받는 피해 66% 감소 (대상이 자기 자신에게 적용 중인 버프)
        if (target.brawlerActive) {
            safeDamage = Math.ceil(safeDamage * (1 - 0.66));
        }

        let newHp = Math.max(0, target.hp - safeDamage);

        // PHOENIX: 이번 매치에서 다운으로 이어지는 첫 피격을 1회 무효화하고 체력 1로 살아남는다.
        if (newHp <= 0 && target.phoenixAvailable) {
            target.phoenixAvailable = false;
            newHp = 1;
        }

        target.hp = newHp;

        socket.emit('hitConfirmed', {
            damage: safeDamage,
            targetHp: target.hp
        });
        io.to(opponentId).emit('takeDamage', {
            damage: safeDamage,
            hp: target.hp,
            timestamp: Date.now()
        });
        socket.to(roomId).emit('opponentHealthSync', {
            playerId: opponentId,
            hp: target.hp
        });

        if (target.hp <= 0) {
            handlePlayerDown(roomId, opponentId);
        }
    });

    function handlePlayerDown(roomId, loserId) {
        const room = roomData[roomId];
        if (!room || !room.players[loserId]) return;

        const loser = room.players[loserId];
        if (loser.downed) return;

        loser.downed = true;
        loser.defending = false;
        loser.hp = 0;
        loser.downCount += 1;

        const winnerId = getOpponentId(roomId, loserId);
        if (!winnerId || !room.players[winnerId]) return;

        io.to(roomId).emit('playerDown', {
            loserId,
            winnerId,
            downCount: loser.downCount,
            loserHp: 0
        });

        // 첫 다운: 점수는 올리지 않고 부활한다.
        if (loser.downCount < 2) {
            setTimeout(() => {
                const current = roomData[roomId];
                if (!current || !current.isRoundActive) return;
                const p = current.players[loserId];
                const opp = current.players[winnerId];
                if (!p || !opp) return;

                p.hp = p.maxHp || 100;
                p.defending = false;
                p.downed = false;

                // 요청사항: 한쪽이 다운되면 다음 교전을 공평하게 다시 시작할 수 있도록
                // 다운된 사람뿐 아니라 상대방 체력도 함께 회복시킨다.
                // (기존엔 다운된 사람만 풀피가 되고 상대는 이전 체력 그대로라 불공평했음)
                opp.hp = opp.maxHp || 100;
                opp.defending = false;

                io.to(roomId).emit('playerRespawned', {
                    loserId: loserId,
                    loserHp: p.hp,
                    winnerId: winnerId,
                    winnerHp: opp.hp
                });
            }, 1200);
            return;
        }

        // 두 번째 다운: 라운드 종료 및 승자 점수 +1
        room.isRoundActive = false;
        room.scores[winnerId] = (room.scores[winnerId] || 0) + 1;

        const winnerScore = room.scores[winnerId];
        const loserScore = room.scores[loserId] || 0;

        if (winnerScore >= 5) {
            io.to(winnerId).emit('matchEnded', {
                result: 'win', myScore: winnerScore, oppScore: loserScore
            });
            io.to(loserId).emit('matchEnded', {
                result: 'lose', myScore: loserScore, oppScore: winnerScore
            });
            if (room.roundTimer) clearTimeout(room.roundTimer);
            delete roomData[roomId];
            return;
        }

        io.to(winnerId).emit('roundEnded', {
            result: 'win', myScore: winnerScore, oppScore: loserScore
        });
        io.to(loserId).emit('roundEnded', {
            result: 'lose', myScore: loserScore, oppScore: winnerScore
        });

        if (room.roundTimer) clearTimeout(room.roundTimer);
        room.roundTimer = setTimeout(() => {
            const current = roomData[roomId];
            if (!current) return;
            current.isRoundActive = true;
            Object.values(current.players).forEach(p => {
                p.hp = p.maxHp || 100;
                p.defending = false;
                p.downed = false;
                p.downCount = 0;
            });
            io.to(roomId).emit('startNewRound', {
                players: Object.fromEntries(Object.entries(current.players).map(([id, p]) => [id, {
                    x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch,
                    hp: p.hp, defending: p.defending, downed: p.downed
                }]))
            });
        }, 8000);
    }

    // ==========================================
    // 5. 접속 해제 및 대기열 정리
    // ==========================================
    socket.on('disconnect', () => {
        console.log(`유저 퇴장: ${socket.id}`);
        removeFromQueue(socket.id);

        const roomId = socket.roomId;
        if (roomId && roomData[roomId]) {
            if (roomData[roomId].roundTimer) {
                clearTimeout(roomData[roomId].roundTimer);
            }
            socket.to(roomId).emit('opponentDisconnected');
            delete roomData[roomId];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Socket.IO 서버 실행 중: 포트 ${PORT}`);
});