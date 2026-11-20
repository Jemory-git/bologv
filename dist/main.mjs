// main.ts
import { dirname, join as join7 } from "node:path";
import { fileURLToPath } from "node:url";

// electron/run.ts
import { app as app3, BrowserWindow as BrowserWindow2, dialog } from "electron";

// electron/main/window.ts
import { BrowserWindow } from "electron";
function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
function createWindow(options) {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: options.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      // preload 只用 contextBridge / ipcRenderer，沙箱内即可运行。
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
    mainWindow.maximize();
    if (process.env.NODE_ENV !== "production") mainWindow.webContents.openDevTools();
  });
  void mainWindow.loadURL(options.uiUrl);
  return mainWindow;
}

// electron/main/ipc.ts
import { ipcMain } from "electron";

// electron/types/ipc.ts
var IPC = {
  boot: "blg:boot",
  ready: "blg:ready",
  event: "blg:event"
};

// boot.ts
import { join as join6 } from "node:path";
import { app as app2 } from "electron";

// packages/cordis/scope.ts
var Scope = class {
  /** 登记的清理动作；逆序执行。 */
  #disposers = [];
  /** 是否已卸载；dispose() 后为 true，再调是幂等 no-op。 */
  #isDisposed = false;
  get isDisposed() {
    return this.#isDisposed;
  }
  /** 登记一个清理动作；同时返回它，便于手动卸载。 */
  effect(disposer) {
    if (this.#isDisposed) disposer();
    else this.#disposers.push(disposer);
    return disposer;
  }
  /** 摘除一个已登记的清理动作（不执行它）；不存在则 no-op。 */
  remove(disposer) {
    const index = this.#disposers.indexOf(disposer);
    if (index !== -1) this.#disposers.splice(index, 1);
  }
  /**
   * 逆序回收全部副作用。幂等——官方 cordis Fiber.dispose() 保证：
   * 第一次真卸载，再调是 no-op 不抛错。UI 启停按钮可能被重复点。
   */
  dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;
    const disposers = this.#disposers.reverse();
    this.#disposers = [];
    const errors = [];
    for (const disposer of disposers) {
      try {
        disposer();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "scope dispose: one or more disposers failed");
    }
  }
};

// packages/cordis/events.ts
var EventBus = class {
  /** 事件名 → 监听器集合；全局共享，所有 Context 共用同一张表。 */
  #listeners;
  constructor(listeners) {
    this.#listeners = listeners ?? /* @__PURE__ */ new Map();
  }
  /** 注册监听器；返回 disposer，卸载时调用。 */
  on(event, listener) {
    let set = this.#listeners.get(event);
    if (set === void 0) {
      set = /* @__PURE__ */ new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }
  /** 广播事件；复制一份监听器再遍历，允许回调里卸载自己。 */
  emit(event, payload) {
    const set = this.#listeners.get(event);
    if (set === void 0) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[cordis] listener for "${event}" threw:`, error);
      }
    }
  }
};

// packages/cordis/services.ts
var DEFAULT_WAIT_TIMEOUT_MS = 3e4;
var ServiceContainer = class {
  /** 服务名 → 实例；全局共享。 */
  #services;
  /** 等某个服务就绪的 waiter 集合；provide() 成功后自动解掉。 */
  #waiters;
  #waitTimeoutMs;
  constructor(services, waiters, waitTimeoutMs = DEFAULT_WAIT_TIMEOUT_MS) {
    this.#services = services ?? /* @__PURE__ */ new Map();
    this.#waiters = waiters ?? /* @__PURE__ */ new Map();
    this.#waitTimeoutMs = waitTimeoutMs;
  }
  get(name) {
    return this.#services.get(name);
  }
  require(name) {
    const value = this.get(name);
    if (value === void 0) throw new Error(`service "${name}" is not available`);
    return value;
  }
  /** 提供一项能力；同名重复提供直接报错，避免静默覆盖。 */
  provide(name, value) {
    if (this.#services.has(name)) throw new Error(`service "${name}" already provided`);
    this.#services.set(name, value);
    this.#flushWaiters(name);
    return () => {
      if (this.#services.get(name) === value) this.#services.delete(name);
    };
  }
  /** 等待这些服务全部可用；服务先提供还是先声明都无所谓。超时即 reject。 */
  async wait(names) {
    const missing = names.filter((name) => !this.#services.has(name));
    if (missing.length === 0) return;
    const entries = [];
    const promises = missing.map(
      (name) => new Promise((resolve2, reject) => {
        const waiter = {
          resolve: resolve2,
          reject,
          timer: setTimeout(() => {
            this.#removeWaiter(name, waiter);
            reject(new Error(`timeout waiting for service "${name}" (${this.#waitTimeoutMs}ms)`));
          }, this.#waitTimeoutMs)
        };
        const list = this.#waiters.get(name) ?? /* @__PURE__ */ new Set();
        list.add(waiter);
        this.#waiters.set(name, list);
        entries.push({ name, waiter });
      })
    );
    try {
      await Promise.all(promises);
    } finally {
      for (const { name, waiter } of entries) this.#removeWaiter(name, waiter);
    }
  }
  /** close() 调用：reject 所有仍在等待的 waiter，解除挂起的 use()。 */
  rejectAllWaiters(reason) {
    for (const list of this.#waiters.values()) {
      for (const waiter of list) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error(reason));
      }
    }
    this.#waiters.clear();
  }
  #removeWaiter(name, waiter) {
    clearTimeout(waiter.timer);
    const list = this.#waiters.get(name);
    if (list === void 0) return;
    list.delete(waiter);
    if (list.size === 0) this.#waiters.delete(name);
  }
  #flushWaiters(name) {
    const list = this.#waiters.get(name);
    if (list === void 0) return;
    this.#waiters.delete(name);
    for (const waiter of list) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
  }
};

