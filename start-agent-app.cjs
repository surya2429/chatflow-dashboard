// Launcher: starts Expo web from the mobile app directory
const { spawn } = require('child_process')
const path = require('path')

const appDir = path.resolve(__dirname, '..', 'chatflow-agent-app')

// On Windows, run via cmd.exe so .cmd scripts work
const child = spawn('cmd.exe', ['/c', 'npx', 'expo', 'start', '--web', '--port', '8082'], {
  cwd: appDir,
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, CI: '1', EXPO_NO_DOTENV: '1' }
})

child.on('error', err => { console.error('Failed to start:', err); process.exit(1) })
child.on('exit', code => process.exit(code || 0))
