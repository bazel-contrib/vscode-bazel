# How to deploy the extension

```
./scripts/build.sh -n client_vscode
(cd client_vscode && vsce package)
```

From there, give the generated vsix file to Jared, he'll know what to do.

## Fixes

If client fails to build, do

```
rm -rf client_vscode/node_modules
```

and run again.
