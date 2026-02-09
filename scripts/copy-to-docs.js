const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'public');
const destDir = path.resolve(__dirname, '..', 'docs');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(item => {
      copyRecursive(path.join(src, item), path.join(dest, item));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  copyRecursive(srcDir, destDir);
  console.log('Public files copied to docs/ successfully.');
} catch (err) {
  console.error('Error copying files:', err.message);
  process.exit(1);
}