// packages/cordis/context.ts
function createRoot() {
  const disposed = { current: false };
  const services = new ServiceContainer();
  const events = new EventBus();
  return new Context(services, events, disposed, "root");
}
var Context = class _Context {
  /** 服务容器：全局共享，所有 Context 共用同一张表。 */
  services;
  /** 事件总线：全局共享。 */
  events;
  /** 本作用域的副作用栈；每个 Context（包括子 context）独立拥有。 */
  scope;
  /** 作用域名；根为 'root'，子 context 取 plugin.name。 */
  name;
  /** 指向根 context 的 disposed 标记；全部 context 共享。 */
  #disposed;
  /** 本 context 在父作用域栈里的登记条目；dispose() 时精确摘除。 */
  #parentScope;
  #parentEntry;
  constructor(services, events, disposed, name) {
    this.services = services;
    this.events = events;
    this.scope = new Scope();
    this.name = name;
    this.#disposed = disposed;
  }
  // -- 服务容器委托 ---------------------------------------------------------
  get(name) {
    return this.services.get(name);
  }
  require(name) {
    return this.services.require(name);
  }
  /**
   * 提供一项能力；同名重复提供直接报错，避免静默覆盖。
   * 返回 disposer 同时登记到本作用域的 Scope 栈里，卸载时自动回收。
   */
  provide(name, value) {
    const disposer = this.services.provide(name, value);
    return this.scope.effect(disposer);
  }
  async wait(names) {
    return this.services.wait(names);
  }
  // -- 事件总线委托 ---------------------------------------------------------
  /** 注册监听器；返回 disposer，同时登记进 Scope 栈。 */
  on(event, listener) {
    const disposer = this.events.on(event, listener);
    return this.scope.effect(disposer);
  }
  emit(event, payload) {
    this.events.emit(event, payload);
  }
  // -- Scope 委托 -----------------------------------------------------------
  /** 登记一个清理动作；这是「注册即效果」的统一入口。 */
  effect(disposer) {
    return this.scope.effect(disposer);
  }
  /** 本作用域是否已卸载（根 context 除外——根 scope 只在 close() 后 disposed）。 */
  get isDisposed() {
    return this.scope.isDisposed;
  }
  /** 逆序回收本作用域的全部贡献，并从父作用域摘除自身登记。幂等。 */
  dispose() {
    try {
      this.scope.dispose();
    } finally {
      if (this.#parentScope !== void 0 && this.#parentEntry !== void 0) {
        this.#parentScope.remove(this.#parentEntry);
        this.#parentScope = void 0;
        this.#parentEntry = void 0;
      }
    }
  }
  // -- 子作用域 + 插件加载 --------------------------------------------------
  /** 创建子作用域：共享 services + events，但独立 Scope。 */
  child(name) {
    return new _Context(this.services, this.events, this.#disposed, name);
  }
  /** 使用插件：等依赖 → 子作用域 apply → 记录回收。 */
  async use(plugin, config) {
    if (this.#disposed.current) throw new Error("context is disposed");
    const scope = this.child(plugin.name);
    await scope.wait(plugin.inject ?? []);
    if (this.#disposed.current) throw new Error("context is disposed");
    this.emit("plugin/start", plugin.name);
    try {
      await plugin.apply(scope, config);
    } catch (error) {
      try {
        scope.dispose();
      } catch (disposeError) {
        console.error(`[cordis] disposing failed plugin "${plugin.name}" threw:`, disposeError);
      }
      throw error;
    }
    const entry = () => scope.dispose();
    this.scope.effect(entry);
    scope.#parentScope = this.scope;
    scope.#parentEntry = entry;
    this.emit("plugin/ready", plugin.name);
    return scope;
  }
  /** 关闭整个应用：标记 disposed → reject 挂起的 waiter → 回收根 scope 的全部贡献。 */
  close() {
    this.#disposed.current = true;
    this.services.rejectAllWaiters("context is disposed");
    this.dispose();
  }
};

// packages/session/types.ts
var SESSION_SERVICE_NAME = "session";
var CHECKPOINT_SERVICE_NAME = "checkpoint";

// packages/session/session.ts
function sessionPlugin(store) {
  return {
    name: "session",
    async apply(ctx) {
      const events = [...await store.load()];
      let nextSeq = (events.at(-1)?.seq ?? 0) + 1;
      let pending = [];
      let queue = Promise.resolve();
      ctx.provide(SESSION_SERVICE_NAME, {
        append(input) {
          const event = { ...input, seq: nextSeq, ts: Date.now() };
          nextSeq += 1;
          events.push(event);
          pending.push(event);
          ctx.emit("session/event", event);
          return event;
        },
        events() {
          return events;
        },
        flush() {
          if (pending.length === 0) return queue;
          const task = queue.then(async () => {
            while (pending.length > 0) {
              const n = pending.length;
              const batch = pending.slice(0, n);
              await store.append(batch);
              pending = pending.slice(n);
            }
          });
          queue = task.catch(() => void 0);
          return task;
        }
      });
    }
  };
}

// packages/session/checkpoint.ts
var checkpointPlugin = {
  name: "checkpoint",
  inject: [SESSION_SERVICE_NAME],
  apply(ctx) {
    const session = ctx.require(SESSION_SERVICE_NAME);
    ctx.provide(CHECKPOINT_SERVICE_NAME, {
      async at(reason) {
        await session.flush();
        ctx.emit("checkpoint/flushed", reason);
      }
    });
  }
};

// packages/session/stores/jsonl.ts
import { appendFile, link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

// packages/session/errors.ts
var StorageError = class extends Error {
  errCode;
  /** 原始 OS 错误码，如 ENOSPC / EACCES / EBUSY。 */
  code;
  constructor(message, code) {
    super(message);
    this.name = "StorageError";
    this.code = code;
    this.errCode = 500;
  }
};

// packages/session/stores/jsonl.ts
var LOG_VERSION = 1;
function jsonlStore(options) {
  const dir = join(options.root, options.id);
  const logPath = join(dir, `v${LOG_VERSION}.jsonl`);
  const lockPath = join(dir, "writer.lock");
  let locked = false;
  return {
    async load() {
      await mkdir(dir, { recursive: true });
      await acquireLock();
      let text;
      try {
        text = await readFile(logPath, "utf8");
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
      const events = [];
      for (const line of text.split("\n")) {
        if (line === "") continue;
        try {
          const event = JSON.parse(line);
          events.push(typeof event.ts === "number" ? event : { ...event, ts: 0 });
        } catch {
          console.warn(`[session] ${logPath}: \u4E22\u5F03\u635F\u574F\u7684\u65E5\u5FD7\u884C: ${line.slice(0, 80)}`);
        }
      }
      return events;
    },
    async append(batch) {
      if (batch.length === 0) return;
      const lines = batch.map((event) => JSON.stringify(event)).join("\n");
      try {
        await appendFile(logPath, `${lines}
`, "utf8");
      } catch (error) {
        const code = error.code ?? "UNKNOWN";
        const detail = error instanceof Error ? error.message : String(error);
        throw new StorageError(`\u4F1A\u8BDD\u4FDD\u5B58\u5931\u8D25\uFF08${code}\uFF09\uFF1A${detail}`, code);
      }
    },
    async close() {
      if (!locked) return;
      locked = false;
      await rm(lockPath, { force: true });
    }
  };
  async function acquireLock() {
    if (locked) return;
    try {
      await writeLockFile();
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (!await isLockStale()) {
        throw new Error(
          `session "${options.id}" is already open by another process (lock: ${lockPath}). If that process is gone, delete the lock file and retry.`
        );
      }
      await rm(lockPath, { force: true });
      await writeLockFile();
    }
    locked = true;
  }
  async function writeLockFile() {
    const tmpPath = `${lockPath}.${process.pid}.tmp`;
    await writeFile(tmpPath, String(process.pid), "utf8");
    try {
      await link(tmpPath, lockPath);
    } finally {
      await rm(tmpPath, { force: true });
    }
  }
  async function isLockStale() {
    const text = await readFile(lockPath, "utf8").catch(() => "");
    const pid = Number.parseInt(text, 10);
    if (!Number.isInteger(pid) || pid <= 0) return true;
    try {
      process.kill(pid, 0);
      return false;
    } catch (error) {
      return error.code === "ESRCH";
    }
  }
}

// packages/llm/types.ts
var LLM_SERVICE_NAME = "llm";

// packages/llm/errors.ts
var LLMConfigError = class extends Error {
  errCode;
  constructor(message, errCode) {
    super(message);
    this.name = "LLMConfigError";
    this.errCode = errCode;
  }
};
var ModelNotFoundError = class extends LLMConfigError {
  constructor(message) {
    super(message, 404);
    this.name = "ModelNotFoundError";
  }
};
var ApiKeyMissingError = class extends LLMConfigError {
  constructor(message) {
    super(message, 400);
    this.name = "ApiKeyMissingError";
  }
};
var LLMResponseError = class extends Error {
  errCode;
  constructor(message) {
    super(message);
    this.name = "LLMResponseError";
    this.errCode = 502;
  }
};

// packages/tools/types.ts
var TOOLS_SERVICE_NAME = "tools";

// packages/tools/registry.ts
var toolsPlugin = {
  name: "tools",
  apply(ctx) {
    const tools = /* @__PURE__ */ new Map();
    ctx.provide(TOOLS_SERVICE_NAME, {
      register(tool) {
        if (tools.has(tool.name)) throw new Error(`tool "${tool.name}" already registered`);
        tools.set(tool.name, tool);
        return ctx.effect(() => {
          if (tools.get(tool.name) === tool) tools.delete(tool.name);
        });
      },
      list() {
        return [...tools.values()];
      },
      get(name) {
        return tools.get(name);
      }
    });
  }
};

// packages/tools/builtin.ts
import { readFile as readFile2, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
var MAX_OUTPUT_CHARS = 2e3;
var MAX_FILE_BYTES = 1024 * 1024;
function isInside(root, target) {
  const rel = relative(root, target);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function createReadFileTool(rootDir) {
  return {
    name: "read_file",
    description: "\u8BFB\u53D6\u5DE5\u4F5C\u76EE\u5F55\u5185\u7684\u6587\u672C\u6587\u4EF6\uFF0C\u8FD4\u56DE\u622A\u65AD\u540E\u7684\u5185\u5BB9",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "\u76F8\u5BF9\u5DE5\u4F5C\u76EE\u5F55\u7684\u6587\u4EF6\u8DEF\u5F84" } },
      required: ["path"]
    },
    async run(args) {
      const path = String(args.path ?? "");
      const absolute = resolve(rootDir, path);
      if (!isInside(rootDir, absolute)) throw new Error("path escapes working directory");
      const realFile = await realpath(absolute);
      if (!isInside(await realpath(rootDir), realFile)) throw new Error("path escapes working directory");
      const { size } = await stat(realFile);
      if (size > MAX_FILE_BYTES) throw new Error(`file too large: ${size} bytes (max ${MAX_FILE_BYTES})`);
      const text = await readFile2(realFile, "utf8");
      return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\u2026\uFF08\u5DF2\u622A\u65AD\uFF09` : text;
    }
  };
}
var nowTool = {
  name: "now",
  description: "\u8FD4\u56DE\u5F53\u524D\u672C\u5730\u65F6\u95F4\uFF08ISO 8601\uFF0C\u5E26\u65F6\u533A\u504F\u79FB\uFF09",
  parameters: { type: "object", properties: {} },
  run() {
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const offsetMinutes = -now.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(offsetMinutes);
    const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${offset}`;
  }
};
var builtinToolsPlugin = {
  name: "builtin-tools",
  inject: [TOOLS_SERVICE_NAME],
  apply(ctx, config) {
    const rootDir = config?.rootDir;
    if (typeof rootDir !== "string" || rootDir === "") {
      throw new Error("builtin-tools: config.rootDir is required");
    }
    const registry = ctx.require(TOOLS_SERVICE_NAME);
    registry.register(createReadFileTool(rootDir));
    registry.register(nowTool);
  }
};

// packages/runtime/message.ts
function toChatMessages(events) {
  const messages = [];
  for (const event of events) {
    switch (event.type) {
      case "user/message":
        messages.push({ role: "user", content: event.text });
        break;
      case "assistant/message":
        messages.push({ role: "assistant", content: event.text });
        break;
      case "tool/call": {
        const call = { id: event.callId, name: event.name, args: event.args };
        const last = messages.at(-1);
        if (last?.role === "assistant" && last.toolCalls !== void 0) {
          last.toolCalls.push(call);
        } else {
          messages.push({ role: "assistant", content: "", toolCalls: [call] });
        }
        break;
      }
      case "tool/result":
        messages.push({
          role: "tool",
          content: event.content,
          toolName: event.name,
          toolCallId: event.callId
        });
        break;
      default:
        assertNever(event);
    }
  }
  return messages;
}
function assertNever(value) {
  throw new Error(`unhandled session event: ${JSON.stringify(value)}`);
}

// packages/runtime/agent-loop.ts
var AGENT_LOOP_SERVICE_NAME = "agentLoop";
var agentLoopPlugin = {
  name: "agent-loop",
  inject: [LLM_SERVICE_NAME, TOOLS_SERVICE_NAME, SESSION_SERVICE_NAME],
  apply(ctx, config) {
    const llm = ctx.require(LLM_SERVICE_NAME);
    const tools = ctx.require(TOOLS_SERVICE_NAME);
    const session = ctx.require(SESSION_SERVICE_NAME);
    const checkpoint = ctx.get(CHECKPOINT_SERVICE_NAME);
    const maxSteps = Number(config?.maxSteps ?? 6);
    ctx.provide(AGENT_LOOP_SERVICE_NAME, {
      async run(prompt, model) {
        session.append({ type: "user/message", text: prompt });
        for (let step = 0; step < maxSteps; step += 1) {
          await checkpoint?.at("before-model-request");
          const result = await llm.chat({
            messages: toChatMessages(session.events()),
            tools: tools.list().map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            })),
            model
          });
          if (result.kind === "text") {
            session.append({ type: "assistant/message", text: result.text });
            await checkpoint?.at("turn-end");
            return result.text;
          }
          for (const call of result.calls) {
            session.append({ type: "tool/call", callId: call.id, name: call.name, args: call.args });
            const tool = tools.get(call.name);
            if (tool === void 0) {
              session.append({
                type: "tool/result",
                callId: call.id,
                name: call.name,
                ok: false,
                content: `unknown tool: ${call.name}`
              });
              continue;
            }
            try {
              const content = await tool.run(call.args);
              session.append({ type: "tool/result", callId: call.id, name: call.name, ok: true, content });
            } catch (error) {
              session.append({
                type: "tool/result",
                callId: call.id,
                name: call.name,
                ok: false,
                content: String(error)
              });
            }
          }
        }
        throw new Error(`agent loop exceeded max steps (${maxSteps})`);
      }
    });
  }
};

// packages/http/fetch.ts
var HttpError = class extends Error {
  status;
  body;
  constructor(status, body, message) {
    super(message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
    this.name = "HttpError";
  }
};
var TimeoutError = class extends Error {
  constructor(ms) {
    super(`request timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
};
async function fetchWithError(url, options = {}) {
  const controller = options.timeoutMs !== void 0 ? new AbortController() : void 0;
  let timer;
  if (controller !== void 0 && options.timeoutMs !== void 0) {
    timer = setTimeout(() => controller.abort(), options.timeoutMs);
  }
  try {
    const resp = await fetch(url, {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      body: options.body,
      signal: controller?.signal
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new HttpError(resp.status, text, `HTTP ${resp.status}: ${text || resp.statusText}`);
    }
    return resp;
  } catch (error) {
    if (error?.name === "AbortError" && timer !== void 0) {
      throw new TimeoutError(options.timeoutMs);
    }
    throw error;
  } finally {
    if (timer !== void 0) clearTimeout(timer);
  }
}
async function fetchJson(url, options = {}) {
  const resp = await fetchWithError(url, options);
  return await resp.json();
}

// packages/http/fetch-model.ts
var DEFAULT_MODEL_TIMEOUT_MS = 12e4;
async function fetchModel(config, options) {
  const url = `${config.baseURL.replace(/\/+$/, "")}${config.path}`;
  const bodyWithModel = { ...options.body, model: config.model };
  return fetchJson(url, {
    method: "POST",
    body: JSON.stringify(bodyWithModel),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      ...options.headers
    },
    timeoutMs: options.timeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS
  });
}

// packages/llm/llm-deepseek/messages.ts
function toDeepSeekMessages(messages) {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_call_id: m.toolCallId ?? "" };
    }
    if (m.toolCalls !== void 0 && m.toolCalls.length > 0) {
      return {
        role: m.role,
        content: m.content,
        tool_calls: m.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.args) }
        }))
      };
    }
    return { role: m.role, content: m.content };
  });
}
function toDeepSeekTools(tools) {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));
}

// packages/llm/llm-deepseek/response.ts
function parseResponse(resp) {
  const msg = resp?.choices?.[0]?.message;
  if (msg === void 0) throw new LLMResponseError("DeepSeek: \u54CD\u5E94\u7F3A\u5C11 choices[0].message");
  if (msg.tool_calls !== void 0 && msg.tool_calls.length > 0) {
    return {
      kind: "tool_calls",
      calls: msg.tool_calls.map((tc) => {
        const name = tc.function?.name;
        if (typeof tc.id !== "string" || typeof name !== "string") {
          throw new LLMResponseError("DeepSeek: tool_call \u7F3A\u5C11 id \u6216 function.name");
        }
        return { id: tc.id, name, args: parseArgs(tc.function.arguments, name) };
      })
    };
  }
  return { kind: "text", text: msg.content ?? "" };
}
function parseArgs(raw, toolName) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LLMResponseError(`DeepSeek: \u5DE5\u5177 "${toolName}" \u7684 arguments \u4E0D\u662F\u5408\u6CD5 JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new LLMResponseError(`DeepSeek: \u5DE5\u5177 "${toolName}" \u7684 arguments \u5FC5\u987B\u662F JSON \u5BF9\u8C61`);
  }
  return parsed;
}

// packages/llm/llm-deepseek/index.ts
function findModel(vendors, modelId) {
  for (const v of vendors) {
    const m = v.models.find((m2) => m2.modelId === modelId);
    if (m !== void 0) return { vendor: v, modelId: m.modelId, path: m.path };
  }
  return null;
}
function resolveApiKey(vendor) {
  const envName = vendor.apiKeyEnv?.trim();
  if (!envName) return void 0;
  return process.env[envName];
}
var deepseekLLM = {
  name: "deepseek-llm",
  apply(ctx, config) {
    const { getVendors } = config ?? {};
    if (typeof getVendors !== "function") {
      throw new Error("deepseek-llm: config.getVendors is required");
    }
    const service = {
      async chat(request) {
        const vendors = await getVendors();
        const target = findModel(vendors, request.model);
        if (target === null) {
          throw new ModelNotFoundError(
            vendors.length === 0 ? "\u6CA1\u6709\u53EF\u7528\u7684\u5382\u5546\u914D\u7F6E\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u91CC\u6DFB\u52A0" : `\u627E\u4E0D\u5230\u6A21\u578B ${request.model}\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u91CC\u6DFB\u52A0`
          );
        }
        const apiKey = resolveApiKey(target.vendor);
        if (!apiKey) {
          throw new ApiKeyMissingError(
            `\u73AF\u5883\u53D8\u91CF ${target.vendor.apiKeyEnv} \u672A\u8BBE\u7F6E\u3002\u8BF7\u5728\u7CFB\u7EDF\u73AF\u5883\u53D8\u91CF\u4E2D\u914D\u7F6E\u8BE5\u5BC6\u94A5\u540E\u91CD\u542F\u5E94\u7528\u3002`
          );
        }
        const modelConfig = {
          baseURL: target.vendor.baseURL,
          apiKey,
          model: target.modelId,
          path: target.path
        };
        const body = {
          messages: toDeepSeekMessages(request.messages),
          tools: request.tools.length > 0 ? toDeepSeekTools(request.tools) : void 0,
          stream: false
        };
        const data = await fetchModel(modelConfig, { body });
        return parseResponse(data);
      }
    };
    ctx.provide(LLM_SERVICE_NAME, service);
  }
};

// packages/agents/assistant/manifest.ts
function pluginManifest(store, getVendors, rootDir) {
  return [
    { plugin: sessionPlugin(store) },
    { plugin: checkpointPlugin },
    { plugin: deepseekLLM, config: { getVendors } },
    { plugin: toolsPlugin },
    { plugin: builtinToolsPlugin, config: { rootDir } },
    { plugin: agentLoopPlugin, config: { maxSteps: 6 } }
  ];
}

// service/storage/models.ts
import { join as join3 } from "node:path";

// service/storage/internal.ts
import { mkdir as mkdir2, readFile as readFile3, rename, rm as rm2, writeFile as writeFile2 } from "node:fs/promises";
import { join as join2 } from "node:path";
import { app } from "electron";
var SETTINGS_DIR = join2(app.getPath("userData"), "settings");
var tmpSeq = 0;
async function ensureDir() {
  await mkdir2(SETTINGS_DIR, { recursive: true });
}
async function readJsonFile(path, fallback, parse) {
  let text;
  try {
    text = await readFile3(path, "utf-8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      await writeJsonFile(path, fallback);
      return fallback;
    }
    throw error;
  }
  try {
    const raw = JSON.parse(text);
    return parse ? parse(raw) : raw;
  } catch {
    await rename(path, `${path}.corrupt-${Date.now()}`).catch(() => void 0);
    await writeJsonFile(path, fallback);
    return fallback;
  }
}
async function writeJsonFile(path, data) {
  await ensureDir();
  const tmp = `${path}.${process.pid}.${++tmpSeq}.tmp`;
  try {
    await writeFile2(tmp, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmp, path);
  } catch (error) {
    await rm2(tmp, { force: true }).catch(() => void 0);
    throw error;
  }
}

// service/storage/models.ts
var MODELS_FILE = join3(SETTINGS_DIR, "models.json");
var DEFAULT_VENDORS = [
  {
    id: "vendor-deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: [
      { id: "model-chat", modelId: "deepseek-chat", path: "/chat/completions" },
      { id: "model-reasoner", modelId: "deepseek-reasoner", path: "/chat/completions" }
    ]
  }
];
async function loadModels() {
  return readJsonFile(MODELS_FILE, DEFAULT_VENDORS, parseVendors);
}
async function saveModels(vendors) {
  await writeJsonFile(MODELS_FILE, vendors);
}
function parseVendors(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("vendors must be a non-empty array");
  }
  const vendors = raw.map((item, i) => parseVendor(item, `vendors[${i}]`));
  const vendorIds = /* @__PURE__ */ new Set();
  const defIds = /* @__PURE__ */ new Set();
  const modelIds = /* @__PURE__ */ new Set();
  for (const v of vendors) {
    if (vendorIds.has(v.id)) throw new Error(`duplicate vendor id "${v.id}"`);
    vendorIds.add(v.id);
    for (const m of v.models) {
      if (defIds.has(m.id)) throw new Error(`duplicate model id "${m.id}"`);
      defIds.add(m.id);
      if (modelIds.has(m.modelId)) throw new Error(`duplicate modelId "${m.modelId}"`);
      modelIds.add(m.modelId);
    }
  }
  return vendors;
}
function parseVendor(raw, field) {
  const v = asRecord(raw, field);
  if (!Array.isArray(v.models)) {
    throw new Error(`${field}.models must be an array`);
  }
  return {
    id: asString(v.id, `${field}.id`),
    name: asString(v.name, `${field}.name`),
    baseURL: asString(v.baseURL, `${field}.baseURL`),
    apiKeyEnv: asString(v.apiKeyEnv, `${field}.apiKeyEnv`),
    models: v.models.map((m, j) => parseModel(m, `${field}.models[${j}]`))
  };
}
function parseModel(raw, field) {
  const m = asRecord(raw, field);
  const path = asString(m.path, `${field}.path`);
  if (!path.startsWith("/")) {
    throw new Error(`${field}.path must start with "/"`);
  }
  return {
    id: asString(m.id, `${field}.id`),
    modelId: asString(m.modelId, `${field}.modelId`),
    path
  };
}
function asRecord(raw, field) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`${field} must be an object`);
  }
  return raw;
}
function asString(raw, field) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return raw.trim();
}

