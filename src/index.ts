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

import {
  LoggerRegistry,
  LogConsolePanel,
  ILogPayload
} from '@jupyterlab/logconsole';

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

    // Keep the LogConsolePanel as a global variable
    // to use it from outside the activate function.
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
        Private.logger = null;
        logConsoleWidget = null;
        logConsolePanel = null;
        commands.notifyCommandChanged();
      });

      app.shell.add(logConsoleWidget, 'main', { mode: 'split-bottom' });
      void tracker.add(logConsoleWidget);

      logConsoleWidget.update();
      commands.notifyCommandChanged();

      Private.logger = (msg: ILogPayload) => {
        logConsolePanel?.logger?.log(msg);
      };

      while (Private.MESSAGES.length > 0) {
        Private.log(Private.MESSAGES.shift());
      }
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

window.onerror = (msg, url, lineNo, columnNo, error): boolean => {
  Private.log({
    type: 'text',
    level: 'critical',
    data: `${url}:${lineNo} ${msg}\n${error}`
  });

  return false;
};

const _debug = console.debug;
window.console.debug = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'debug',
    data: Private.parseArgs(args)
  });

  _debug(...args);
};

const _log = console.log;
window.console.log = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'debug',
    data: Private.parseArgs(args)
  });

  _log(...args);
};

const _info = console.info;
window.console.info = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'info',
    data: Private.parseArgs(args)
  });

  _info(...args);
};

const _warn = console.warn;
window.console.warn = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'warning',
    data: Private.parseArgs(args)
  });

  _warn(...args);
};

const _error = console.error;
window.console.error = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'critical',
    data: Private.parseArgs(args)
  });

  _error(...args);
};

const _exception = console.exception;
window.console.exception = (message?: string, ...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'critical',
    data: `Exception: ${message}\n${Private.parseArgs(args)}`
  });

  _exception(...args);
};

const _trace = console.trace;
window.console.trace = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'info',
    data: Private.parseArgs(args)
  });

  _trace(...args);
};

const _table = console.table;
window.console.table = (...args: any[]): void => {
  Private.log({
    type: 'text',
    level: 'info',
    data: Private.parseArgs(args)
  });

  _table(...args);
};

namespace Private {
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

  /**
   * Parse the argument of a console message.
   * @param args Arguments.
   * @returns a string with the message.
   */
  export const parseArgs = (args: any[]): string => {
    let data = '';
    args.forEach(arg => {
      try {
        data +=
          (typeof arg === 'object' && arg !== null
            ? JSON.stringify(arg)
            : arg) + ' ';
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

  // Store messages until the plugin is activated
  export const MESSAGES: ILogPayload[] = [];

  export function log(msg: ILogPayload): void {
    if (logger) {
      logger(msg);
    } else {
      MESSAGES.push(msg);
    }
  }

  export let logger: (msg: ILogPayload) => void;
}
