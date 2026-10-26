import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const appRoot = process.cwd();
const isWindows = process.platform === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
const androidDir = path.join(appRoot, 'android');
const env = {
  ...process.env,
  PORT: process.env.PORT ?? '23583',
  BASE_PATH: process.env.BASE_PATH ?? '/',
  TRADERMIND_NATIVE: '1',
};

function run(command, args, cwd = appRoot) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: isWindows,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT) {
  console.error(
    'Android SDK was not found. Install Android Studio/SDK and set ANDROID_HOME, or run this build in GitHub Actions.',
  );
  process.exit(1);
}

run(pnpm, ['run', 'build:web']);

if (
  !existsSync(path.join(androidDir, 'gradlew')) &&
  !existsSync(path.join(androidDir, 'gradlew.bat'))
) {
  run(pnpm, ['exec', 'cap', 'add', 'android']);
}

run(pnpm, ['exec', 'cap', 'sync', 'android']);

// همگام‌سازی با نرم‌افزار ویندوز روی شبکه‌ی خانگی/Tailscale با http است؛
// اندروید به‌طور پیش‌فرض http را نمی‌پذیرد، پس در Manifest اجازه‌اش را می‌دهیم.
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
if (existsSync(manifestPath)) {
  const manifest = readFileSync(manifestPath, 'utf8');
  if (!/android:usesCleartextTraffic\s*=/.test(manifest)) {
    writeFileSync(
      manifestPath,
      manifest.replace('<application', '<application\n        android:usesCleartextTraffic="true"'),
    );
    console.info('AndroidManifest: usesCleartextTraffic enabled for local sync.');
  }
}

const gradle = isWindows
  ? path.join(androidDir, 'gradlew.bat')
  : path.join(androidDir, 'gradlew');

run(gradle, ['--no-daemon', 'assembleDebug'], androidDir);

console.info(
  `Android debug APK: ${path.join(androidDir, 'app/build/outputs/apk/debug/app-debug.apk')}`,
);
