# How to deploy the extension

```
./scripts/build.sh -n client_vscode
(cd client_vscode && vsce package)
```

From there, give the generated VSIX file to Jared, he'll know what to do.

# Installing the Extension
To install the extension, click the extensions icon in VSCode.

Then, click the three dots at the top of the extensions window and select ```Install from VSIX```.

Locate the VSIX file on your local machine with the file explorer and ta-da! The extension is ready to go.

## Fixes

If client fails to build, do

```
rm -rf client_vscode/node_modules
```

and run again.