// service/storage/plugins.ts
import { join as join4 } from "node:path";
var PLUGINS_FILE = join4(SETTINGS_DIR, "plugins.json");
var DEFAULT = { enabled: [] };
async function loadPluginSettings() {
  return readJsonFile(PLUGINS_FILE, DEFAULT, parseSettings);
}
function parseSettings(raw) {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("plugins.json must be an object");
  }
  const enabled = raw.enabled;
  if (!Array.isArray(enabled) || enabled.some((id) => typeof id !== "string")) {
    throw new Error("plugins.json enabled must be a string array");
  }
  return { enabled };
}
async function savePluginSettings(data) {
  await writeJsonFile(PLUGINS_FILE, data);
}

// service/storage/system.ts
import { join as join5 } from "node:path";
var SYSTEM_FILE = join5(SETTINGS_DIR, "system.json");

// boot.ts
var booting;
async function doBoot() {
  const root = createRoot();
  const plugins = [];
  root.on("plugin/ready", (name) => {
    plugins.push(String(name));
  });
  const workingDir = process.cwd();
  const sessionRoot = join6(app2.getPath("userData"), "sessions");
  const store = jsonlStore({ root: sessionRoot, id: "default" });
  for (const entry of pluginManifest(store, loadModels, workingDir)) {
    await root.use(entry.plugin, entry.config);
  }
  const session = root.require(SESSION_SERVICE_NAME);
  const loop = root.require(AGENT_LOOP_SERVICE_NAME);
  return {
    root,
    store,
    session,
    loop,
    plugins,
    workingDir,
    sessionPath: join6(sessionRoot, "default", "v1.jsonl")
  };
}
function ensureBooted() {
  booting ??= doBoot();
  return booting;
}
async function teardown() {
  const booted = await booting?.catch(() => void 0);
  if (booted === void 0) return;
  await booted.session.flush();
  await booted.store.close();
  booted.root.close();
}

