import crypto from 'node:crypto';
import readline from 'node:readline/promises';

const input = readline.createInterface({ input: process.stdin, output: process.stdout });
const password = await input.question('Admin password: ', { hideEchoBack: true });
await input.close();
if (password.length < 12) throw new Error('密码至少需要12个字符。');
const salt = crypto.randomBytes(16).toString('base64url');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
console.log(`ADMIN_PASSWORD_HASH=${salt}$${hash}`);
