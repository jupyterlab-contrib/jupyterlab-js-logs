import { ReactWidget } from '@jupyterlab/apputils';

import { LogConsolePanel, LogLevel } from '@jupyterlab/logconsole';

import { HTMLSelect } from '@jupyterlab/ui-components';

import { IChangedArgs } from '@jupyterlab/coreutils';

import { UUID } from '@lumino/coreutils';

import React from 'react';

/**
 * A toolbar widget that switches log levels.
 */
export default class LogLevelSwitcher extends ReactWidget {
  /**
   * Construct a new cell type switcher.
   *
   * @param widget The log console panel
   * @param defaultLevel The initial logger level for the panel
   * @param setLevel Optional callback to set level
   */
  constructor(
    widget: LogConsolePanel,
    defaultLevel: LogLevel = 'info',
    setLevel?: (level: LogLevel) => void
  ) {
    super();
    this.addClass('jp-LogConsole-toolbarLogLevel');
    this._logConsole = widget;
    this._setLevel =
      setLevel ??
      ((level: LogLevel) => {
        if (this._logConsole.logger) {
          this._logConsole.logger.level = level;
        }
      });
    if (this._logConsole.logger) {
      this._setLevel(defaultLevel);
    }
    if (widget.source) {
      this.update();
    }
    widget.sourceChanged.connect(this._updateSource, this);
  }

  private _updateSource(
    sender: LogConsolePanel,
    { oldValue, newValue }: IChangedArgs<string | null>
  ): void {
    // Transfer stateChanged handler to new source logger
    if (oldValue !== null) {
      const logger = sender.loggerRegistry.getLogger(oldValue);
      logger.stateChanged.disconnect(this.update, this);
    }
    if (newValue !== null) {
      const logger = sender.loggerRegistry.getLogger(newValue);
      logger.stateChanged.connect(this.update, this);
    }
    this.update();
  }

  /**
   * Handle `change` events for the HTMLSelect component.
   *
   * @param event The HTML select event.
   */
  handleChange = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    this._setLevel(event.target.value as LogLevel);
    this.update();
  };

  /**
   * Handle `keydown` events for the HTMLSelect component.
   *
   * @param event The keyboard event.
   */
  handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.keyCode === 13) {
      this._logConsole.activate();
    }
  };

  render(): JSX.Element {
    const logger = this._logConsole.logger;
    return (
      <>
        <label
          htmlFor={this._id}
          className={
            logger === null
              ? 'jp-LogConsole-toolbarLogLevel-disabled'
              : undefined
          }
        >
          Log Level:
        </label>
        <HTMLSelect
          id={this._id}
          className="jp-LogConsole-toolbarLogLevelDropdown"
          onChange={this.handleChange}
          onKeyDown={this.handleKeyDown}
          value={logger?.level}
          aria-label="Log level"
          disabled={logger === null}
          options={
            logger === null
              ? []
              : ['Critical', 'Error', 'Warning', 'Info', 'Debug'].map(
                  label => ({ label, value: label.toLowerCase() })
                )
          }
        />
      </>
    );
  }
  private _logConsole: LogConsolePanel;
  private _setLevel: (level: LogLevel) => void;
  private _id = `level-${UUID.uuid4()}`;
}