// electron/main/ipc.ts
function registerIpc() {
  ipcMain.handle(IPC.boot, async () => {
    const booted = await ensureBooted();
    return {
      plugins: booted.plugins,
      sessionPath: booted.sessionPath,
      workingDir: booted.workingDir
    };
  });
}

// electron/run.ts
function run(options) {
  void app3.whenReady().then(async () => {
    registerIpc();
    options.booted.root.on("plugin/ready", (name) => broadcast(IPC.ready, String(name)));
    options.booted.root.on("session/event", (event) => broadcast(IPC.event, event));
    const uiUrl = options.getUiUrl();
    createWindow({ uiUrl, preloadPath: options.preloadPath });
    app3.on("activate", () => {
      if (BrowserWindow2.getAllWindows().length === 0) {
        createWindow({ uiUrl, preloadPath: options.preloadPath });
      }
    });
    app3.on("window-all-closed", () => {
      void teardown().finally(() => {
        app3.quit();
        options.server.closeAllConnections();
        options.server.close();
      });
    });
  });
}
function abortStartup(error, server) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[startup] failed:", error);
  server?.closeAllConnections();
  server?.close();
  void app3.whenReady().then(() => {
    dialog.showErrorBox("\u542F\u52A8\u5931\u8D25", message);
    app3.quit();
  });
}

