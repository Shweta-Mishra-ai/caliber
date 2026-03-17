import { spawn, execSync, type ChildProcess } from 'node:child_process';
import readline from 'node:readline';
import type { LLMProvider, LLMCallOptions, LLMStreamOptions, LLMStreamCallbacks, LLMConfig } from './types.js';

const ACP_AGENT_BIN = 'agent';
const IS_WINDOWS = process.platform === 'win32';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Cursor provider that uses the Cursor Agent via ACP (Agent Client Protocol).
 * Maintains a persistent connection — spawns once, reuses across all calls.
 * Uses the user's current Cursor subscription — no API key required if `agent login` was run.
 * See https://cursor.com/docs/cli/acp
 */
export class CursorAcpProvider implements LLMProvider {
  private defaultModel: string;
  private cursorApiKey?: string;

  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private pending = new Map<number, PendingCall>();
  private nextId = 1;
  private connectPromise: Promise<void> | null = null;
  private activeCallbacks: LLMStreamCallbacks | null = null;
  private shutdownRequested = false;

  constructor(config: LLMConfig) {
    this.defaultModel = config.model || 'auto';
    this.cursorApiKey = process.env.CURSOR_API_KEY ?? process.env.CURSOR_AUTH_TOKEN;

    process.once('exit', () => this.shutdown());
  }

  async call(options: LLMCallOptions): Promise<string> {
    const chunks: string[] = [];
    await this.runPrompt(options, {
      onText: (text) => chunks.push(text),
      onEnd: () => {},
      onError: () => {},
    });
    return chunks.join('');
  }

  async stream(options: LLMStreamOptions, callbacks: LLMStreamCallbacks): Promise<void> {
    await this.runPrompt(options, callbacks);
  }

  shutdown(): void {
    this.shutdownRequested = true;
    if (this.child) {
      this.child.stdin?.end();
      this.child.kill('SIGTERM');
      this.child = null;
    }
    this.rl = null;
    this.connectPromise = null;
  }

  // -- Connection management --------------------------------------------------

  private async ensureConnection(): Promise<void> {
    if (this.child && !this.child.killed) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connect();
    try {
      await this.connectPromise;
    } catch (err) {
      this.connectPromise = null;
      throw err;
    }
  }

  private async connect(): Promise<void> {
    const args = ['acp'];
    if (this.cursorApiKey) {
      args.unshift('--api-key', this.cursorApiKey);
    }

    this.child = spawn(ACP_AGENT_BIN, args, {
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd: process.cwd(),
      env: { ...process.env, ...(this.cursorApiKey && { CURSOR_API_KEY: this.cursorApiKey }) },
      ...(IS_WINDOWS && { shell: true }),
    });

    this.rl = readline.createInterface({ input: this.child.stdout!, crlfDelay: Infinity });
    this.rl.on('line', (line) => this.handleLine(line));

    this.child.on('error', (err) => {
      for (const w of this.pending.values()) w.reject(err);
      this.pending.clear();
      this.activeCallbacks?.onError(err);
    });

    this.child.on('close', () => {
      if (!this.shutdownRequested) {
        const err = new Error('Cursor agent process exited unexpectedly');
        for (const w of this.pending.values()) w.reject(err);
        this.pending.clear();
        this.activeCallbacks?.onError(err);
      }
      this.child = null;
      this.rl = null;
      this.connectPromise = null;
    });

    await this.send('initialize', {
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
      clientInfo: { name: 'caliber', version: '1.0.0' },
    });
    await this.send('authenticate', { methodId: 'cursor_login' });
  }

  // -- JSON-RPC ---------------------------------------------------------------

  private send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.child?.stdin) {
      return Promise.reject(new Error('Cursor agent not connected'));
    }
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };
      this.child!.stdin!.write(JSON.stringify(msg) + '\n', (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  private handleLine(line: string): void {
    let msg: JsonRpcResponse & {
      method?: string;
      params?: { update?: { sessionUpdate?: string; content?: { text?: string } }; id?: number };
    };
    try {
      msg = JSON.parse(line) as typeof msg;
    } catch {
      return;
    }

    // Response to a send() call
    if (msg.id != null && (msg.result !== undefined || msg.error !== undefined)) {
      const waiter = this.pending.get(msg.id);
      if (waiter) {
        this.pending.delete(msg.id);
        if (msg.error) {
          waiter.reject(new Error(msg.error.message || 'ACP error'));
        } else {
          waiter.resolve(msg.result);
        }
      }
      if (msg.result && typeof msg.result === 'object' && 'stopReason' in (msg.result as object)) {
        this.activeCallbacks?.onEnd({
          stopReason: (msg.result as { stopReason?: string }).stopReason,
        });
      }
      return;
    }

    // Streaming text chunks
    if (msg.method === 'session/update' && msg.params?.update) {
      const update = msg.params.update;
      if (update.sessionUpdate === 'agent_message_chunk' && update.content?.text) {
        this.activeCallbacks?.onText(update.content.text);
      }
      return;
    }

    // Auto-approve permission requests
    if (msg.method === 'session/request_permission' && msg.id != null) {
      const response = JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { outcome: { outcome: 'selected' as const, optionId: 'allow-once' as const } },
      }) + '\n';
      this.child?.stdin?.write(response);
    }
  }

  // -- Prompt execution -------------------------------------------------------

  private async runPrompt(
    options: LLMCallOptions | LLMStreamOptions,
    callbacks: LLMStreamCallbacks
  ): Promise<void> {
    await this.ensureConnection();

    this.activeCallbacks = callbacks;
    try {
      const sessionResult = await this.send('session/new', {
        cwd: process.cwd(),
        mcpServers: [],
      }) as { sessionId: string };

      await this.send('session/prompt', {
        sessionId: sessionResult.sessionId,
        prompt: [{ type: 'text', text: this.buildCombinedPrompt(options) }],
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      callbacks.onError(error);
      throw error;
    } finally {
      this.activeCallbacks = null;
    }
  }

  private buildCombinedPrompt(options: LLMCallOptions | LLMStreamOptions): string {
    const streamOpts = options as LLMStreamOptions;
    const hasHistory = streamOpts.messages && streamOpts.messages.length > 0;
    let combined = '';

    combined += '[[System]]\n' + options.system + '\n\n';

    if (hasHistory) {
      for (const msg of streamOpts.messages!) {
        combined += `[[${msg.role === 'user' ? 'User' : 'Assistant'}]]\n${msg.content}\n\n`;
      }
    }

    combined += '[[User]]\n' + options.prompt;
    return combined;
  }
}

/** Check if Cursor agent CLI is available (e.g. user ran `cursor.com/install` and optionally `agent login`). */
export function isCursorAgentAvailable(): boolean {
  try {
    const cmd = process.platform === 'win32' ? `where ${ACP_AGENT_BIN}` : `which ${ACP_AGENT_BIN}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
