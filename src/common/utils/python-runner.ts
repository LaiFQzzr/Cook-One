import { spawn } from 'child_process';
import { Logger } from '@nestjs/common';
import * as path from 'path';

const logger = new Logger('PythonRunner');

export interface PythonResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * 运行 Python 脚本
 * @param scriptPath 脚本相对路径（基于项目根目录）
 * @param args 传递给脚本的参数
 * @param options 可选配置
 */
export function runPythonScript(
  scriptPath: string,
  args: string[] = [],
  options?: {
    cwd?: string;
    timeout?: number;
  },
): Promise<PythonResult> {
  return new Promise((resolve, reject) => {
    const cwd = options?.cwd || process.cwd();
    const fullScriptPath = path.resolve(cwd, scriptPath);

    logger.log(`Running: python "${fullScriptPath}" ${args.join(' ')}`);

    const pythonProcess = spawn('python', [fullScriptPath, ...args], {
      cwd,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      chunk.split('\n').forEach((line: string) => {
        if (line.trim()) logger.log(`[PY] ${line.trim()}`);
      });
    });

    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      chunk.split('\n').forEach((line: string) => {
        if (line.trim()) logger.warn(`[PY] ${line.trim()}`);
      });
    });

    pythonProcess.on('close', (exitCode) => {
      logger.log(`Python script exited with code ${exitCode}`);
      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode: exitCode ?? 0 });
      } else {
        reject(
          new Error(
            `Python script failed with exit code ${exitCode}. stderr: ${stderr}`,
          ),
        );
      }
    });

    pythonProcess.on('error', (error) => {
      logger.error(`Failed to start Python script: ${error.message}`);
      reject(error);
    });

    if (options?.timeout) {
      setTimeout(() => {
        pythonProcess.kill('SIGTERM');
        reject(new Error(`Python script timed out after ${options.timeout}ms`));
      }, options.timeout);
    }
  });
}
