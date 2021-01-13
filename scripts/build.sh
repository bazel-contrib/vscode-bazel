#!/usr/bin/env bash

# This script will build a specified project.

usage()
{
    echo "Usage: $0 -n name"
    echo -e "-n { client_vscode | server }"
    exit 1
}

cd "$(dirname "$0")/../"

while getopts "n:" opt
do
    case "$opt" in
        n ) name="$OPTARG" ;;
        ? ) usage ;;
    esac
done

if [ -z "$name" ]
then
    echo "Some or all of the parameters were empty.";
    usage
fi

if [[ "$name" == "server" ]]
then
    (
        bazel build //server:server_deploy.jar
    )
elif [[ "$name" == "client_vscode" ]]
then
    (
        # Remove the old server if it exists.
        echo "Removing old server code..."
        rm -rf client_vscode/bin/* 2> /dev/null || true
        
        # Build the server with dependencies.
        echo "Building server jar..."
        ./scripts/build.sh -n server
        
        # Move the language server into the client bin (for development purposes).
        echo "Migrating server jar..."
        mkdir bin 2> /dev/null || true
        cp bazel-bin/server/bazel_ls_deploy.jar client_vscode/bin/bazel_ls_deploy.jar
 
        echo "Building client..."
        cd client_vscode
        npm i
        npm run compile
    )
else
    echo "The name must be one of the provided targets.";
    usage
fi

