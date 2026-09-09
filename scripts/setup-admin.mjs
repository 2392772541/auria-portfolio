import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';

if (!process.stdin.isTTY) throw new Error('请在本机交互终端运行，密码不要放进命令行。');
const input = readline.createInterface({input: process.stdin, output: process.stdout});
const email = (await input.question('管理员邮箱: ')).trim().toLowerCase();
input.close();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('邮箱格式无效');
function hidden(prompt) {
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {process.stdin.off('data', onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');};
    function onData(data) {
      for (const char of data.toString('utf8')) {
        if (char === '\u0003') {finish();reject(new Error('已取消'));return;}
        if (char === '\r' || char === '\n') {finish();resolve(value);return;}
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    process.stdin.on('data', onData);
  });
}
const password = await hidden('新密码（至少12位，输入不显示）: ');
if (password.length < 12) throw new Error('密码至少12位');
if (password !== await hidden('再次输入密码: ')) throw new Error('两次密码不一致');
const salt = crypto.randomBytes(16).toString('base64url');
const hash = `${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, '.env');
let env = fs.readFileSync(fs.existsSync(envPath) ? envPath : path.join(root, '.env.example'), 'utf8');
for (const [key, value] of Object.entries({ADMIN_EMAIL: email, ADMIN_PASSWORD_HASH: hash})) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env) ? env.replace(pattern, () => `${key}=${value}`) : env + `\n${key}=${value}\n`;
}
fs.writeFileSync(envPath, env, {mode: 0o600});
console.log('管理员已配置到本机 .env（Git 忽略）。重启服务后生效。');
