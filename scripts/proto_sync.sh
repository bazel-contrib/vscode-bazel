#!/usr/bin/env bash

# This script will update the vendored protocol buffer files
# (.proto) for the specified project.

usage()
{
    echo "Usage: $0 -n name"
    echo -e "-n { server }"
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
        while IFS= read -r path; do
            mkdir -p "$(dirname "server/src/main/proto/$path")"
            curl -L \
                "https://raw.githubusercontent.com/bazelbuild/bazel/master/$path" \
                > "server/src/main/proto/$path"
        done < server/src/main/proto/vendored.txt
    )
else
    echo "The name must be one of the provided targets.";
    usage
fi
