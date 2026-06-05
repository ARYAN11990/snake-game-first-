/**
 * AUDIO SYSTEM
 */
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.9;
        this.masterGain.connect(this.ctx.destination);
    }

    init() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playTone(freq, type, duration, slide = 0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slide !== 0) osc.frequency.linearRampToValueAtTime(freq + slide, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEat() {
        this.playTone(600 + Math.random() * 200, 'sine', 0.1);
    }

    playBoost() {
        this.playTone(150, 'sawtooth', 0.15, -50);
    }

    playPowerup() {
        this.playTone(1000, 'square', 0.3, 500);
    }

    playExplosion() {
        this.playTone(100, 'sawtooth', 0.5, -80);
    }

    playDie() {
        this.playTone(100, 'sawtooth', 0.4, -80);
        setTimeout(() => this.playTone(80, 'square', 0.4, -60), 50);
    }
}

const audio = new SoundManager();
window.addEventListener('click', () => audio.init(), { once: true });
window.addEventListener('keydown', () => audio.init(), { once: true });

/**
 * CONFIG
 */
const CONFIG = {
    worldSize: 3000,
    speed: 240,
    boost: 500,
    botCount: 20,
    colors: [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0x00FFFF, 0xFF00FF]
};

/**
 * SNAKE CLASS
 */
class Snake {
    constructor(scene, x, y, color, isPlayer) {
        this.scene = scene;
        this.isPlayer = isPlayer;
        this.alive = true;
        this.headPos = new Phaser.Math.Vector2(x, y);
        this.angle = Math.random() * Math.PI * 2;
        this.speed = CONFIG.speed;
        this.segments = [];
        this.history = [];
        this.color = color;
        this.magnetRadius = 50;

        this.head = scene.add.circle(x, y, 20, color);
        this.head.setDepth(10);
        scene.physics.add.existing(this.head);
        this.head.body.setCircle(20);

        this.eyeL = scene.add.circle(0, 0, 7, 0xffffff);
        this.eyeR = scene.add.circle(0, 0, 7, 0xffffff);
        this.pupilL = scene.add.circle(0, 0, 3, 0x000000);
        this.pupilR = scene.add.circle(0, 0, 3, 0x000000);
        this.eyeL.setDepth(11);
        this.eyeR.setDepth(11);
        this.pupilL.setDepth(12);
        this.pupilR.setDepth(12);

        this.grow(15);
    }

    grow(amount) {
        for (let i = 0; i < amount; i++) {
            let seg = this.scene.add.circle(this.headPos.x, this.headPos.y, 16, this.color);
            seg.setAlpha(0.8);
            seg.setDepth(5);
            this.segments.push(seg);
        }
        if (this.isPlayer) {
            this.updateScore();
            audio.playEat();
        }
    }

    shrink() {
        if (this.segments.length > 5) {
            let seg = this.segments.pop();
            this.scene.spawnFood(seg.x, seg.y, 2, this.color);
            seg.destroy();
            if (this.isPlayer) this.updateScore();
        }
    }

    updateScore() {
        document.getElementById('score').innerText = (this.segments.length - 15) * 10;
    }

    update(time, delta) {
        if (!this.alive) return;

        const v = new Phaser.Math.Vector2();
        this.scene.physics.velocityFromRotation(this.angle, this.speed * (delta / 1000), v);
        this.headPos.add(v);

        this.headPos.x = Phaser.Math.Clamp(this.headPos.x, 20, CONFIG.worldSize - 20);
        this.headPos.y = Phaser.Math.Clamp(this.headPos.y, 20, CONFIG.worldSize - 20);

        this.head.setPosition(this.headPos.x, this.headPos.y);
        const angle = this.angle;
        this.eyeL.setPosition(this.headPos.x + Math.cos(angle - 0.6) * 12, this.headPos.y + Math.sin(angle - 0.6) * 12);
        this.eyeR.setPosition(this.headPos.x + Math.cos(angle + 0.6) * 12, this.headPos.y + Math.sin(angle + 0.6) * 12);
        this.pupilL.setPosition(this.eyeL.x + Math.cos(angle) * 4, this.eyeL.y + Math.sin(angle) * 4);
        this.pupilR.setPosition(this.eyeR.x + Math.cos(angle) * 4, this.eyeR.y + Math.sin(angle) * 4);

        if (this.history.length === 0 || Phaser.Math.Distance.Between(this.headPos.x, this.headPos.y, this.history[0].x, this.history[0].y) > 2) {
            this.history.unshift({ x: this.headPos.x, y: this.headPos.y });
        }
        const maxHistory = this.segments.length * 8 + 20;
        if (this.history.length > maxHistory) this.history.length = maxHistory;

        let spacing = Math.max(3, Math.floor(8 * (CONFIG.speed / this.speed)));
        for (let i = 0; i < this.segments.length; i++) {
            let index = (i + 1) * spacing;
            let pos = this.history[Math.min(index, this.history.length - 1)] || this.headPos;
            this.segments[i].setPosition(pos.x, pos.y);
        }
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.head.destroy();
        this.eyeL.destroy();
        this.eyeR.destroy();
        this.pupilL.destroy();
        this.pupilR.destroy();

        this.segments.forEach((s, i) => {
            if (i % 2 === 0) this.scene.spawnFood(s.x, s.y, 5, this.color);
            s.destroy();
        });

        if (this.isPlayer) {
            audio.playDie();
            document.getElementById('restart-container').style.display = 'block';
        } else {
            this.scene.time.delayedCall(1000, () => this.scene.spawnBot());
        }
    }
}

