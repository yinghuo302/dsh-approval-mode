/**
 * dsh-approval-mode — Client half (web bundle).
 *
 * Two surfaces over two Host values:
 *
 *   1. The approval-mode picker (默认审批 / 工具免审 / AI审批 / 绕过审批) in the
 *      composer tool row seat `conversation.input.left` — the seat right next
 *      to the permission (access mode) selector. It reads and writes the
 *      CURRENT SESSION's mode, so switching there never changes what the next
 *      session opens with. Visual style mirrors PermissionSelect: a pill
 *      trigger button with an upward popup menu.
 *   2. The plugin's card on the settings page (设置 → 插件 → 插件配置), which is
 *      the configuration page for the DEFAULT approval mode — the mode a
 *      session opens with. The card is registered into the
 *      `settings.plugin.item` slot keyed by this plugin's settings namespace,
 *      which is how the plugins tab pairs a served namespace with the browser
 *      half that owns its card. DSH 0.1.7+ — 0.2.0 included — has neither that
 *      slot nor the `settingsScope` service: there the settings page draws the
 *      default-mode form itself from `Config.defaultMode`, and this half
 *      contributes only the picker.
 *
 * Both surfaces read and write the Host setting through the Host control route
 * (`GET/POST /approval-mode`, same-origin fetch). The route is addressed per
 * session: the picker asks for its own `sessionId`, the card asks for the
 * default. Each addressed value gets its own store, so a change in one never
 * masquerades as the other.
 *
 * i18n: registers the "approval-mode" dictionary (zh/en) with the DSH locale
 * service; slot owners inject the bound `t` via the `locale` registration
 * option, so all copy follows the DSH UI language automatically.
 *
 * Version posture: the card is registered through a NESTED
 * `ctx.inject(["settingsScope"], …)`, not through a module-level `inject`.
 * A host without that client service (before dsh 0.1.0-rc.7, and every host
 * since 0.1.7) simply never creates the card, and the picker keeps working — a
 * module-level dependency would instead keep the whole plugin unmounted.
 *
 * Bundle format: `window.__ModuleLoader__.load({ id, factory })` — the DSH web
 * client module system (CJS-style factory; "react" resolves to the platform
 * seed module). No bundler is required to produce this file.
 */
