import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractJavaScriptCallableName,
  extractPythonCallableName,
} from './resolve-callable.util';
import type { RunCodeResult } from './judge.types';

const PYTHON_RUNNER = `import inspect
import json
import sys
import traceback

import solution


def resolve_callable():
    if hasattr(solution, "Solution"):
        instance = solution.Solution()
        for name, member in inspect.getmembers(instance, predicate=inspect.ismethod):
            if not name.startswith("_"):
                return member

    for name, member in inspect.getmembers(solution, predicate=inspect.isfunction):
        if not name.startswith("_"):
            return member

    raise RuntimeError("No callable solution found")


def call_with_input(fn, input_data):
    signature = inspect.signature(fn)
    params = [
        name
        for name in signature.parameters
        if name != "self"
    ]
    args = [input_data[name] for name in params]
    return fn(*args)


def main():
    try:
        payload = json.load(sys.stdin)
        fn = resolve_callable()
        result = call_with_input(fn, payload["input"])
        print(json.dumps({"ok": True, "result": result}))
    except Exception as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "errorType": "runtime",
                    "message": str(error),
                    "traceback": traceback.format_exc(),
                }
            )
        )


if __name__ == "__main__":
    main()
`;

const JAVASCRIPT_RUNNER = `const fs = require('fs');
const vm = require('vm');

const solutionSource = fs.readFileSync(require('path').join(__dirname, 'solution.js'), 'utf8');
const callableName = __CALLABLE_NAME__;

function resolveCallable(sandbox) {
  if (typeof sandbox.Solution === 'function') {
    const instance = new sandbox.Solution();
    const methodName = Object.getOwnPropertyNames(Object.getPrototypeOf(instance)).find(
      (name) => name !== 'constructor' && typeof instance[name] === 'function',
    );
    if (methodName) {
      return instance[methodName].bind(instance);
    }
  }

  if (typeof sandbox[callableName] === 'function') {
    return sandbox[callableName];
  }

  throw new Error('No callable solution found');
}

function getParamNames(fn) {
  const source = fn.toString();
  const match = source.match(/\\(([^)]*)\\)/);
  if (!match) {
    return [];
  }
  return match[1]
    .split(',')
    .map((part) => part.trim().split('=')[0].trim())
    .filter((name) => name && name !== 'self');
}

function callWithInput(fn, inputData) {
  const params = getParamNames(fn);
  const args = params.map((name) => inputData[name]);
  return fn(...args);
}

function main() {
  try {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
    const sandbox = { module: { exports: {} }, exports: {} };
    sandbox.module.exports = sandbox.exports;
    vm.createContext(sandbox);
    vm.runInContext(solutionSource, sandbox);
    const fn = resolveCallable(sandbox);
    const result = callWithInput(fn, payload.input);
    process.stdout.write(JSON.stringify({ ok: true, result }));
  } catch (error) {
    process.stdout.write(
      JSON.stringify({
        ok: false,
        errorType: 'runtime',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

main();
`;

