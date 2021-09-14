# jupyterlab-js-logs

![Github Actions Status](https://github.com/QuantStack/jupyterlab-js-logs/workflows/Build/badge.svg)
[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/QuantStack/jupyterlab-js-logs/master?urlpath=lab)

JupyterLab extension to show the js logs from the browser dev tools console

![screencast](https://user-images.githubusercontent.com/591645/88792612-c7c60180-d19b-11ea-8467-c23abcabcb09.gif)

## Requirements

* JupyterLab >= 2.0

## Install

```bash
jupyter labextension install jupyterlab-js-logs
```

## Contributing

This extension was bootstrapped from the [custom-log-console](https://github.com/jupyterlab/extension-examples/tree/master/custom-log-console) example contributed by [Carlos Herrero](https://github.com/hbcarlos), from the [`jupyterlab-extension-examples`](https://github.com/jupyterlab/extension-examples) repository.


### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Move to jupyterlab-js-logs directory

# Install dependencies
jlpm
# Build Typescript source
jlpm build
# Link your development version of the extension with JupyterLab
jupyter labextension install .
# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

Now every change will be built locally and bundled into JupyterLab. Be sure to refresh your browser page after saving file changes to reload the extension (note: you'll need to wait for webpack to finish, which can take 10s+ at times).

### Uninstall

```bash

jupyter labextension uninstall jupyterlab-js-logs
```