window.__ModuleLoader__.load({
  id: "dsh-approval-mode",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var react = require("react");

    /** Locale dictionary namespace owned by this plugin (also the settings namespace). */
    var NS = "approval-mode";
    /** Slot cell key in conversation.input.left. */
    var APPROVAL_MODE_SELECT_ID = "approval-mode-select";
    /** Host control routes (same origin as the served GUI). */
    var ROUTE_PATH = "/approval-mode";
    var AI_HISTORY_ROUTE_PATH = "/approval-mode/history";
    /** Every mode value the Host can hold, least to most permissive. */
    var MODES = ["ask", "bypass-except-escalation", "llm-auto", "bypass"];
    /** Dictionary key suffix per mode value. */
    var MODE_KEY = {
      "ask": "ask",
      "bypass-except-escalation": "bypassSafe",
      "llm-auto": "llmAuto",
      "bypass": "bypass"
    };

    /** Simplified fallback interpolation for the zh dictionary (no locale service). */
    function fallbackT(key, params) {
      var text = zh[key] || key;
      if (params) {
        for (var name of Object.keys(params)) {
          text = text.split("{" + name + "}").join(String(params[name]));
        }
      }
      return text;
    }

    var zh = {
      "mode.ask": "默认审批",
      "mode.bypassSafe": "工具免审",
      "mode.llmAuto": "AI审批",
      "mode.bypass": "绕过审批",
      "mode.unknown": "审批模式未知",
      "title.ask": "当前会话审批模式：默认审批 —— 工具调用需要点击审批",
      "title.bypassSafe": "当前会话审批模式：工具免审——普通工具调用自动批准；工作区外提权仍会弹窗询问",
      "title.llmAuto": "当前会话审批模式：仅在 DSH 本需审批或请求更宽沙箱时由 AI 审核；模型未明确批准则直接拒绝",
      "title.bypass": "当前会话审批模式：绕过审批 —— 所有工具调用自动批准，含工作区外提权（高风险）",
      "title.unknown": "审批模式：读取当前设置失败（无法与 DSH 通信），暂不可切换。",
      "title.fullAccess": "当前会话权限为 Full Access：DSH 直接放行且不再发起审批请求，审批模式不可切换。",
      "aria.mode": "审批模式，当前会话：{mode}",
      "item.ask": "默认审批",
      "item.bypassSafe": "工具免审",
      "item.llmAuto": "AI审批",
      "item.bypass": "绕过审批",
      "card.title": "审批模式",
      "card.desc": "设置打开会话时使用的默认审批模式。",
      "card.rowLabel": "默认审批模式",
      "card.hint.ask": "工具调用需要点击批准，与 DSH 原生行为一致。",
      "card.hint.bypassSafe": "工具调用自动批准；工作区外写文件等提权仍会弹窗询问。",
      "card.hint.llmAuto": "只有 DSH 原本会询问或请求更宽沙箱时才调用 AI；权限请求与当前模式相同则直接沿用。模型未明确批准时直接拒绝。",
      "card.hint.bypass": "所有工具调用自动批准，不弹出审批提示，含工作区外提权（高风险）。",
      "history.open": "AI审批历史",
      "history.title": "AI审批历史（当前会话）",
      "history.close": "关闭",
      "history.refresh": "刷新",
      "history.more": "加载更早记录",
      "history.loading": "正在读取审批历史…",
      "history.empty": "当前会话暂无 AI 审批记录。",
      "history.error": "读取审批历史失败，请稍后重试。",
      "history.approved": "AI 已批准",
      "history.denied": "AI 已拒绝",
      "history.unavailable": "AI 审核未完成",
      "history.escalation": "沙箱提权获批",
      "history.callDetails": "调用详情",
      "history.requestedMode": "请求权限：{mode}",
      "history.timestamp": "时间：{time}",
      "card.loading": "正在读取当前设置…",
      "card.saving": "正在保存…",
      "card.error": "读写设置失败：无法与 DSH 通信，当前显示的审批模式可能不是实际设置。",
      "card.footnote": "全局默认值：没有单独设置模式的会话（含正在运行的）立即跟随；工具栏的「审批模式」按钮只改当前会话，不改这个默认值。",
      "card.aria.options": "默认审批模式"
    };

    var en = {
      "mode.ask": "Default approval",
      "mode.bypassSafe": "Tool auto-approval",
      "mode.llmAuto": "AI approval",
      "mode.bypass": "Bypass approval",
      "mode.unknown": "Approval mode unknown",
      "title.ask": "Approval mode for this session: default — tool calls require a click to approve",
      "title.bypassSafe": "Approval mode for this session: tool auto-approval — ordinary tool calls pass automatically; widening access outside the workspace still prompts you",
      "title.llmAuto": "Approval mode for this session: AI reviews only calls DSH would ask about or that request a wider sandbox; anything not explicitly approved is rejected",
      "title.bypass": "Approval mode for this session: bypass — every tool call is auto-approved, sandbox escalations included (high risk)",
      "title.unknown": "Approval mode: the current setting could not be read (the DSH host is unreachable), so it cannot be switched.",
      "title.fullAccess": "Session permission is Full Access: DSH passes everything through and never issues approval requests, so the mode cannot be switched.",
      "aria.mode": "Approval mode for this session, current: {mode}",
      "item.ask": "Default approval",
      "item.bypassSafe": "Tool auto-approval",
      "item.llmAuto": "AI approval",
      "item.bypass": "Bypass approval",
      "card.title": "Approval mode",
      "card.desc": "Set the approval mode sessions open with.",
      "card.rowLabel": "Default approval mode",
      "card.hint.ask": "Tool calls require a click to approve, the stock DSH behaviour.",
      "card.hint.bypassSafe": "Tool calls are auto-approved; widening access outside the workspace still prompts.",
      "card.hint.llmAuto": "AI is called only when DSH would otherwise ask or a wider sandbox is requested. A sandbox request matching the current mode is used directly; anything the AI does not explicitly approve is rejected.",
      "card.hint.bypass": "Every tool call is auto-approved with no prompt, sandbox escalations included (high risk).",
      "history.open": "AI approval history",
      "history.title": "AI approval history (this session)",
      "history.close": "Close",
      "history.refresh": "Refresh",
      "history.more": "Load older records",
      "history.loading": "Loading approval history…",
      "history.empty": "No AI approval records for this session.",
      "history.error": "Could not load approval history. Try again.",
      "history.approved": "AI approved",
      "history.denied": "AI denied",
      "history.unavailable": "AI review unavailable",
      "history.escalation": "Sandbox escalation approved",
      "history.callDetails": "Call details",
      "history.requestedMode": "Requested permission: {mode}",
      "history.timestamp": "Time: {time}",
      "card.loading": "Reading the current setting…",
      "card.saving": "Saving…",
      "card.error": "Could not read or write the setting: the DSH host is unreachable, so the approval mode shown may not be the actual setting.",
      "card.footnote": "One global default: sessions without a mode of their own follow it, running ones included; the composer toolbar's approval-mode button changes only the current session.",
      "card.aria.options": "Default approval mode"
    };

    var APPROVAL_MODE_CSS = [
      ".dsh-approval-mode-root{position:relative;display:inline-flex}",
      ".dsh-approval-mode-trigger{min-width:0;max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:24px;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}",
      ".dsh-approval-mode-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
      ".dsh-approval-mode-trigger:focus-visible{box-shadow:0 0 0 2px var(--dsw-alias-border-l3)}",
      ".dsh-approval-mode-trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}",
      ".dsh-approval-mode-trigger.bypass{color:var(--dsw-alias-state-warn-primary)}",
      ".dsh-approval-mode-triggerIcon{flex:none;display:inline-flex}",
      ".dsh-approval-mode-triggerIcon svg{width:14px;height:14px}",
      ".dsh-approval-mode-triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}",
      // 窄容器（手机布局）与 PermissionSelect 同一断点：有图标时只留图标与箭头。
      "@container (width<=460px){.dsh-approval-mode-trigger:has(.dsh-approval-mode-triggerIcon) .dsh-approval-mode-triggerLabel{display:none}}",
      ".dsh-approval-mode-chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s;display:inline-flex}",
      ".dsh-approval-mode-chevron.open{transform:rotate(180deg)}",
      ".dsh-approval-mode-menu{position:absolute;bottom:calc(100% + 6px);left:0;min-width:220px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px;z-index:1000;display:flex;flex-direction:column}",
      ".dsh-approval-mode-item{display:flex;align-items:center;gap:8px;min-height:32px;padding:0 8px;border:none;background:none;border-radius:6px;font-size:13px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;width:100%;font-family:inherit}",
      ".dsh-approval-mode-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".dsh-approval-mode-item.selected{color:var(--dsw-alias-brand-primary)}",
      ".dsh-approval-mode-item.danger{color:var(--dsw-alias-state-warn-primary)}",
      ".dsh-approval-mode-item .dsh-approval-mode-itemCheck{margin-left:auto;display:inline-flex;flex:none}",
      ".dsh-approval-mode-item .dsh-approval-mode-itemCheck svg{width:14px;height:14px}",
      ".dsh-approval-mode-itemIcon{flex:none;display:inline-flex}",
      ".dsh-approval-mode-itemIcon svg{width:14px;height:14px}",
      ".dsh-approval-mode-historySeparator{height:1px;background:var(--dsw-alias-border-l2);margin:4px 6px}",
      ".dsh-approval-mode-history{position:absolute;bottom:calc(100% + 6px);left:0;z-index:1001;width:min(420px,calc(100vw - 24px));max-height:min(65vh,540px);overflow:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px;color:var(--dsw-alias-label-primary)}",
      ".dsh-approval-mode-historyHeader{display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l2);padding-bottom:8px;margin-bottom:8px}",
      ".dsh-approval-mode-historyTitle{flex:1;font-size:13px;font-weight:600}",
      ".dsh-approval-mode-historyAction{border:0;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;padding:4px 7px;font:inherit}",
      ".dsh-approval-mode-historyAction:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
      ".dsh-approval-mode-historyEmpty{font-size:12px;color:var(--dsw-alias-label-secondary);padding:12px 4px}",
      ".dsh-approval-mode-historyItem{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:8px;margin:8px 0;font-size:12px}",
      ".dsh-approval-mode-historyItemHead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
      ".dsh-approval-mode-historyStatus{font-weight:600;color:var(--dsw-alias-state-success-primary)}",
      ".dsh-approval-mode-historyStatus.denied{color:var(--dsw-alias-state-error-primary)}",
      ".dsh-approval-mode-historyMeta{color:var(--dsw-alias-label-secondary);margin-top:4px;overflow-wrap:anywhere}",
      ".dsh-approval-mode-historyDetails{margin-top:6px}",
      ".dsh-approval-mode-historyDetails summary{cursor:pointer;color:var(--dsw-alias-label-secondary)}",
      ".dsh-approval-mode-historyDetails pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;background:var(--dsw-alias-bg-layer-1);border-radius:6px;padding:8px;margin:6px 0 0;font:11px/1.45 monospace}",
      // Plugin-page card. Chrome mirrors the host's own PluginCard (settings tab)
      // one for one, because a card the tab lays out must not look foreign.
      ".dsh-approval-mode-card{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-layer-3);border-radius:16px;list-style:none;transition:border-color .16s,background .16s}",
      ".dsh-approval-mode-card:hover{border-color:var(--dsw-alias-label-dimmed)}",
      ".dsh-approval-mode-cardOpen{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}",
      ".dsh-approval-mode-cardHeader{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;border-radius:12px;align-items:center;gap:12px;padding:14px 16px;display:flex}",
      ".dsh-approval-mode-cardHeader:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}",
      ".dsh-approval-mode-cardHeadText{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}",
      ".dsh-approval-mode-cardName{color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.4}",
      ".dsh-approval-mode-cardDesc{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5}",
      ".dsh-approval-mode-cardChevron{color:var(--dsw-alias-label-tertiary);flex:none;display:inline-flex;transition:transform .16s}",
      ".dsh-approval-mode-cardChevronOpen{transform:rotate(180deg)}",
      ".dsh-approval-mode-cardBody{border-top:.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}",
      ".dsh-approval-mode-cardRow{display:flex;align-items:center;gap:12px;padding:12px 0}",
      ".dsh-approval-mode-cardLabelBox{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}",
      ".dsh-approval-mode-cardLabel{font-size:13px;line-height:20px}",
      ".dsh-approval-mode-cardHint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
      ".dsh-approval-mode-cardHint.error{color:var(--dsw-alias-label-error)}",
      ".dsh-approval-mode-cardSeg{display:inline-flex;flex-shrink:0;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:2px;gap:2px}",
      ".dsh-approval-mode-cardSegBtn{font:inherit;font-size:12px;line-height:18px;padding:3px 10px;border:none;border-radius:6px;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}",
      ".dsh-approval-mode-cardSegBtn:disabled{cursor:default;opacity:.5}",
      ".dsh-approval-mode-cardSegBtn.selected{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600}",
      ".dsh-approval-mode-cardSegBtn.selected.danger{color:var(--dsw-alias-state-warn-primary)}",
      ".dsh-approval-mode-cardFoot{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;border-top:.5px solid var(--dsw-alias-border-l2);margin-top:12px;padding:12px 0 4px}"
    ].join("\n");

    /** @returns whether the page runs on the loopback DSH origin (same-origin fetch). */
    function canFetch() {
      return typeof fetch === "function";
    }

    /** The route address for one store: a session's own value, or the default. */
    function routeUrl(sessionId) {
      return sessionId === null ? ROUTE_PATH : ROUTE_PATH + "?session=" + encodeURIComponent(sessionId);
    }

    function historyUrl(sessionId, offset) {
      var params = new URLSearchParams();
      params.set("limit", "25");
      params.set("offset", String(offset ?? 0));
      if (typeof sessionId === "string" && sessionId.length > 0) params.set("session", sessionId);
      return AI_HISTORY_ROUTE_PATH + "?" + params.toString();
    }

    /** Read bounded AI decisions for the current session (or profile when absent). */
    function readApprovalHistory(sessionId, offset) {
      var url = historyUrl(sessionId, offset);
      return fetch(url).then((response) => {
        if (!response.ok) throw new Error("GET " + url + " -> HTTP " + response.status);
        return response.json();
      }).then((value) => {
        if (!value || value.ok !== true || !Array.isArray(value.entries)) throw new Error("invalid approval history response");
        return value;
      });
    }

    /** Read one addressed mode from the Host control route. */
    function readMode(sessionId) {
      return fetch(routeUrl(sessionId)).then((response) => {
        if (!response.ok) throw new Error("GET " + routeUrl(sessionId) + " -> HTTP " + response.status);
        return response.json();
      }).then((value) => {
        return value && MODES.indexOf(value.mode) >= 0 ? value.mode : "ask";
      });
    }

    /** Write one addressed mode through the Host control route. */
    function writeMode(sessionId, mode) {
      return fetch(routeUrl(sessionId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode })
      }).then((response) => {
        if (!response.ok) return false;
        return response.json().then((value) => !!(value && value.ok === true));
      });
    }

    /**
     * One addressed view of the Host setting. `sessionId === null` addresses the
     * DEFAULT mode (what a session opens with); any other value addresses that
     * session's own mode. Two addresses are two stores, so the card and the
     * picker can never show each other's value as their own.
     *
     * The read is lazy (first subscriber) and never repeated after it settles.
     * Invariants that the surfaces rely on:
     *
     * - `known` says whether `mode` is a value the HOST actually reported. A
     *   failed initial read leaves it false, so a surface shows "unknown"
     *   instead of presenting the schema default as the setting.
     * - `confirmed` is the last value the Host confirmed — by a read or by a
     *   successful write — and it is the ONLY thing a failed write restores.
     *   Restoring the previous optimistic value instead would show a mode the
     *   Host never accepted when two selections overlap.
     * - `generation` guards both directions: a write settles only for the
     *   newest selection, and a read whose result a later selection superseded
     *   is dropped rather than publishing a stale mode. A superseded write that
     *   SUCCEEDED still updates `confirmed`, because the Host applied it.
     */
    function createModeStore(sessionId) {
      var store = {
        sessionId: sessionId,
        state: { mode: "ask", ready: false, known: false, saving: false, failed: false },
        /** Last value the Host confirmed; the restore point for a failed write. */
        confirmed: { mode: "ask", known: false },
        /** Generation that produced `confirmed`, so a late response cannot regress it. */
        confirmedGeneration: 0,
        listeners: [],
        loading: null,
        generation: 0,
        /** Mounted surfaces following the default store (see watchDefault). */
        defaultWatchers: 0,
        defaultUnsubscribe: null,
        /** A re-read asked for while one was already running. */
        reloadQueued: false,
        get: function () {
          return store.state;
        },
        subscribe: function (listener) {
          var first = store.listeners.length === 0;
          store.listeners.push(listener);
          if (!store.state.ready) {
            if (!store.loading) store.load();
          } else if (first) {
            // A surface mounting onto an already-read store re-reads: the Host
            // value may have moved while nothing was subscribed — the settings
            // card edits the default this store inherits.
            store.reload();
          }
          return function () {
            var index = store.listeners.indexOf(listener);
            if (index >= 0) store.listeners.splice(index, 1);
          };
        },
        publish: function (next) {
          store.state = next;
          store.listeners.slice().forEach((listener) => {
            try {
              listener(next);
            } catch (err) {
              console.error("[dsh-approval-mode] subscriber failed:", err);
            }
          });
        },
        load: function (forced) {
          if (store.loading) return store.loading;
          if (forced !== true && store.state.ready) return Promise.resolve(store.state);
          var generation = store.generation;
          if (!canFetch()) {
            // No transport at all: the value is unknowable, and saying so is the
            // only honest state — the same one a failed read produces.
            store.publish({ mode: "ask", ready: true, known: false, saving: false, failed: true });
            return Promise.resolve(store.state);
          }
          /**
           * Publish one read result, unless a selection made while it was in
           * flight owns the state now. A re-read requested meanwhile — the
           * default moved again while this one was running — is served rather
           * than dropped, because the whole point of it is the newer value.
           */
          var settle = function (next) {
            store.loading = null;
            if (generation === store.generation) {
              store.publish(next);
              if (store.reloadQueued) {
                store.reloadQueued = false;
                return store.load(true);
              }
            }
            return store.state;
          };
          store.loading = readMode(sessionId).then((mode) => {
            if (generation === store.generation) store.confirmed = { mode, known: true };
            return settle({ mode, ready: true, known: true, saving: false, failed: false });
          }).catch((err) => {
            console.error("[dsh-approval-mode] read failed:", err);
            return settle({ mode: "ask", ready: true, known: false, saving: false, failed: true });
          });
          return store.loading;
        },
        /** Re-read a value some other surface may have moved (the default). */
        reload: function () {
          if (store.loading) {
            store.reloadQueued = true;
            return store.loading;
          }
          return store.load(true);
        },
        select: function (mode) {
          var generation = ++store.generation;
          store.publish({ mode, ready: true, known: true, saving: true, failed: false });
          if (!canFetch()) {
            store.publish({ mode: "ask", ready: true, known: false, saving: false, failed: true });
            return Promise.resolve(false);
          }
          return writeMode(sessionId, mode).then((ok) => {
            // The Host applied it even if a newer selection already took over,
            // so this stays the restore point until something else succeeds —
            // but responses can arrive out of order, and only the NEWEST success
            // may become the restore point.
            if (ok && generation > store.confirmedGeneration) {
              store.confirmedGeneration = generation;
              store.confirmed = { mode, known: true };
            }
            if (generation !== store.generation) return ok;
            if (!ok) {
              store.publish({
                mode: store.confirmed.mode,
                ready: true,
                known: store.confirmed.known,
                saving: false,
                failed: true
              });
              return false;
            }
            store.publish({ mode, ready: true, known: true, saving: false, failed: false });
            return true;
          }).catch((err) => {
            console.error("[dsh-approval-mode] write failed:", err);
            if (generation !== store.generation) return false;
            store.publish({
              mode: store.confirmed.mode,
              ready: true,
              known: store.confirmed.known,
              saving: false,
              failed: true
            });
            return false;
          });
        },
        /**
         * Follow the default store while a surface is mounted: a session with
         * no mode of its own resolves to the default, so a change there has to
         * re-read this session's effective value. Refcounted, because the
         * subscription lives with the component that made it.
         */
        watchDefault: function () {
          if (store.defaultWatchers === 0) {
            store.defaultUnsubscribe = storeFor(null).subscribe(function () { store.reload(); });
          }
          store.defaultWatchers += 1;
          return function () {
            store.defaultWatchers -= 1;
            if (store.defaultWatchers === 0 && store.defaultUnsubscribe !== null) {
              store.defaultUnsubscribe();
              store.defaultUnsubscribe = null;
            }
          };
        }
      };
      return store;
    }

    /** One store per address; the empty key is the default mode. */
    var modeStores = {};

    /** The store for one address (created on first use, then reused). */
    function storeFor(sessionId) {
      var key = typeof sessionId === "string" && sessionId.length > 0 ? sessionId : "";
      if (Object.prototype.hasOwnProperty.call(modeStores, key)) return modeStores[key];
      var store = createModeStore(key === "" ? null : key);
      modeStores[key] = store;
      return store;
    }

    /** Subscribe a surface to its addressed store (reads it on first use). */
    function useMode(sessionId) {
      var store = storeFor(sessionId);
      var pair = react.useState(store.get());
      var setSnapshot = pair[1];
      react.useEffect(() => {
        var unsubscribe = store.subscribe(setSnapshot);
        // The default store itself has nothing to follow.
        var unsubscribeDefault = store.sessionId === null ? null : store.watchDefault();
        return () => {
          unsubscribe();
          if (unsubscribeDefault !== null) unsubscribeDefault();
        };
      }, [store]);
      return pair[0];
    }

    function svg(pathD, opts) {
      var filled = opts && opts.filled;
      return react.createElement("svg", {
        width: 14,
        height: 14,
        viewBox: "0 0 14 14",
        fill: filled ? "currentColor" : "none",
        stroke: filled ? "none" : "currentColor",
        strokeWidth: 1.4,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
      }, react.createElement("path", { d: pathD }));
    }

    var ICON_SHIELD = "M7 1.2L12.2 3.3V7C12.2 10.2 9.9 12.7 7 13.3C4.1 12.7 1.8 10.2 1.8 7V3.3L7 1.2Z";
    var ICON_BOLT = "M7.8 1L3 8H6.4L5.4 13L11 6H7.4L7.8 1Z";
    var ICON_CHECK = "M3 7.5L6 10.5L11 4";
    var ICON_CHEVRON = "M3 5.5L7 9.5L11 5.5";

    /** Plugin context captured at apply time (slot components receive no ctx prop). */
    var pluginCtx = null;

    /**
     * The icon for one mode value: a filled shield for DSH's own ask flow, the
     * same shield hollow for the bypass that still stops at an escalation, and
     * the bolt for the bypass that stops at nothing.
     */
    function modeIcon(mode) {
      if (mode === "bypass") return svg(ICON_BOLT, { filled: true });
      if (mode === "bypass-except-escalation") return svg(ICON_SHIELD, { filled: false });
      return svg(ICON_SHIELD, { filled: true });
    }

    function ApprovalModeSelect(props) {
      // Translate function from the locale seat (injected via the `locale` registration option).
      var t = typeof props.t === "function" ? props.t : fallbackT;
      // The session this seat belongs to. A host that does not hand one out
      // leaves the picker addressing the default, which is what this plugin
      // did before the two values were split.
      var sessionId = typeof props.sessionId === "string" && props.sessionId.length > 0 ? props.sessionId : null;
      var snapshot = useMode(sessionId);
      var mode = snapshot.mode;
      var ready = snapshot.ready;
      // `known` is false when no Host value was read: the control must not
      // present the schema default as if it were the current setting.
      var known = snapshot.known;
      // 当前会话的权限投影（standard props 注入；Full Access 时审批模式不可切换）
      var permissions = typeof props.useProjection === "function" ? props.useProjection("permissions") : null;
      var fullAccess = !!(permissions && permissions.currentValue === "danger-full-access");
      var openPair = react.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      var historyPair = react.useState({ open: false, loading: false, error: false, entries: [], nextOffset: null });
      var historyState = historyPair[0];
      var setHistoryState = historyPair[1];

      var loadHistory = (offset, append) => {
        setHistoryState({ ...historyState, open: true, loading: true, error: false });
        readApprovalHistory(sessionId, offset).then((result) => {
          setHistoryState({
            open: true,
            loading: false,
            error: false,
            entries: append ? historyState.entries.concat(result.entries) : result.entries,
            nextOffset: result.nextOffset
          });
        }).catch((error) => {
          console.error("[dsh-approval-mode] could not load approval history:", error);
          setHistoryState({ ...historyState, open: true, loading: false, error: true });
        });
      };
      var showHistory = () => {
        setOpen(false);
        setHistoryState({ open: true, loading: false, error: false, entries: [], nextOffset: null });
        loadHistory(0, false);
      };
      var closeHistory = () => setHistoryState({ ...historyState, open: false });

      // 点击外部 / Escape 关闭菜单与历史弹层。
      react.useEffect(() => {
        if (!open && !historyState.open) return undefined;
        var onDown = (e) => {
          var target = e.target;
          if (!(target instanceof Element) || !target.closest(".dsh-approval-mode-root")) {
            setOpen(false);
            if (historyState.open) setHistoryState({ ...historyState, open: false });
          }
        };
        var onKey = (e) => {
          if (e.key === "Escape") {
            setOpen(false);
            if (historyState.open) setHistoryState({ ...historyState, open: false });
          }
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
          document.removeEventListener("mousedown", onDown);
          document.removeEventListener("keydown", onKey);
        };
      }, [open, historyState.open, setOpen, setHistoryState]);

      var toggle = () => setOpen(!open);
      var select = (next) => {
        if (fullAccess) return;
        setOpen(false);
        // The store reverts to the previous value if the Host refuses the write.
        storeFor(sessionId).select(next);
      };

      var current = known && MODES.indexOf(mode) >= 0 ? mode : null;
      // 两种绕过都算高风险配色；区别在图标与文案（中间那种仍会为提权弹窗）
      var warning = current === "bypass" || current === "bypass-except-escalation";
      // Full Access 时 DSH 不会发起审批请求（策略 never 直接放行/拒绝），
      // 模式不可切换：显示「绕过审批」（与实际行为一致）且置灰。
      var effective = fullAccess ? "bypass" : current;
      var label = known ? t("mode." + MODE_KEY[effective]) : t("mode.unknown");
      var title = !known
        ? t("title.unknown")
        : fullAccess
          ? t("title.fullAccess")
          : t("title." + MODE_KEY[current]);

      var historyItems = historyState.entries.map((entry, index) => {
        var decisionKey = entry.kind === "sandbox-escalation" ? "history.escalation"
          : entry.decision === "approved" ? "history.approved"
            : entry.decision === "denied" ? "history.denied" : "history.unavailable";
        var statusClass = "dsh-approval-mode-historyStatus" + (entry.decision === "denied" || entry.decision === "unavailable" ? " denied" : "");
        var time = typeof entry.timestamp === "string" ? new Date(entry.timestamp).toLocaleString() : "";
        var details = {
          description: entry.toolDescription,
          arguments: entry.arguments,
          model: entry.model,
          reason: entry.reason
        };
        return react.createElement("article", { key: entry.id || index, className: "dsh-approval-mode-historyItem" },
          react.createElement("div", { className: "dsh-approval-mode-historyItemHead" },
            react.createElement("span", { className: statusClass }, t(decisionKey)),
            react.createElement("strong", null, entry.toolName || "unknown")
          ),
          time && react.createElement("div", { className: "dsh-approval-mode-historyMeta" }, t("history.timestamp", { time })),
          entry.requestedSandboxMode && react.createElement("div", { className: "dsh-approval-mode-historyMeta" }, t("history.requestedMode", { mode: entry.requestedSandboxMode })),
          entry.reason && react.createElement("div", { className: "dsh-approval-mode-historyMeta" }, entry.reason),
          react.createElement("details", { className: "dsh-approval-mode-historyDetails" },
            react.createElement("summary", null, t("history.callDetails")),
            react.createElement("pre", null, JSON.stringify(details, null, 2))
          )
        );
      });

      return react.createElement("div", { className: "dsh-approval-mode-root" },
        react.createElement("button", {
          type: "button",
          className: "dsh-approval-mode-trigger" + (warning && !fullAccess ? " bypass" : ""),
          disabled: !ready || !known || fullAccess,
          onClick: toggle,
          "aria-label": t("aria.mode", { mode: label }),
          "aria-haspopup": "menu",
          "aria-expanded": open,
          title
        },
          react.createElement("span", { className: "dsh-approval-mode-triggerIcon" }, modeIcon(effective)),
          react.createElement("span", { className: "dsh-approval-mode-triggerLabel" }, label),
          react.createElement("span", { className: "dsh-approval-mode-chevron" + (open ? " open" : "") },
            svg(ICON_CHEVRON))
        ),
        open && react.createElement("div", { className: "dsh-approval-mode-menu", role: "menu" },
          MODES.map((value) => react.createElement("button", {
            key: value,
            type: "button",
            role: "menuitem",
            className: "dsh-approval-mode-item" + (value === "ask" ? "" : " danger") + (current === value ? " selected" : ""),
            onClick: () => select(value)
          },
            react.createElement("span", { className: "dsh-approval-mode-itemIcon" }, modeIcon(value)),
            react.createElement("span", null, t("item." + MODE_KEY[value])),
            current === value && react.createElement("span", { className: "dsh-approval-mode-itemCheck" }, svg(ICON_CHECK))
          )),
          react.createElement("div", { role: "separator", className: "dsh-approval-mode-historySeparator" }),
          react.createElement("button", {
            type: "button",
            role: "menuitem",
            className: "dsh-approval-mode-item",
            onClick: showHistory
          }, t("history.open"))
        ),
        historyState.open && react.createElement("section", {
          className: "dsh-approval-mode-history",
          role: "dialog",
          "aria-label": t("history.title")
        },
          react.createElement("div", { className: "dsh-approval-mode-historyHeader" },
            react.createElement("strong", { className: "dsh-approval-mode-historyTitle" }, t("history.title")),
            react.createElement("button", { type: "button", className: "dsh-approval-mode-historyAction", onClick: () => loadHistory(0, false) }, t("history.refresh")),
            react.createElement("button", { type: "button", className: "dsh-approval-mode-historyAction", onClick: closeHistory }, t("history.close"))
          ),
          historyState.loading && react.createElement("div", { className: "dsh-approval-mode-historyEmpty", role: "status" }, t("history.loading")),
          historyState.error && react.createElement("div", { className: "dsh-approval-mode-historyEmpty", role: "alert" }, t("history.error")),
          !historyState.loading && !historyState.error && historyState.entries.length === 0 && react.createElement("div", { className: "dsh-approval-mode-historyEmpty" }, t("history.empty")),
          !historyState.loading && !historyState.error && react.createElement("div", null, historyItems),
          historyState.nextOffset !== null && !historyState.loading && react.createElement("button", {
            type: "button",
            className: "dsh-approval-mode-historyAction",
            onClick: () => loadHistory(historyState.nextOffset, true)
          }, t("history.more"))
        )
      );
    }

    /**
     * The plugin's card on the settings page (设置 → 插件 → 插件配置).
     *
     * The plugins tab renders one card per SERVED settings namespace, so this
     * registration is keyed by {@link NS}: a deployment that does not compose
     * the Host half never dispatches it. The card owns its whole appearance —
     * the tab contributes only the `<ul>` — so its chrome mirrors the host's
     * own PluginCard rather than importing it (cross-plugin value imports are
     * not available to a client bundle).
     *
     * It edits the DEFAULT mode only: the picker's per-session choice is a
     * different value with a different address.
     */
    function ApprovalModeSettingsCard(props) {
      var t = typeof props.t === "function" ? props.t : fallbackT;
      var snapshot = useMode(null);
      var openPair = react.useState(false);
      var open = openPair[0];
      var setOpen = openPair[1];
      var current = snapshot.known && MODES.indexOf(snapshot.mode) >= 0 ? snapshot.mode : null;
      var busy = !snapshot.ready || snapshot.saving;

      // One line under the control, always: what the current value means, or
      // why it cannot be trusted right now. A card that silently showed a
      // stale value would be read as the setting itself.
      var hintKey = current === null ? "ask" : MODE_KEY[current];
      var hint = !snapshot.ready
        ? t("card.loading")
        : snapshot.failed || !snapshot.known
          ? t("card.error")
          : snapshot.saving
            ? t("card.saving")
            : t("card.hint." + hintKey);

      var option = (value) => {
        // No option is marked while the Host value is unknown: a checked radio
        // would assert a setting that was never read.
        var selected = current === value;
        return react.createElement("button", {
          key: value,
          type: "button",
          role: "radio",
          "aria-checked": selected,
          className: "dsh-approval-mode-cardSegBtn" + (selected ? " selected" : "") + (value === "ask" ? "" : " danger"),
          disabled: busy,
          onClick: () => {
            if (!selected) storeFor(null).select(value);
          }
        }, t("item." + MODE_KEY[value]));
      };

      return react.createElement("li", { className: "dsh-approval-mode-card" + (open ? " dsh-approval-mode-cardOpen" : "") },
        react.createElement("button", {
          type: "button",
          className: "dsh-approval-mode-cardHeader",
          "aria-expanded": open,
          onClick: () => setOpen(!open)
        },
          react.createElement("span", { className: "dsh-approval-mode-cardHeadText" },
            react.createElement("span", { className: "dsh-approval-mode-cardName" }, t("card.title")),
            react.createElement("span", { className: "dsh-approval-mode-cardDesc" }, t("card.desc"))
          ),
          react.createElement("span", { className: "dsh-approval-mode-cardChevron" + (open ? " dsh-approval-mode-cardChevronOpen" : "") },
            svg(ICON_CHEVRON))
        ),
        open && react.createElement("div", { className: "dsh-approval-mode-cardBody" },
          react.createElement("div", { className: "dsh-approval-mode-cardRow" },
            react.createElement("div", { className: "dsh-approval-mode-cardLabelBox" },
              react.createElement("div", { className: "dsh-approval-mode-cardLabel" }, t("card.rowLabel")),
              react.createElement("div", {
                className: "dsh-approval-mode-cardHint" + (snapshot.failed ? " error" : ""),
                role: "status"
              }, hint)
            ),
            react.createElement("div", {
              className: "dsh-approval-mode-cardSeg",
              role: "radiogroup",
              "aria-label": t("card.aria.options")
            },
              MODES.map(option)
            )
          ),
          react.createElement("div", { className: "dsh-approval-mode-cardFoot" }, t("card.footnote"))
        )
      );
    }

    /** Stable Cordis plugin name. */
    var name = "dsh-approval-mode";
    /** Required runtime services: slots (UI seats), locale (i18n dictionaries). */
    var inject = ["slots", "locale"];

    function apply(ctx) {
      pluginCtx = ctx;

      // Register the zh/en dictionaries with the DSH locale service.
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-approval-mode: locale");

      // Inject the control stylesheet; removed with the plugin fiber.
      var style = document.createElement("style");
      style.setAttribute("data-dsh-approval-mode", "");
      style.textContent = APPROVAL_MODE_CSS;
      document.head.appendChild(style);
      ctx.effect(() => () => style.remove(), "dsh-approval-mode: styles");

      // Register the picker into the seat beside the permission selector.
      // `locale: NS` makes the owner inject the bound translate function as `t`.
      ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
        name: "conversation.input.left",
        id: APPROVAL_MODE_SELECT_ID,
        order: 50,
        label: "审批模式",
        locale: NS
      }, ApprovalModeSelect));

      // Configuration page: the plugin's card in 设置 → 插件 → 插件配置, keyed by
      // the settings namespace the card edits. Nested inject on purpose — see
      // the Version posture note in this file's header.
      ctx.inject(["settingsScope"], (scoped) => {
        scoped.slots.inject("settings.plugin.item", () => scoped.slots.register({
          name: "settings.plugin.item",
          key: NS,
          locale: NS
        }, ApprovalModeSettingsCard));
      });
    }

    module.exports = { name, inject, apply };
    return module.exports;
  }
});
