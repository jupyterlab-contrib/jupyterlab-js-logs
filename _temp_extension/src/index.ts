import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the jupyterlab-js-logs extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-js-logs:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension jupyterlab-js-logs is activated!');
  }
};

export default extension;
