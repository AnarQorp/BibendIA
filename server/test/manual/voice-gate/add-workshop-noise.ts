import { readFile, writeFile } from 'node:fs/promises';

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const targetSnrDb = Number(process.argv[4] ?? 12);
const seed = Number(process.argv[5] ?? 42017) >>> 0;
if (!inputPath || !outputPath || !Number.isFinite(targetSnrDb)) {
  throw new Error('usage: add-workshop-noise.ts input.wav output.wav [snrDb] [seed]');
}

const wav = Buffer.from(await readFile(inputPath));
if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected RIFF/WAVE');
if (wav.readUInt16LE(20) !== 1 || wav.readUInt16LE(22) !== 1 || wav.readUInt16LE(34) !== 16) {
  throw new Error('Expected mono 16-bit PCM');
}
const sampleRate = wav.readUInt32LE(24);
const sampleCount = wav.readUInt32LE(40) / 2;
const samples = new Int16Array(wav.buffer, wav.byteOffset + 44, sampleCount);
const signalRms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / sampleCount);
let state = seed || 1;
const random = () => {
  state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
  return (state >>> 0) / 0xffffffff;
};
const rawNoise = new Float64Array(sampleCount);
for (let i = 0; i < sampleCount; i += 1) {
  const t = i / sampleRate;
  const machineryHum = 0.45 * Math.sin(2 * Math.PI * 97 * t) + 0.25 * Math.sin(2 * Math.PI * 193 * t);
  const broadWorkshopBed = (random() * 2 - 1) * 0.65;
  const periodicToolBurst = (i % (sampleRate * 7) < sampleRate * 0.32) ? (random() * 2 - 1) * 1.4 : 0;
  rawNoise[i] = machineryHum + broadWorkshopBed + periodicToolBurst;
}
const rawNoiseRms = Math.sqrt(rawNoise.reduce((sum, sample) => sum + sample * sample, 0) / sampleCount);
const noiseTargetRms = signalRms / (10 ** (targetSnrDb / 20));
const noiseScale = noiseTargetRms / rawNoiseRms;
let actualNoiseEnergy = 0;
for (let i = 0; i < sampleCount; i += 1) {
  const original = samples[i];
  const noisy = Math.max(-32768, Math.min(32767, Math.round(original + rawNoise[i] * noiseScale)));
  samples[i] = noisy;
  actualNoiseEnergy += (noisy - original) ** 2;
}
await writeFile(outputPath, wav);
const actualNoiseRms = Math.sqrt(actualNoiseEnergy / sampleCount);
process.stdout.write(`${JSON.stringify({ inputPath, outputPath, sampleRate, seed, targetSnrDb, achievedSnrDb: 20 * Math.log10(signalRms / actualNoiseRms) })}\n`);
