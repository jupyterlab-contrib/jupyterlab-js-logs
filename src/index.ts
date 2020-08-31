import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  ILayoutRestorer
} from '@jupyterlab/application';

import {
  ICommandPalette,
  MainAreaWidget,
  WidgetTracker,
  CommandToolbarButton
} from '@jupyterlab/apputils';

import { LoggerRegistry, LogConsolePanel } from '@jupyterlab/logconsole';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { addIcon, clearIcon, LabIcon } from '@jupyterlab/ui-components';

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
 * The main jupyterlab-js-logs plugin.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'js-logs',
  autoStart: true,
  requires: [IRenderMimeRegistry],
  optional: [ICommandPalette, ILayoutRestorer],
  activate: (
    app: JupyterFrontEnd,
    rendermime: IRenderMimeRegistry,
    palette: ICommandPalette | null,
    restorer: ILayoutRestorer | null
  ) => {
    const { commands } = app;

    let logConsolePanel: LogConsolePanel = null;
    let logConsoleWidget: MainAreaWidget<LogConsolePanel> = null;

    const tracker = new WidgetTracker<MainAreaWidget<LogConsolePanel>>({
      namespace: 'jupyterlab-js-logs'
    });

    const jsIcon = new LabIcon({
      name: 'js-logs:js-icon',
      svgstr: jsIconStr
    });

    const createLogConsoleWidget = (): void => {
      logConsolePanel = new LogConsolePanel(
        new LoggerRegistry({
          defaultRendermime: rendermime,
          maxLength: 1000
        })
      );

      logConsolePanel.source = 'js-logs';

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
        new LogLevelSwitcher(logConsoleWidget.content)
      );

      logConsoleWidget.disposed.connect(() => {
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
        if (logConsolePanel?.logger) {
          logConsolePanel.logger.level = args.level;
        }
      },
      isEnabled: () => logConsolePanel?.source !== null,
      label: args => `Set Log Level to ${args.level as string}`
    });

    commands.addCommand(CommandIDs.open, {
      label: 'Dev Tools Console Logs',
      caption: 'Dev Tools Console Logs',
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
        data: `${url}:${lineNo} ${msg}\n${error}`
      });
      return false;
    };

    const _debug = console.debug;
    const _log = console.log;
    const _info = console.info;
    const _warn = console.warn;
    const _error = console.error;

    const _exception = console.exception;
    const _trace = console.trace;
    const _table = console.table;

    window.console.debug = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'debug',
        data
      });
      _debug(...args);
    };

    window.console.log = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'debug',
        data
      });
      _log(...args);
    };

    window.console.info = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data
      });
      _info(...args);
    };

    window.console.warn = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'warning',
        data
      });
      _warn(...args);
    };

    window.console.error = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'critical',
        data
      });
      _error(...args);
    };

    window.console.exception = (message?: string, ...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'critical',
        data: `Exception: ${message}\n${data}`
      });
      _exception(...args);
    };

    window.console.trace = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data
      });
      _trace(...args);
    };

    window.console.table = (...args: any[]): void => {
      let data = '';
      args.forEach(arg => {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
      });

      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data
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
  }
};

export default extension;
