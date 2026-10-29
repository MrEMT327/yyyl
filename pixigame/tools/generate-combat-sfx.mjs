import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 48000;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'assets/sound');

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function softClip(sample, drive = 2) {
  return Math.tanh(sample * drive) / Math.tanh(drive);
}

function makeShot(duration = 0.32) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(0x5f3759df);
  let phase = 0;
  let previousNoise = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const ratio = time / duration;
    const frequency = 1750 * Math.pow(0.13, ratio) + 125;
    phase += (Math.PI * 2 * frequency) / SAMPLE_RATE;
    const body = (Math.sin(phase) * 0.68 + Math.sin(phase * 0.49) * 0.18) * Math.exp(-time * 19);
    const rawNoise = noise();
    const click = (rawNoise - previousNoise * 0.76) * Math.exp(-time * 105) * 0.72;
    previousNoise = rawNoise;
    const tail = noise() * Math.exp(-time * 31) * 0.16;
    const fade = Math.min(1, (duration - time) / 0.03);
    samples[index] = softClip((body + click + tail) * fade, 2.25) * 0.82;
  }
  return samples;
}

function makeExplosion(duration = 0.86) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(0xc0ffee);
  let lowNoise = 0;
  let rumblePhase = 0;
  let debrisPhase = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const ratio = time / duration;
    const rawNoise = noise();
    lowNoise += (rawNoise - lowNoise) * 0.07;
    rumblePhase += (Math.PI * 2 * (118 * Math.pow(0.25, ratio) + 23)) / SAMPLE_RATE;
    debrisPhase += (Math.PI * 2 * (370 - ratio * 225)) / SAMPLE_RATE;
    const impact = (rawNoise * 0.48 + lowNoise * 1.6) * Math.exp(-time * 7.2);
    const boom = Math.sin(rumblePhase) * Math.exp(-time * 3.5) * 0.9;
    const debris = Math.sin(debrisPhase) * noise() * Math.exp(-time * 8.8) * 0.25;
    const crack = time < 0.06 ? (rawNoise - lowNoise) * Math.exp(-time * 44) : 0;
    const fade = Math.min(1, (duration - time) / 0.08);
    samples[index] = softClip((impact + boom + debris + crack) * fade, 2.55) * 0.8;
  }
  return samples;
}

function mixInto(target, source, gain = 1, offsetSeconds = 0) {
  const offset = Math.max(0, Math.floor(offsetSeconds * SAMPLE_RATE));
  for (let index = 0; index < source.length; index += 1) {
    const targetIndex = index + offset;
    if (targetIndex >= target.length) break;
    target[targetIndex] += source[index] * gain;
  }
}

function makeBossWarning(duration = 1.1) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(0xb055a11);
  let sirenPhase = 0;
  let pulsePhase = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const cycle = time % 0.42;
    const sirenFreq = cycle < 0.19 ? 820 - cycle * 920 : 660 + (cycle - 0.19) * 640;
    sirenPhase += (Math.PI * 2 * sirenFreq) / SAMPLE_RATE;
    pulsePhase += (Math.PI * 2 * 146) / SAMPLE_RATE;
    const envelope = cycle < 0.22 ? 1 : Math.max(0, 1 - (cycle - 0.22) / 0.2);
    const siren = (Math.sin(sirenPhase) * 0.55 + Math.sin(sirenPhase * 0.5) * 0.16) * envelope;
    const pulse = Math.sin(pulsePhase) * Math.exp(-(cycle * 5.6)) * 0.42;
    const hiss = noise() * 0.06 * envelope;
    const fade = Math.min(1, (duration - time) / 0.08);
    samples[index] = softClip((siren + pulse + hiss) * fade, 2.1) * 0.82;
  }
  return samples;
}

function makeBossSpawn(duration = 1.45) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(0xb0555eed);
  let lowPhase = 0;
  let midPhase = 0;
  let sweep = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const ratio = time / duration;
    lowPhase += (Math.PI * 2 * (92 * Math.pow(0.58, ratio) + 28)) / SAMPLE_RATE;
    midPhase += (Math.PI * 2 * (180 + ratio * 90)) / SAMPLE_RATE;
    sweep += (Math.PI * 2 * (360 * Math.pow(1.9, ratio))) / SAMPLE_RATE;
    const impact = noise() * Math.exp(-time * 14) * 0.3;
    const rumble = (Math.sin(lowPhase) * 0.95 + Math.sin(lowPhase * 0.49) * 0.24) * Math.exp(-time * 2.2);
    const body = Math.sin(midPhase) * Math.exp(-time * 3.2) * 0.26;
    const rise = Math.sin(sweep) * Math.exp(-Math.max(0, time - 0.18) * 5.2) * 0.12;
    const fade = Math.min(1, (duration - time) / 0.12);
    samples[index] = softClip((impact + rumble + body + rise) * fade, 2.4) * 0.86;
  }
  return samples;
}

