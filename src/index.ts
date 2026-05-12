import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import {
  Clipboard,
  ICommandPalette,
  IWidgetTracker,
  MainAreaWidget,
  WidgetTracker,
  CommandToolbarButton
} from '@jupyterlab/apputils';

import {
  LoggerRegistry,
  LogConsolePanel,
  LogLevel
} from '@jupyterlab/logconsole';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { ISettingRegistry } from '@jupyterlab/settingregistry';

import {
  addIcon,
  clearIcon,
  copyIcon,
  LabIcon
} from '@jupyterlab/ui-components';

import { Token } from '@lumino/coreutils';

import {
  LogEntryActionsRenderer,
  ILogEntryActionMessage,
  ILogEntryActionRegistry,
  LogEntryActionRegistry
} from './logEntryActions';

import LogLevelSwitcher from './logLevelSwitcher';

import jsIconStr from '../style/js.svg';

/**
 * The command IDs used by the js-logs plugin.
 */
export namespace CommandIDs {
  export const checkpoint = 'js-logs:checkpoint';

  export const clear = 'js-logs:clear';

  export const level = 'js-logs:level';

  export const open = 'js-logs:open';
}

/**
 * The log console tracker token.
 */
export interface ILogConsoleTracker
  extends IWidgetTracker<MainAreaWidget<LogConsolePanel>> {}

export const ILogConsoleTracker = new Token<ILogConsoleTracker>(
  'jupyterlab-js-logs:ILogConsoleTracker'
);

const PLUGIN_ID = 'js-logs';
const ACTIONS_PLUGIN_ID = 'jupyterlab-js-logs:entry-actions';
const DEFAULT_ACTIONS_PLUGIN_ID = 'jupyterlab-js-logs:default-entry-actions';
const SETTINGS_PLUGIN_ID = 'jupyterlab-js-logs:plugin';
const DEFAULT_LEVEL_SETTING = 'defaultLevel';
const SHOW_LEVEL_CHANGE_MESSAGES_SETTING = 'showLevelChangeMessages';
const DEFAULT_LOG_LEVEL: LogLevel = 'info';
const DEFAULT_SHOW_LEVEL_CHANGE_MESSAGES = false;
const LOG_LEVELS: LogLevel[] = [
  'critical',
  'error',
  'warning',
  'info',
  'debug'
];

const isLogLevel = (value: unknown): value is LogLevel =>
  typeof value === 'string' && LOG_LEVELS.includes(value as LogLevel);

const logEntryActionsExtension: JupyterFrontEndPlugin<ILogEntryActionRegistry> =
  {
    id: ACTIONS_PLUGIN_ID,
    autoStart: true,
    provides: ILogEntryActionRegistry,
    activate: () => new LogEntryActionRegistry()
  };

const formatLogEntryForClipboard = (message: ILogEntryActionMessage): string =>
  JSON.stringify(
    {
      ...message,
      timestamp: message.timestamp ? message.timestamp.toISOString() : null
    },
    null,
    2
  );

const defaultLogEntryActionsExtension: JupyterFrontEndPlugin<void> = {
  id: DEFAULT_ACTIONS_PLUGIN_ID,
  autoStart: true,
  requires: [ILogEntryActionRegistry],
  activate: (
    _app: JupyterFrontEnd,
    actionRegistry: ILogEntryActionRegistry
  ) => {
    actionRegistry.register({
      id: 'jupyterlab-js-logs:copy-log-entry',
      icon: copyIcon,
      caption: 'Copy this log entry context',
      execute: message => {
        Clipboard.copyToSystem(formatLogEntryForClipboard(message));
      }
    });
  }
};

/**
 * The main jupyterlab-js-logs plugin.
 */
