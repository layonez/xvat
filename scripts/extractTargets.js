import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const warmupsPath = path.resolve(__dirname, '../src/warmups.json');
const outputPath = path.resolve(__dirname, '../dist/targets.json');

try {
  const warmupsData = JSON.parse(fs.readFileSync(warmupsPath, 'utf-8'));

  const allTargets = new Set();

  warmupsData.forEach((warmup) => {
    if (Array.isArray(warmup.target)) {
      warmup.target.forEach((target) => allTargets.add(target));
    }
  });

  const distinctTargets = Array.from(allTargets);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(distinctTargets, null, 2));

  console.log('Distinct targets extracted successfully:', distinctTargets);
} catch (error) {
  console.error('Error extracting targets:', error);
}
