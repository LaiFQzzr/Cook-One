import { runPythonScript } from './python-runner';
import { spawn } from 'child_process';

jest.mock('child_process');

describe('python-runner', () => {
  const mockSpawn = spawn as unknown as jest.Mock;

  beforeEach(() => {
    mockSpawn.mockClear();
  });

  it('should resolve with stdout on success', async () => {
    const mockStdout = { on: jest.fn() };
    const mockStderr = { on: jest.fn() };
    const mockProcess = {
      stdout: mockStdout,
      stderr: mockStderr,
      on: jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 0);
        }
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProcess);

    // 模拟 stdout 数据
    setTimeout(() => {
      const stdoutCb = mockStdout.on.mock.calls.find((c: any[]) => c[0] === 'data')?.[1];
      if (stdoutCb) stdoutCb(Buffer.from('hello world'));
    }, 1);

    const result = await runPythonScript('scripts/test.py');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello world');
  });

  it('should reject on non-zero exit code', async () => {
    const mockStdout = { on: jest.fn() };
    const mockStderr = { on: jest.fn() };
    const mockProcess = {
      stdout: mockStdout,
      stderr: mockStderr,
      on: jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'close') {
          setTimeout(() => cb(1), 0);
        }
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProcess);

    setTimeout(() => {
      const stderrCb = mockStderr.on.mock.calls.find((c: any[]) => c[0] === 'data')?.[1];
      if (stderrCb) stderrCb(Buffer.from('error occurred'));
    }, 1);

    await expect(runPythonScript('scripts/test.py')).rejects.toThrow(
      'Python script failed',
    );
  });

  it('should reject on spawn error', async () => {
    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn().mockImplementation((event: string, cb: any) => {
        if (event === 'error') {
          setTimeout(() => cb(new Error('spawn error')), 0);
        }
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProcess);

    await expect(runPythonScript('scripts/test.py')).rejects.toThrow('spawn error');
  });

  it('should reject on timeout', async () => {
    jest.useFakeTimers();
    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProcess);

    const promise = runPythonScript('scripts/test.py', [], { timeout: 1000 });
    jest.advanceTimersByTime(1500);

    await expect(promise).rejects.toThrow('timed out');
    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    jest.useRealTimers();
  });
});
