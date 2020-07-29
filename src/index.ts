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

import { addIcon, clearIcon, listIcon } from '@jupyterlab/ui-components';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import LogLevelSwitcher from './logLevelSwitcher';

export namespace CommandIDs {
  export const checkpoint = 'js-logs:checkpoint';

  export const clear = 'js-logs:clear';

  export const level = 'js-logs:level';

  export const open = 'js-logs:open';
}

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

    if (restorer) {
      restorer.restore(tracker, {
        command: CommandIDs.open,
        name: () => 'js-logs'
      });
    }

    commands.addCommand(CommandIDs.checkpoint, {
      execute: () => logConsolePanel?.logger?.checkpoint(),
      icon: addIcon,
      isEnabled: () => !!logConsolePanel && logConsolePanel.source !== null,
      label: 'Add Checkpoint'
    });

    commands.addCommand(CommandIDs.clear, {
      execute: () => logConsolePanel?.logger?.clear(),
      icon: clearIcon,
      isEnabled: () => !!logConsolePanel && logConsolePanel.source !== null,
      label: 'Clear Log'
    });

    commands.addCommand(CommandIDs.level, {
      execute: (args: any) => {
        if (logConsolePanel?.logger) {
          logConsolePanel.logger.level = args.level;
        }
      },
      isEnabled: () => !!logConsolePanel && logConsolePanel.source !== null,
      label: args => `Set Log Level to ${args.level as string}`
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
      logConsoleWidget.title.icon = listIcon;

      logConsoleWidget.toolbar.addItem(
        'checkpoint',
        new CommandToolbarButton({
          commands: app.commands,
          id: CommandIDs.checkpoint
        })
      );

      logConsoleWidget.toolbar.addItem(
        'clear',
        new CommandToolbarButton({
          commands: app.commands,
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
      tracker.add(logConsoleWidget);

      logConsoleWidget.update();
      commands.notifyCommandChanged();
    };

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

    if (palette) {
      palette.addItem({
        command: CommandIDs.open,
        category: 'Debug'
      });
    }

    const _debug = console.debug;
    const _log = console.log;
    const _warn = console.warn;
    const _error = console.error;

    console.debug = (...args: string[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'debug',
        data: args.join(' ')
      });
      _debug(...args);
    };

    console.info = console.log = (...args: string[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'info',
        data: args.join(' ')
      });
      _log(...args);
    };

    console.warn = (...args: string[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'warning',
        data: args.join(' ')
      });
      _warn(...args);
    };

    console.error = (...args: string[]): void => {
      logConsolePanel?.logger?.log({
        type: 'text',
        level: 'critical',
        data: args.join(' ')
      });
      _error(...args);
    };
  }
};

export default extension;