/**
 * MAIN SCENE
 */
class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
    }

    create() {
        this.add.grid(CONFIG.worldSize / 2, CONFIG.worldSize / 2, CONFIG.worldSize, CONFIG.worldSize, 50, 50, 0x1a1a1a, 1, 0x333333, 0.5);
        this.physics.world.setBounds(0, 0, CONFIG.worldSize, CONFIG.worldSize);

        this.foods = this.physics.add.group();
        this.powerups = this.physics.add.group();
        this.snakes = [];
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,RIGHT,DOWN,SPACE');

        this.player = new Snake(this, CONFIG.worldSize / 2, CONFIG.worldSize / 2, 0x00FF00, true);
        this.snakes.push(this.player);

        for (let i = 0; i < CONFIG.botCount; i++) this.spawnBot();

        for (let i = 0; i < 400; i++) this.spawnFood(Phaser.Math.Between(0, CONFIG.worldSize), Phaser.Math.Between(0, CONFIG.worldSize));

        this.time.addEvent({ delay: 5000, callback: this.spawnRandomPowerup, callbackScope: this, loop: true });

        this.cameras.main.startFollow(this.player.head);
        this.cameras.main.setZoom(0.8);
        this.cameras.main.setBackgroundColor('#111');
    }

    spawnBot() {
        if (this.snakes.length > CONFIG.botCount + 2) return;
        let x = Phaser.Math.Between(100, CONFIG.worldSize - 100);
        let y = Phaser.Math.Between(100, CONFIG.worldSize - 100);
        let color = CONFIG.colors[Phaser.Math.Between(0, CONFIG.colors.length - 1)];
        this.snakes.push(new Snake(this, x, y, color, false));
    }

    spawnFood(x, y, value = 1, color = null) {
        let c = color || CONFIG.colors[Phaser.Math.Between(0, CONFIG.colors.length - 1)];
        let f = this.add.circle(x, y, value > 1 ? 12 : 8, c);
        this.physics.add.existing(f);
        f.body.setCircle(value > 1 ? 12 : 8);
        f.value = value;
        this.foods.add(f);
    }

    spawnRandomPowerup() {
        const types = [
            { type: 'MAGNET', color: 0x0000FF, letter: 'M' },
            { type: 'GROW', color: 0x00FF00, letter: 'G' },
            { type: 'BOMB', color: 0xFF0000, letter: 'B' }
        ];
        const pData = types[Phaser.Math.Between(0, types.length - 1)];
        const x = Phaser.Math.Between(100, CONFIG.worldSize - 100);
        const y = Phaser.Math.Between(100, CONFIG.worldSize - 100);

        const container = this.add.container(x, y);
        const circle = this.add.circle(0, 0, 20, pData.color);
        const text = this.add.text(0, 0, pData.letter, { fontSize: '20px', fontStyle: 'bold', color: '#FFF' }).setOrigin(0.5);

        container.add([circle, text]);
        this.physics.add.existing(container);
        container.body.setCircle(20);

        container.pType = pData.type;
        this.powerups.add(container);

        this.tweens.add({
            targets: container,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 600,
            yoyo: true,
            repeat: -1
        });
    }

    triggerBomb(x, y) {
        audio.playExplosion();
        const wave = this.add.circle(x, y, 10, 0xFF0000, 0.4);
        this.tweens.add({
            targets: wave,
            scaleX: 30,
            scaleY: 30,
            alpha: 0,
            duration: 500,
            onComplete: () => wave.destroy()
        });

        this.snakes.forEach(s => {
            if (!s.isPlayer && s.alive) {
                if (Phaser.Math.Distance.Between(x, y, s.headPos.x, s.headPos.y) < 600) {
                    s.die();
                }
            }
        });
    }

    update(time, delta) {
        if (this.player.alive) {
            let turn = 0;
            if (this.keys.A.isDown || this.keys.LEFT.isDown) turn = -1;
            if (this.keys.D.isDown || this.keys.RIGHT.isDown) turn = 1;

            if (turn !== 0) {
                this.player.angle += 0.1 * turn;
            } else {
                let m = this.input.activePointer;
                if (this.input.manager.activePointer.isDown || Math.abs(m.x - m.prevPosition.x) > 0 || Math.abs(m.y - m.prevPosition.y) > 0) {
                    let wp = this.cameras.main.getWorldPoint(m.x, m.y);
                    let target = Phaser.Math.Angle.Between(this.player.headPos.x, this.player.headPos.y, wp.x, wp.y);
                    this.player.angle = Phaser.Math.Angle.RotateTo(this.player.angle, target, 0.1);
                }
            }

            if (this.keys.W.isDown || this.keys.SPACE.isDown || this.input.activePointer.isDown) {
                this.player.speed = CONFIG.boost;
                if (time % 100 < 20) {
                    this.player.shrink();
                    audio.playBoost();
                }
            } else {
                this.player.speed = CONFIG.speed;
            }

            if (this.player.magnetRadius > 50) {
                this.foods.getChildren().forEach(f => {
                    if (Phaser.Math.Distance.Between(this.player.headPos.x, this.player.headPos.y, f.x, f.y) < this.player.magnetRadius) {
                        this.physics.moveToObject(f, this.player.head, 600);
                    }
                });
            }
        }

        this.snakes.forEach(s => {
            if (!s.alive) return;
            if (!s.isPlayer) {
                s.aiTimer = (s.aiTimer || 0) - delta;
                if (s.aiTimer <= 0) {
                    s.aiTimer = Phaser.Math.Between(500, 1500);
                    s.targetAngle = s.angle + Phaser.Math.FloatBetween(-1.5, 1.5);
                }
                if (this.player.alive && Phaser.Math.Distance.Between(s.headPos.x, s.headPos.y, this.player.headPos.x, this.player.headPos.y) < 300) {
                    s.targetAngle = Phaser.Math.Angle.Between(s.headPos.x, s.headPos.y, this.player.headPos.x, this.player.headPos.y) + Math.PI;
                }
                s.angle = Phaser.Math.Angle.RotateTo(s.angle, s.targetAngle || s.angle, 0.05);
            }
            s.update(time, delta);
        });

        if (!this.player.alive) return;

        this.physics.overlap(this.player.head, this.foods, (h, f) => {
            this.player.grow(f.value);
            f.destroy();
            if (Math.random() > 0.8) this.spawnFood(Phaser.Math.Between(0, CONFIG.worldSize), Phaser.Math.Between(0, CONFIG.worldSize));
        });

        this.physics.overlap(this.player.head, this.powerups, (h, p) => {
            audio.playPowerup();

            if (p.pType === 'MAGNET') {
                this.player.magnetRadius = 400;
                this.time.delayedCall(5000, () => this.player.magnetRadius = 50);
            } else if (p.pType === 'GROW') {
                this.player.grow(10);
            } else if (p.pType === 'BOMB') {
                this.triggerBomb(this.player.headPos.x, this.player.headPos.y);
            }

            p.destroy();
        });

        this.snakes.forEach(s => {
            if (!s.alive) return;
            if (s !== this.player) {
                s.segments.forEach(seg => {
                    if (Phaser.Math.Distance.Between(this.player.head.x, this.player.head.y, seg.x, seg.y) < 25) {
                        this.player.die();
                    }
                });
                this.player.segments.forEach(seg => {
                    if (Phaser.Math.Distance.Between(s.head.x, s.head.y, seg.x, seg.y) < 25) {
                        s.die();
                    }
                });
            }
        });

        const ctx = document.getElementById('minimap').getContext('2d');
        ctx.clearRect(0, 0, 150, 150);
        const scale = 150 / CONFIG.worldSize;
        this.snakes.forEach(s => {
            if (s.alive) {
                ctx.fillStyle = s.isPlayer ? '#0f0' : '#f00';
                ctx.beginPath();
                ctx.arc(s.headPos.x * scale, s.headPos.y * scale, s.isPlayer ? 4 : 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#111',
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [MainScene]
};

const game = new Phaser.Game(config);
window.addEventListener('resize', () => game.scale.resize(window.innerWidth, window.innerHeight));