// service/main.ts
import Koa from "koa";
import Router6 from "@koa/router";
import bodyParser from "koa-bodyparser";

// shared/api-response.ts
import { Readable } from "node:stream";
function compact(body) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value != null));
}
function apiResFnMount2Ctx(koa) {
  koa.context.apiError = function({ msg, data, errCode, errMsg, other }) {
    this.status = 200;
    this.body = compact({ code: -1, errCode, errMsg, other, msg, data });
  };
  koa.context.apiSuccess = function({ msg, data, other }) {
    this.status = 200;
    this.body = compact({ code: 0, errCode: null, errMsg: null, other, msg, data });
  };
  koa.context.responseStream = function(stream) {
    this.type = "text/event-stream";
    this.status = 200;
    this.set("Cache-Control", "no-cache, no-transform");
    this.set("Connection", "keep-alive");
    const responseStream = Readable.from((async function* () {
      for await (const chunk of stream) {
        yield `data: ${JSON.stringify(chunk)}

`;
      }
    })());
    this.res.once("close", () => {
      if (!this.res.writableFinished) responseStream.destroy();
    });
    this.body = responseStream;
  };
}

// service/errors.ts
var AppError = class extends Error {
  status;
  constructor(message, status) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
};
var ValidationError = class extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = "ValidationError";
  }
};
var ConflictError = class extends AppError {
  constructor(message) {
    super(message, 409);
    this.name = "ConflictError";
  }
};

