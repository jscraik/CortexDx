import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRunner, type CommandOptions } from '../../src/security/command-runner.js';

describe('Security - Command Runner', () => {
  let runner: CommandRunner;

  beforeEach(() => {
    runner = new CommandRunner();
  });

  describe('Command Injection Prevention', () => {
    it('should sanitize shell metacharacters from arguments', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['hello; rm -rf /'],
        timeout: 1000
      };

      // Should execute safely without interpreting semicolon
      const result = await runner.execute(options);

      expect(result.exitCode).toBe(0);
      // The output should contain the literal string, not execute rm
      expect(result.stdout).toContain('hello; rm -rf /');
    });

    it('should reject commands with backticks', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['`whoami`'],
        timeout: 1000
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/dangerous/i);
    });

    it('should reject commands with command substitution', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['$(whoami)'],
        timeout: 1000
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/dangerous/i);
    });

    it('should reject pipe attempts in arguments', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['hello | cat /etc/passwd'],
        timeout: 1000
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/dangerous/i);
    });

    it('should reject redirect attempts', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['data > /tmp/evil'],
        timeout: 1000
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/dangerous/i);
    });

    it('should reject null byte injection', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['hello\x00world'],
        timeout: 1000
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/dangerous|null/i);
    });
  });

  describe('Path Traversal Protection', () => {
    it('should reject path traversal with ../ sequences', async () => {
      const options: CommandOptions = {
        command: 'cat',
        args: ['../../etc/passwd'],
        timeout: 1000,
        allowedPaths: ['/tmp']
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/path.*traversal|not.*allowed/i);
    });

    it('should allow files within allowed paths', async () => {
      const options: CommandOptions = {
        command: 'ls',
        args: ['/tmp'],
        timeout: 1000,
        allowedPaths: ['/tmp']
      };

      const result = await runner.execute(options);
      expect(result.exitCode).toBe(0);
    });

    it('should reject absolute paths outside allowed directories', async () => {
      const options: CommandOptions = {
        command: 'cat',
        args: ['/etc/shadow'],
        timeout: 1000,
        allowedPaths: ['/tmp', '/var/log']
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/not.*allowed/i);
    });

    it('should reject symbolic link traversal', async () => {
      const options: CommandOptions = {
        command: 'cat',
        args: ['/tmp/symlink-to-etc'],
        timeout: 1000,
        allowedPaths: ['/tmp'],
        followSymlinks: false
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/symlink/i);
    });
  });

  describe('Resource Limiting', () => {
    it('should enforce timeout on long-running commands', async () => {
      const options: CommandOptions = {
        command: 'sleep',
        args: ['10'],
        timeout: 100 // 100ms timeout
      };

      const startTime = Date.now();

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/timeout/i);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should timeout quickly
    });

    it('should limit output size to prevent memory exhaustion', async () => {
      const options: CommandOptions = {
        command: 'yes', // Infinite yes command
        args: ['spam'],
        timeout: 100,
        maxOutputSize: 1024 // 1KB max
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/output.*limit|timeout/i);
    });

    it('should enforce maximum argument length', async () => {
      const hugeArg = 'A'.repeat(100000); // 100KB argument

      const options: CommandOptions = {
        command: 'echo',
        args: [hugeArg],
        timeout: 1000,
        maxArgLength: 1024
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/argument.*long/i);
    });
  });

  describe('Command Whitelisting', () => {
    it('should reject commands not in whitelist', async () => {
      const options: CommandOptions = {
        command: 'rm',
        args: ['-rf', '/'],
        timeout: 1000,
        allowedCommands: ['ls', 'cat', 'grep']
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/not.*allowed|whitelist/i);
    });

    it('should allow commands in whitelist', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['hello'],
        timeout: 1000,
        allowedCommands: ['echo', 'ls']
      };

      const result = await runner.execute(options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('hello');
    });
  });

  describe('Environment Variable Sanitization', () => {
    it('should strip dangerous environment variables', async () => {
      const options: CommandOptions = {
        command: 'printenv',
        args: [],
        timeout: 1000,
        env: {
          LD_PRELOAD: '/tmp/evil.so',
          LD_LIBRARY_PATH: '/tmp/evil',
          SAFE_VAR: 'ok'
        }
      };

      const result = await runner.execute(options);

      // Should not contain dangerous env vars
      expect(result.stdout).not.toContain('LD_PRELOAD');
      expect(result.stdout).not.toContain('LD_LIBRARY_PATH');

      // But should contain safe vars
      expect(result.stdout).toContain('SAFE_VAR');
    });

    it('should provide minimal default environment', async () => {
      const options: CommandOptions = {
        command: 'printenv',
        args: [],
        timeout: 1000,
        cleanEnv: true
      };

      const result = await runner.execute(options);

      // Should have minimal env (PATH, HOME, USER)
      expect(result.stdout).toContain('PATH');

      // Should not inherit all parent env vars
      const envLines = result.stdout.split('\n').filter(Boolean);
      expect(envLines.length).toBeLessThan(10);
    });
  });

  describe('Output Sanitization', () => {
    it('should sanitize ANSI escape codes from output', async () => {
      const options: CommandOptions = {
        command: 'echo',
        args: ['\x1b[31mRed Text\x1b[0m'],
        timeout: 1000,
        sanitizeOutput: true
      };

      const result = await runner.execute(options);

      // ANSI codes should be stripped
      expect(result.stdout).not.toContain('\x1b');
      expect(result.stdout).toContain('Red Text');
    });

    it('should detect and warn about binary output', async () => {
      const options: CommandOptions = {
        command: 'cat',
        args: ['/bin/ls'], // Binary file
        timeout: 1000,
        detectBinary: true
      };

      const result = await runner.execute(options);

      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('binary');
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent commands', async () => {
      const options: CommandOptions = {
        command: 'nonexistentcommand12345',
        args: [],
        timeout: 1000
      };

      await expect(async () => {
        await runner.execute(options);
      }).rejects.toThrow(/not found|ENOENT/i);
    });

    it('should capture stderr separately from stdout', async () => {
      const options: CommandOptions = {
        command: 'sh',
        args: ['-c', 'echo stdout; echo stderr >&2'],
        timeout: 1000
      };

      const result = await runner.execute(options);

      expect(result.stdout).toContain('stdout');
      expect(result.stderr).toContain('stderr');
    });

    it('should return non-zero exit codes', async () => {
      const options: CommandOptions = {
        command: 'sh',
        args: ['-c', 'exit 42'],
        timeout: 1000
      };

      const result = await runner.execute(options);

      expect(result.exitCode).toBe(42);
    });
  });

  describe('Audit Logging', () => {
    it('should log all command executions', async () => {
      const logs: string[] = [];

      const runnerWithLogging = new CommandRunner({
        auditLog: (entry) => {
          logs.push(JSON.stringify(entry));
        }
      });

      const options: CommandOptions = {
        command: 'echo',
        args: ['test'],
        timeout: 1000
      };

      await runnerWithLogging.execute(options);

      expect(logs.length).toBe(1);
      expect(logs[0]).toContain('echo');
      expect(logs[0]).toContain('test');
    });

    it('should log security violations', async () => {
      const violations: string[] = [];

      const runnerWithLogging = new CommandRunner({
        securityLog: (violation) => {
          violations.push(JSON.stringify(violation));
        }
      });

      const options: CommandOptions = {
        command: 'echo',
        args: ['$(whoami)'],
        timeout: 1000
      };

      try {
        await runnerWithLogging.execute(options);
      } catch (error) {
        // Expected to throw
      }

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toContain('injection');
    });
  });
});
