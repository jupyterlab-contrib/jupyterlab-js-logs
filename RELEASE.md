# Making a new release of JupyterLab-js-logs

## Automated releases with `jupyter_releaser`

The recommended way to make a release is to use [`jupyter_releaser`](https://github.com/jupyter-server/jupyter_releaser#checklist-for-adoption).

---

Below are the instructions to make releases manually. They are kept here as reference and might be removed at some point in the future.

### Getting a clean environment

Creating a new environment can help avoid pushing local changes and any extra tag.

```bash
mamba create -q -y -n jlab-js-logs-release -c conda-forge twine nodejs keyring pip jupyter-packaging jupyterlab=3.0
conda activate jlab-js-logs-release
```

Alternatively, the local repository can be cleaned with:

```bash
git clean -fdx
```

### Releasing on PyPI

Make sure the `dist/` folder is empty.

1. If the JupyterLab extension has changed, make sure to bump the version number in `./package.json`
2. Update [setup.py](./setup.py) and [binder/environment.yml](./binder/environment.yml) with the new version number
3. `python setup.py sdist bdist_wheel`
4. Double check the size of the bundles in the `dist/` folder
5. Run the tests
6. Make sure the JupyterLab extension is correctly bundled in source distribution
7. `export TWINE_USERNAME=mypypi_username`
8. `twine upload dist/*`

## Making a new release of JupyterLab-js-logs

The prebuilt extension is already packaged in the main Python package.

However we also publish it to `npm` to:

- let other third-party extensions depend on `jupyterlab-js-logs`
- let users install from source if they would like to

### Releasing on npm

1. The version number in [./package.json](./package.json) should have been updated during the release step of the Python package (see above)
2. `npm login`
3. `npm publish`

### Releasing on conda-forge

The simplest is to wait for the bot to automatically open the PR.

Alternatively, to do the update manually:

1. Open a new PR on https://github.com/conda-forge/jupyterlab-js-logs-feedstock to update the `version` and the `sha256` hash (see [example](https://github.com/conda-forge/jupyterlab-js-logs/pull/12/files))
2. Wait for the tests
3. Merge the PR

The new version will be available on `conda-forge` soon after.

### Committing and tagging

Commit the changes, create a new release tag, and update the `stable` branch (for Binder), where `x.y.z` denotes the new version:

```bash
git checkout master
git add setup.py binder/environment.yml package.json
git commit -m "Release x.y.z"
git tag x.y.z
git checkout stable
git reset --hard master
git push origin master stable x.y.z
```
