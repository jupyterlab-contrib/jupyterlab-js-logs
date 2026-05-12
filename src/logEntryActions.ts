import { LogConsolePanel, LogOutputModel } from '@jupyterlab/logconsole';

import type { IOutputModel } from '@jupyterlab/rendermime';

import { Token } from '@lumino/coreutils';

import { DisposableDelegate, IDisposable } from '@lumino/disposable';

import { ISignal, Signal } from '@lumino/signaling';

const ACTIONS_CONTAINER_CLASS = 'jp-JSLogs-entryActions';
const ACTION_BUTTON_CLASS = 'jp-JSLogs-entryActionButton';
const OUTPUT_AREA_CLASS = 'jp-OutputArea';
const OUTPUT_ITEM_CLASS = 'jp-OutputArea-child';

type ISerializedLogOutput = Record<string, unknown>;

/**
 * The log message passed to action handlers.
 */
export interface ILogEntryActionMessage {
  /**
   * Source logger identifier.
   */
  source: string;

  /**
   * Position in the source log model.
   */
  entryIndex: number;

  /**
   * Log level as stored in the log model.
   */
  level: string;

  /**
   * Entry timestamp when available.
   */
  timestamp: Date | null;

  /**
   * Raw output payload for integrations that need full context.
   */
  output: ISerializedLogOutput;
}

/**
 * Action metadata for log entry actions.
 */
export interface ILogEntryAction {
  /**
   * Stable identifier for this action.
   */
  id: string;

  /**
   * Label shown in the action button.
   */
  label: string;

  /**
   * Optional tooltip.
   */
  caption?: string;

  /**
   * Optional visibility predicate.
   */
  isVisible?: (message: ILogEntryActionMessage) => boolean;

  /**
   * Action callback.
   */
  execute: (message: ILogEntryActionMessage) => void | Promise<void>;
}

/**
 * Registry for actions shown on log entries.
 */
export interface ILogEntryActionRegistry extends IDisposable {
  /**
   * Signal emitted when actions are added/removed or updated.
   */
  readonly changed: ISignal<this, void>;

  /**
   * Register an action.
   */
  register(action: ILogEntryAction): IDisposable;

  /**
   * Whether any actions are currently registered.
   */
  hasActions(): boolean;

  /**
   * Get actions for a given log message.
   */
  getActions(message: ILogEntryActionMessage): ReadonlyArray<ILogEntryAction>;
}

/**
 * Token for the log entry action registry.
 */
export const ILogEntryActionRegistry = new Token<ILogEntryActionRegistry>(
  'jupyterlab-js-logs:ILogEntryActionRegistry'
);

/**
 * Default in-memory action registry.
 */
export class LogEntryActionRegistry implements ILogEntryActionRegistry {
  get changed(): ISignal<this, void> {
    return this._changed;
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    this._actions.clear();
    Signal.clearData(this);
  }

  register(action: ILogEntryAction): IDisposable {
    if (this._isDisposed) {
      throw new Error('Log entry action registry is disposed.');
    }
    const actionId = action.id.trim();
    if (actionId === '') {
      throw new Error('Log entry action id cannot be empty.');
    }
    if (this._actions.has(actionId)) {
      throw new Error(`Log entry action "${actionId}" is already registered.`);
    }

    this._actions.set(actionId, action);
    this._changed.emit(void 0);

    return new DisposableDelegate(() => {
      const current = this._actions.get(actionId);
      if (current === action) {
        this._actions.delete(actionId);
        this._changed.emit(void 0);
      }
    });
  }

  hasActions(): boolean {
    return this._actions.size > 0;
  }

  getActions(message: ILogEntryActionMessage): ReadonlyArray<ILogEntryAction> {
    return [...this._actions.values()]
      .filter(action => this._isActionVisible(action, message))
      .sort((left, right) => {
        if (left.id === right.id) {
          return 0;
        }
        return left.id < right.id ? -1 : 1;
      });
  }

  private _isActionVisible(
    action: ILogEntryAction,
    message: ILogEntryActionMessage
  ): boolean {
    if (!action.isVisible) {
      return true;
    }
    try {
      return action.isVisible(message);
    } catch (error) {
      console.error(`Failed to evaluate visibility for "${action.id}".`, error);
      return false;
    }
  }

  private _isDisposed = false;
  private _changed = new Signal<this, void>(this);
  private _actions = new Map<string, ILogEntryAction>();
}

/**
 * Renders registered actions on log entries.
 */
export class LogEntryActionsRenderer implements IDisposable {
  constructor(options: LogEntryActionsRenderer.IOptions) {
    this._panel = options.panel;
    this._registry = options.registry;

    this._panel.sourceChanged.connect(this._scheduleRender, this);
    this._panel.sourceDisplayed.connect(this._scheduleRender, this);
    this._registry.changed.connect(this._onRegistryChanged, this);

    this._scheduleRender();
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;

    this._clearActions();

    this._panel.sourceChanged.disconnect(this._scheduleRender, this);
    this._panel.sourceDisplayed.disconnect(this._scheduleRender, this);
    this._registry.changed.disconnect(this._onRegistryChanged, this);
  }