// service/middleware/error.ts
function errorMiddleware() {
  return async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        ctx.apiError({ msg: err.message, errCode: err.status });
      } else if (err instanceof LLMConfigError) {
        ctx.apiError({ msg: err.message, errCode: err.errCode });
      } else if (err instanceof LLMResponseError) {
        ctx.apiError({ msg: err.message, errCode: err.errCode });
      } else if (err instanceof StorageError) {
        ctx.apiError({ msg: err.message, errCode: err.errCode });
      } else {
        ctx.status = 500;
        ctx.body = { error: err instanceof Error ? err.message : String(err) };
      }
    }
  };
}

// service/middleware/static.ts
import serve from "koa-static";
function staticMiddleware({ uiRoot }) {
  const koaStatic = serve(uiRoot, { index: "index.html" });
  return async (ctx, next) => {
    await koaStatic(ctx, async () => {
      await next();
      if (ctx.status === 404 && !ctx.path.startsWith("/api")) {
        ctx.path = "/index.html";
        ctx.status = 200;
        await koaStatic(ctx, async () => {
        });
      }
    });
  };
}

// service/routes/health.ts
import Router from "@koa/router";
var healthRouter = new Router();
healthRouter.get("/", (ctx) => {
  ctx.apiSuccess({ msg: "ok", data: { ok: true, timestamp: Date.now() } });
});