@Injectable()
export class CodeRunnerService {
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = Number(this.config.get<string>('CODE_RUN_TIMEOUT_MS') ?? 5_000);
  }

  async run(
    language: string,
    code: string,
    input: unknown,
    options?: { timeoutMs?: number },
  ): Promise<RunCodeResult> {
    const normalizedLanguage = this.normalizeLanguage(language);

    if (normalizedLanguage === 'python') {
      return this.runPython(code, input, options?.timeoutMs);
    }

    if (normalizedLanguage === 'javascript') {
      return this.runJavaScript(code, input, options?.timeoutMs);
    }

    return {
      ok: false,
      errorType: 'compilation',
      message: `Unsupported language: ${language}`,
      executionTimeMs: 0,
    };
  }

  private normalizeLanguage(language: string): 'python' | 'javascript' | 'unsupported' {
    const value = language.trim().toLowerCase();
    if (value === 'python' || value === 'py') {
      return 'python';
    }
    if (['javascript', 'js', 'typescript', 'ts', 'node'].includes(value)) {
      return 'javascript';
    }
    return 'unsupported';
  }

  private async runPython(
    code: string,
    input: unknown,
    timeoutMs?: number,
  ): Promise<RunCodeResult> {
    try {
      extractPythonCallableName(code);
    } catch (error) {
      return {
        ok: false,
        errorType: 'compilation',
        message: error instanceof Error ? error.message : 'Invalid Python solution',
        executionTimeMs: 0,
      };
    }

    const startedAt = Date.now();
    const workDir = await mkdtemp(join(tmpdir(), 'judge-python-'));

    try {
      await writeFile(join(workDir, 'solution.py'), code, 'utf8');
      await writeFile(join(workDir, 'runner.py'), PYTHON_RUNNER, 'utf8');

      const execution = await this.spawnProcess(
        'python3',
        ['runner.py'],
        workDir,
        JSON.stringify({ input }),
        timeoutMs,
      );
      const executionTimeMs = Date.now() - startedAt;

      return this.parseRunnerOutput(execution, executionTimeMs);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async runJavaScript(
    code: string,
    input: unknown,
    timeoutMs?: number,
  ): Promise<RunCodeResult> {
    let callableName: string;
    try {
      callableName = extractJavaScriptCallableName(code);
    } catch (error) {
      return {
        ok: false,
        errorType: 'compilation',
        message: error instanceof Error ? error.message : 'Invalid JavaScript solution',
        executionTimeMs: 0,
      };
    }

    const startedAt = Date.now();
    const workDir = await mkdtemp(join(tmpdir(), 'judge-js-'));

    try {
      await writeFile(join(workDir, 'solution.js'), code, 'utf8');
      const runner = JAVASCRIPT_RUNNER.replace(
        '__CALLABLE_NAME__',
        JSON.stringify(callableName),
      );
      await writeFile(join(workDir, 'runner.js'), runner, 'utf8');

      const execution = await this.spawnProcess(
        'node',
        ['runner.js'],
        workDir,
        JSON.stringify({ input }),
        timeoutMs,
      );
      const executionTimeMs = Date.now() - startedAt;

      return this.parseRunnerOutput(execution, executionTimeMs);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private parseRunnerOutput(
    execution: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean },
    executionTimeMs: number,
  ): RunCodeResult {
    if (execution.timedOut) {
      return {
        ok: false,
        errorType: 'timeout',
        message: 'Time limit exceeded',
        executionTimeMs,
      };
    }

    const rawOutput = execution.stdout.trim() || execution.stderr.trim();
    if (!rawOutput) {
      return {
        ok: false,
        errorType: execution.exitCode === 0 ? 'runtime' : 'compilation',
        message: execution.stderr.trim() || 'No output from code runner',
        executionTimeMs,
      };
    }

    try {
      const parsed = JSON.parse(rawOutput) as {
        ok: boolean;
        result?: unknown;
        errorType?: 'compilation' | 'runtime' | 'timeout';
        message?: string;
      };

      if (parsed.ok) {
        return {
          ok: true,
          output: parsed.result,
          executionTimeMs,
        };
      }

      return {
        ok: false,
        errorType: parsed.errorType ?? (execution.exitCode === 0 ? 'runtime' : 'compilation'),
        message: parsed.message ?? 'Runtime error',
        executionTimeMs,
      };
    } catch {
      return {
        ok: false,
        errorType: execution.exitCode === 0 ? 'runtime' : 'compilation',
        message: rawOutput,
        executionTimeMs,
      };
    }
  }

  private spawnProcess(
    command: string,
    args: string[],
    cwd: string,
    stdin: string,
    timeoutMs?: number,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    timedOut: boolean;
  }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { cwd });
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs ?? this.timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
          timedOut: false,
        });
      });
      child.on('close', (exitCode) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode, timedOut });
      });

      child.stdin.write(stdin);
      child.stdin.end();
    });
  }
}
