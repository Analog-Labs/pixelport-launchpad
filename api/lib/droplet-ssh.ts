import { Client as SSHClient } from 'ssh2';

const SSH_PRIVATE_KEY = process.env.SSH_PRIVATE_KEY?.replace(/\\n/g, '\n');

export function sshExec(host: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!SSH_PRIVATE_KEY) {
      reject(new Error('SSH_PRIVATE_KEY env var is not set'));
      return;
    }

    const conn = new SSHClient();
    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH connection timeout (30s)'));
    }, 30_000);

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          conn.end();
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';

        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          conn.end();

          if (code !== 0) {
            reject(new Error(`SSH command failed (code ${code}): ${stderr.trim()}`));
            return;
          }

          resolve(stdout);
        });
      });
    });

    conn.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    conn.connect({
      host,
      port: 22,
      username: 'root',
      privateKey: SSH_PRIVATE_KEY,
      readyTimeout: 15_000,
    });
  });
}