// service/routes/models.ts
import Router2 from "@koa/router";
var modelsRouter = new Router2();
modelsRouter.get("/", async (ctx) => {
  ctx.apiSuccess({ msg: "ok", data: await loadModels() });
});
modelsRouter.put("/", async (ctx) => {
  const body = ctx.request.body ?? {};
  let vendors;
  try {
    vendors = parseVendors(body.vendors);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : String(error));
  }
  await saveModels(vendors);
  ctx.apiSuccess({ msg: "ok", data: { ok: true } });
});

// service/routes/settings.ts
import Router3 from "@koa/router";
var settingsRouter = new Router3();
settingsRouter.get("/plugins", async (ctx) => {
  const data = await loadPluginSettings();
  ctx.apiSuccess({ msg: "ok", data: { enabled: data.enabled } });
});
settingsRouter.put("/plugins", async (ctx) => {
  const body = ctx.request.body ?? {};
  if (!Array.isArray(body.enabled) || !body.enabled.every((v) => typeof v === "string")) {
    throw new ValidationError("enabled must be an array of strings");
  }
  await savePluginSettings({ enabled: body.enabled });
  ctx.apiSuccess({ msg: "ok", data: { ok: true } });
});

// service/routes/chat.ts
import Router4 from "@koa/router";
function createChatRouter(bootedPromise) {
  const router = new Router4();
  let running = false;
  router.post("/", async (ctx) => {
    const booted = await bootedPromise;
    const body = ctx.request.body ?? {};
    const text = String(body.text ?? "").trim();
    if (!text) {
      throw new ValidationError("text is required");
    }
    const model = String(body.model ?? "").trim();
    if (!model) {
      throw new ValidationError("model is required");
    }
    if (running) {
      throw new ConflictError("session \u5DF2\u5728\u8FD0\u884C\u4E2D");
    }
    running = true;
    try {
      await booted.loop.run(text, model);
      ctx.apiSuccess({ msg: "ok", data: { ok: true } });
    } finally {
      running = false;
    }
  });
  return router;
}