function makeBossPhase(duration = 1.25, finalForm = false) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(finalForm ? 0xfa113333 : 0xface2222);
  let lowPhase = 0;
  let risePhase = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const ratio = time / duration;
    lowPhase += (Math.PI * 2 * ((finalForm ? 106 : 128) - ratio * 18)) / SAMPLE_RATE;
    risePhase += (Math.PI * 2 * ((finalForm ? 260 : 210) + ratio * (finalForm ? 760 : 460))) / SAMPLE_RATE;
    const clank = noise() * Math.exp(-time * (finalForm ? 18 : 14)) * 0.24;
    const charge = Math.sin(risePhase) * Math.pow(Math.min(1, ratio * 1.35), 1.4) * 0.28;
    const core = (Math.sin(lowPhase) * 0.62 + Math.sin(lowPhase * 1.97) * 0.12) * Math.exp(-time * 2.8);
    const crackle = ratio > 0.4 ? noise() * (ratio - 0.4) * 0.09 : 0;
    const fade = Math.min(1, (duration - time) / 0.1);
    samples[index] = softClip((clank + charge + core + crackle) * fade, finalForm ? 2.8 : 2.35) * 0.84;
  }
  return samples;
}

function makeBossFire(duration = 0.34) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(0xb055f1ae);
  let phase = 0;
  let tailPhase = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const ratio = time / duration;
    const frequency = 320 * Math.pow(1.7, ratio) + 130;
    phase += (Math.PI * 2 * frequency) / SAMPLE_RATE;
    tailPhase += (Math.PI * 2 * (820 * Math.pow(0.3, ratio) + 70)) / SAMPLE_RATE;
    const body = Math.sin(phase) * Math.exp(-time * 10.5) * 0.72;
    const bite = noise() * Math.exp(-time * 22) * 0.2;
    const tail = Math.sin(tailPhase) * Math.exp(-time * 18) * 0.18;
    const fade = Math.min(1, (duration - time) / 0.04);
    samples[index] = softClip((body + bite + tail) * fade, 2.15) * 0.84;
  }
  return samples;
}

function makeBossDeath(duration = 2.4) {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));
  const noise = seededNoise(0xdeadfa11);
  let lowPhase = 0;
  let shriekPhase = 0;
  let tailNoise = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / SAMPLE_RATE;
    const ratio = time / duration;
    lowPhase += (Math.PI * 2 * (86 * Math.pow(0.45, ratio) + 16)) / SAMPLE_RATE;
    shriekPhase += (Math.PI * 2 * (220 + ratio * 980)) / SAMPLE_RATE;
    const rawNoise = noise();
    tailNoise += (rawNoise - tailNoise) * 0.05;
    const boom = (Math.sin(lowPhase) * 1.1 + tailNoise * 0.62) * Math.exp(-time * 1.85);
    const shriek = Math.sin(shriekPhase) * Math.exp(-Math.max(0, time - 0.16) * 2.8) * 0.14;
    const debris = rawNoise * Math.exp(-time * 4.6) * 0.26;
    const fade = Math.min(1, (duration - time) / 0.2);
    samples[index] = softClip((boom + shriek + debris) * fade, 2.9) * 0.88;
  }
  mixInto(samples, makeExplosion(0.92), 0.52, 0.0);
  mixInto(samples, makeExplosion(0.76), 0.36, 0.34);
  mixInto(samples, makeExplosion(0.68), 0.28, 0.72);
  return samples;
}

function writeWav(file, samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  samples.forEach((sample, index) => {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  });
  fs.writeFileSync(file, buffer);
}

fs.mkdirSync(outputDir, { recursive: true });
writeWav(path.join(outputDir, 'player-shot.wav'), makeShot());
writeWav(path.join(outputDir, 'enemy-explosion.wav'), makeExplosion());
writeWav(path.join(outputDir, 'boss-warning.wav'), makeBossWarning());
writeWav(path.join(outputDir, 'boss-spawn.wav'), makeBossSpawn());
writeWav(path.join(outputDir, 'boss-phase-2.wav'), makeBossPhase(1.18, false));
writeWav(path.join(outputDir, 'boss-phase-3.wav'), makeBossPhase(1.36, true));
writeWav(path.join(outputDir, 'boss-fire.wav'), makeBossFire());
writeWav(path.join(outputDir, 'boss-death.wav'), makeBossDeath());
console.log('Generated combat SFX assets');