const extension: JupyterFrontEndPlugin<ILogConsoleTracker> = {
  id: PLUGIN_ID,
  autoStart: true,
  provides: ILogConsoleTracker,
  requires: [IRenderMimeRegistry, ILogEntryActionRegistry],
  optional: [ICommandPalette, ILayoutRestorer, ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    rendermime: IRenderMimeRegistry,
    actionRegistry: ILogEntryActionRegistry,
    palette: ICommandPalette | null,
    restorer: ILayoutRestorer | null,
    settingsRegistry: ISettingRegistry | null
  ) => {
    const { commands } = app;

    let logConsolePanel: LogConsolePanel | null = null;
    let logConsoleWidget: MainAreaWidget<LogConsolePanel> | null = null;
    let defaultLogLevel: LogLevel = DEFAULT_LOG_LEVEL;
    let showLevelChangeMessages = DEFAULT_SHOW_LEVEL_CHANGE_MESSAGES;

    const tracker = new WidgetTracker<MainAreaWidget<LogConsolePanel>>({
      namespace: 'jupyterlab-js-logs'
    });

    const jsIcon = new LabIcon({
      name: 'js-logs:js-icon',
      svgstr: jsIconStr
    });

    const setLoggerLevel = (level: LogLevel): void => {
      const logger = logConsolePanel?.logger;
      if (!logger) {
        return;
      }
      if (logger.level !== level) {
        logger.level = level;
      }
    };

    const applySettings = (settings: ISettingRegistry.ISettings): void => {
      const configuredLevel = settings.get(DEFAULT_LEVEL_SETTING).composite;
      const nextDefaultLogLevel = isLogLevel(configuredLevel)
        ? configuredLevel
        : DEFAULT_LOG_LEVEL;
      const configuredShowLevelChangeMessages = settings.get(
        SHOW_LEVEL_CHANGE_MESSAGES_SETTING
      ).composite;
      showLevelChangeMessages =
        typeof configuredShowLevelChangeMessages === 'boolean'
          ? configuredShowLevelChangeMessages
          : DEFAULT_SHOW_LEVEL_CHANGE_MESSAGES;
      if (nextDefaultLogLevel !== defaultLogLevel) {
        defaultLogLevel = nextDefaultLogLevel;
        setLoggerLevel(defaultLogLevel);
      } else {
        defaultLogLevel = nextDefaultLogLevel;
      }
    };

    const removeLastMetadataEntry = (
      logger: NonNullable<LogConsolePanel['logger']>
    ): void => {
      const entries = logger.outputAreaModel.toJSON();
      if (entries.length === 0) {
        return;
      }
      const lastEntry = entries[entries.length - 1] as { level?: unknown };
      if (lastEntry.level !== 'metadata') {
        return;
      }
      entries.pop();
      logger.outputAreaModel.fromJSON(entries);
    };

    const connectLevelChangeHandler = (panel: LogConsolePanel): void => {
      const logger = panel.logger;
      if (!logger) {
        return;
      }
      logger.stateChanged.connect((sender, change) => {
        if (change.name === 'level' && !showLevelChangeMessages) {
          removeLastMetadataEntry(sender);
        }
      });
    };

    if (settingsRegistry) {
      void settingsRegistry
        .load(SETTINGS_PLUGIN_ID)
        .then(settings => {
          applySettings(settings);
          settings.changed.connect(() => applySettings(settings));
        })
        .catch(reason => {
          console.error(
            `Failed to load ${SETTINGS_PLUGIN_ID} settings.\n${reason}`
          );
        });
    }

    const createLogConsoleWidget = (): void => {
      logConsolePanel = new LogConsolePanel(
        new LoggerRegistry({
          defaultRendermime: rendermime,
          maxLength: 1000
        })
      );

      logConsolePanel.source = 'js-logs';
      connectLevelChangeHandler(logConsolePanel);

      let entryActionRenderer: LogEntryActionsRenderer | null =
        new LogEntryActionsRenderer({
          panel: logConsolePanel,
          registry: actionRegistry
        });

      logConsoleWidget = new MainAreaWidget<LogConsolePanel>({
        content: logConsolePanel
      });
      logConsoleWidget.addClass('jp-LogConsole');
      logConsoleWidget.title.label = 'Dev Tools Console Logs';
      logConsoleWidget.title.icon = jsIcon;

      logConsoleWidget.toolbar.addItem(
        'checkpoint',
        new CommandToolbarButton({
          commands,
          id: CommandIDs.checkpoint
        })
      );

      logConsoleWidget.toolbar.addItem(
        'clear',
        new CommandToolbarButton({
          commands,
          id: CommandIDs.clear
        })
      );

      logConsoleWidget.toolbar.addItem(
        'level',
        new LogLevelSwitcher(
          logConsoleWidget.content,
          defaultLogLevel,
          setLoggerLevel
        )
      );

      logConsoleWidget.disposed.connect(() => {
        entryActionRenderer?.dispose();
        entryActionRenderer = null;
        logConsoleWidget = null;
        logConsolePanel = null;
        commands.notifyCommandChanged();
      });

      app.shell.add(logConsoleWidget, 'main', { mode: 'split-bottom' });
      void tracker.add(logConsoleWidget);

      logConsoleWidget.update();
      commands.notifyCommandChanged();
    };

    commands.addCommand(CommandIDs.checkpoint, {
      execute: () => logConsolePanel?.logger?.checkpoint(),
      icon: addIcon,
      isEnabled: () => logConsolePanel?.source !== null,
      label: 'Add Checkpoint'
    });

    commands.addCommand(CommandIDs.clear, {
      execute: () => logConsolePanel?.logger?.clear(),
      icon: clearIcon,
      isEnabled: () => logConsolePanel?.source !== null,
      label: 'Clear Log'
    });

    commands.addCommand(CommandIDs.level, {
      execute: (args: any) => {
        if (isLogLevel(args.level)) {
          setLoggerLevel(args.level);
        }
      },
      isEnabled: () => logConsolePanel?.source !== null,
      label: args => `Set Log Level to ${args.level as string}`
    });

    commands.addCommand(CommandIDs.open, {
      label: 'Show Dev Tools Console Logs',
      caption: 'Show Dev Tools Console Logs',
      isToggled: () => logConsoleWidget !== null,
      execute: () => {
        if (logConsoleWidget) {
          logConsoleWidget.dispose();
        } else {
          createLogConsoleWidget();
        }
      }
    });

    window.onerror = (msg, url, lineNo, columnNo, error): boolean => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'critical',
        data: `${url}:${lineNo}:${columnNo} ${msg}\n${error}`
      });
      return false;
    };

    const _debug = console.debug;
    const _log = console.log;
    const _info = console.info;
    const _warn = console.warn;
    const _error = console.error;

    // const _exception = console.exception;
    const _trace = console.trace;
    const _table = console.table;

    // https://stackoverflow.com/a/11616993
    // We need to clear cache after each use.
    let cache: any = [];
    const refReplacer = (key: any, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          return;
        }
        cache.push(value);
      }
      return value;
    };

    const parseArgs = (args: any[]): string => {
      let data = '';
      args.forEach(arg => {
        try {
          if (arg instanceof Error) {
            data += arg.stack || arg.message || arg;
          } else {
            data +=
              (typeof arg === 'object' && arg !== null
                ? JSON.stringify(arg)
                : arg) + ' ';
          }
        } catch (e) {
          try {
            const msg =
              'This error contains a object with a circular reference. Duplicated attributes might have been dropped during the process of removing the reference.\n';
            const obj = JSON.stringify(arg, refReplacer);
            cache = [];
            console.error(msg, obj);
            data += obj;
          } catch (e) {
            data += ' ';
          }
        }
      });
      return data;
    };

    window.console.debug = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'debug',
        data: parseArgs(args)
      });
      _debug(...args);
    };

    window.console.log = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'debug',
        data: parseArgs(args)
      });
      _log(...args);
    };

    window.console.info = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data: parseArgs(args)
      });
      _info(...args);
    };

    window.console.warn = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'warning',
        data: parseArgs(args)
      });
      _warn(...args);
    };

    window.console.error = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'critical',
        data: parseArgs(args)
      });
      _error(...args);
    };

    // window.console.exception = (message?: string, ...args: any[]): void => {
    //   logConsolePanel?.logger?.log({
    //     type: 'text',
    //     level: 'critical',
    //     data: `Exception: ${message}\n${parseArgs(args)}`
    //   });
    //   _exception(...args);
    // };

    window.console.trace = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data: parseArgs(args)
      });
      _trace(...args);
    };

    window.console.table = (...args: any[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data: parseArgs(args)
      });
      _table(...args);
    };

    if (palette) {
      palette.addItem({
        command: CommandIDs.open,
        category: 'Developer'
      });
    }

    if (restorer) {
      restorer.restore(tracker, {
        command: CommandIDs.open,
        name: () => 'js-logs'
      });
    }

    return tracker;
  }
};

const plugins: JupyterFrontEndPlugin<any>[] = [
  logEntryActionsExtension,
  defaultLogEntryActionsExtension,
  extension
];

export default plugins;

export {
  ILogEntryAction,
  ILogEntryActionMessage,
  ILogEntryActionRegistry
} from './logEntryActions';