// service/routes/sessions.ts
import Router5 from "@koa/router";
function createSessionsRouter(bootedPromise) {
  const router = new Router5();
  router.get("/", async (ctx) => {
    const booted = await bootedPromise;
    const events = booted.session.events();
    ctx.apiSuccess({ msg: "ok", data: [buildSummary("default", events)] });
  });
  router.get("/:id/events", async (ctx) => {
    const booted = await bootedPromise;
    const { id } = ctx.params;
    if (id !== "default") {
      throw new ValidationError(`unknown session: ${id}`);
    }
    ctx.apiSuccess({ msg: "ok", data: { events: [...booted.session.events()] } });
  });
  return router;
}
function buildSummary(id, events) {
  const lastActive = events.at(-1)?.ts ?? 0;
  const preview = events.length > 0 ? extractPreview(events) : "";
  return { id, lastActive, preview };
}
function extractPreview(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.type === "user/message" || ev.type === "assistant/message") {
      return truncate(ev.text, 80);
    }
  }
  return "";
}
function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + "\u2026" : text;
}

// service/routes/index.ts
function registerApiRoutes(router, bootedPromise) {
  router.use("/health", healthRouter.routes());
  router.use("/chat", createChatRouter(bootedPromise).routes());
  router.use("/models", modelsRouter.routes());
  router.use("/settings", settingsRouter.routes());
  router.use("/sessions", createSessionsRouter(bootedPromise).routes());
}

// service/main.ts
function startService(options) {
  const bootedPromise = ensureBooted();
  const app4 = new Koa();
  apiResFnMount2Ctx(app4);
  const router = new Router6({ prefix: "/api" });
  app4.use(errorMiddleware());
  app4.use(bodyParser({ enableTypes: ["json"] }));
  registerApiRoutes(router, bootedPromise);
  app4.use(router.routes());
  app4.use(router.allowedMethods());
  if (options.uiRoot) {
    app4.use(staticMiddleware({ uiRoot: options.uiRoot }));
  }
  return new Promise((resolve2, reject) => {
    const server = app4.listen(options.port, "127.0.0.1", () => resolve2(server));
    server.on("error", reject);
  });
}

// main.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
var isProduction = process.env.NODE_ENV === "production";
var port = isProduction ? 0 : Number(process.env.BLG_API_PORT);
if (!isProduction && !port) {
  throw new Error("BLG_API_PORT is not set in environment");
}
var started;
var serviceReady = startService({
  port,
  uiRoot: isProduction ? join7(__dirname, "ui") : void 0
}).then((server) => {
  started = server;
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  process.env.BLG_API_URL = `http://127.0.0.1:${actualPort}/`;
  return server;
});
var bootedReady = ensureBooted();
void Promise.all([serviceReady, bootedReady]).then(([server, booted]) => {
  run({
    server,
    booted,
    preloadPath: join7(__dirname, "preload.mjs"),
    getUiUrl: () => process.env.BLG_WEB_URL ?? process.env.BLG_API_URL
  });
}).catch((error) => abortStartup(error, started));