  private _onRegistryChanged = (): void => {
    this._registryRevision++;
    this._scheduleRender();
  };

  private _scheduleRender = (): void => {
    if (this._renderScheduled || this._isDisposed) {
      return;
    }
    this._renderScheduled = true;
    requestAnimationFrame(() => {
      this._renderScheduled = false;
      if (!this._isDisposed) {
        this._render();
      }
    });
  };

  private _render(): void {
    const source = this._panel.source;
    const logger = this._panel.logger;
    if (!source || !logger) {
      this._clearActions();
      return;
    }
    if (
      this._lastRenderedSource === source &&
      this._lastRenderedLoggerVersion === logger.version &&
      this._lastRenderedRegistryRevision === this._registryRevision
    ) {
      return;
    }

    this._clearActions();
    if (!this._registry.hasActions()) {
      this._lastRenderedSource = source;
      this._lastRenderedLoggerVersion = logger.version;
      this._lastRenderedRegistryRevision = this._registryRevision;
      return;
    }

    const outputArea = this._findVisibleOutputArea();
    if (!outputArea) {
      return;
    }

    const entries = logger.outputAreaModel;
    const outputItems = this._getOutputItems(outputArea);
    const count = Math.min(entries.length, outputItems.length);

    for (let index = 0; index < count; index++) {
      const message = this._toMessage(source, entries.get(index), index);
      const actions = this._registry.getActions(message);
      if (actions.length === 0) {
        continue;
      }

      const container = this._createActionsContainer(actions, message);
      if (container.childElementCount > 0) {
        outputItems[index].appendChild(container);
      }
    }

    this._lastRenderedSource = source;
    this._lastRenderedLoggerVersion = logger.version;
    this._lastRenderedRegistryRevision = this._registryRevision;
  }

  private _clearActions(): void {
    this._panel.node
      .querySelectorAll(`.${ACTIONS_CONTAINER_CLASS}`)
      .forEach(node => node.remove());
  }

  private _findVisibleOutputArea(): HTMLElement | null {
    const outputAreas = Array.from(
      this._panel.node.getElementsByClassName(OUTPUT_AREA_CLASS)
    );
    for (const area of outputAreas) {
      if (area instanceof HTMLElement && area.offsetParent !== null) {
        return area;
      }
    }
    return null;
  }

  private _getOutputItems(outputArea: HTMLElement): HTMLElement[] {
    return Array.from(outputArea.children).filter(
      node =>
        node instanceof HTMLElement &&
        node.classList.contains(OUTPUT_ITEM_CLASS)
    ) as HTMLElement[];
  }

  private _toMessage(
    source: string,
    outputModel: IOutputModel,
    entryIndex: number
  ): ILogEntryActionMessage {
    const level =
      outputModel instanceof LogOutputModel ? outputModel.level : 'unknown';
    const timestamp =
      outputModel instanceof LogOutputModel ? outputModel.timestamp : null;

    const output = serializeOutput(outputModel);

    return {
      source,
      entryIndex,
      level,
      timestamp,
      output
    };
  }

  private _createActionsContainer(
    actions: ReadonlyArray<ILogEntryAction>,
    message: ILogEntryActionMessage
  ): HTMLDivElement {
    const container = document.createElement('div');
    container.className = ACTIONS_CONTAINER_CLASS;

    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${ACTION_BUTTON_CLASS} jp-Button jp-mod-minimal`;
      button.textContent = action.label;
      button.title = action.caption ?? action.label;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this._executeAction(action, message);
      });
      container.appendChild(button);
    }

    return container;
  }

  private _executeAction(
    action: ILogEntryAction,
    message: ILogEntryActionMessage
  ): void {
    try {
      const result = action.execute(message);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        void (result as Promise<void>).catch(error => {
          console.error(
            `Failed to run log entry action "${action.id}".`,
            error
          );
        });
      }
    } catch (error) {
      console.error(`Failed to run log entry action "${action.id}".`, error);
    }
  }

  private _isDisposed = false;
  private _renderScheduled = false;
  private _registryRevision = 0;
  private _lastRenderedSource: string | null = null;
  private _lastRenderedLoggerVersion: number | null = null;
  private _lastRenderedRegistryRevision = -1;
  private _panel: LogConsolePanel;
  private _registry: ILogEntryActionRegistry;
}

export namespace LogEntryActionsRenderer {
  export interface IOptions {
    panel: LogConsolePanel;
    registry: ILogEntryActionRegistry;
  }
}

function serializeOutput(outputModel: IOutputModel): ISerializedLogOutput {
  const output: ISerializedLogOutput = {
    output_type: outputModel.type,
    data:
      typeof outputModel.data === 'object' &&
      outputModel.data !== null &&
      !Array.isArray(outputModel.data)
        ? (outputModel.data as Record<string, unknown>)
        : {},
    metadata:
      typeof outputModel.metadata === 'object' &&
      outputModel.metadata !== null &&
      !Array.isArray(outputModel.metadata)
        ? (outputModel.metadata as Record<string, unknown>)
        : {}
  };

  return output;
}
