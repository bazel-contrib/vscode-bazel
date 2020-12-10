#!/usr/bin/env bash

# This script will test a specified project.

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
    echo "Some or all of the parameters are empty.";
    usage
fi

if [[ "$name" == "server" ]]
then
    (
        bazel test //server:test
    )
elif [[ "$name" == "client_vscode" ]]
then
    (
        cd client_vscode
        npm i
        npm run compile
        npm test
    )
else
    echo "The name must be one of the provided targets.";
    usage
fi

