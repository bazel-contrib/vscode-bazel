#!/usr/bin/env bash

# This script will create a dev environment for a given client.
# A dev environment will include example bazel projects for
# debugging.

# set -eu

usage()
{
   echo "Usage: $0 -n name"
   echo -e "-n The name of the client, e.g. client_vscode"
   exit 1
}

while getopts "n:" opt
do
   case "$opt" in
      n ) name="$OPTARG" ;;
      ? ) usage ;;
   esac
done

if [ -z "$name" ]
then
   echo "Some or all of the parameters are empty";
   usage
fi

# Move into the top-level directory of the project.
cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null

# Create the dev environment with all copied files.
DIRECTORY="/workspaces/dev/$name"
rm -rf "$DIRECTORY" 2> /dev/null || true
mkdir -p "$DIRECTORY"
cp -arf examples "$DIRECTORY/examples"
