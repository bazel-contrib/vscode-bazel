# --- begin runfiles.bash initialization v3 ---
# Copy-pasted from the Bazel Bash runfiles library v3.
set -uo pipefail; set +e; f=bazel_tools/tools/bash/runfiles/runfiles.bash
# shellcheck disable=SC1090
source "${RUNFILES_DIR:-/dev/null}/$f" 2>/dev/null || \
source "$(grep -sm1 "^$f " "${RUNFILES_MANIFEST_FILE:-/dev/null}" | cut -f2- -d' ')" 2>/dev/null || \
source "$0.runfiles/$f" 2>/dev/null || \
source "$(grep -sm1 "^$f " "$0.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
source "$(grep -sm1 "^$f " "$0.exe.runfiles_manifest" | cut -f2- -d' ')" 2>/dev/null || \
{ echo>&2 "ERROR: cannot find $f"; exit 1; }; f=; set -e
# --- end runfiles.bash initialization v3 ---

tar_prefix=bazel-8.0.1
bazel_dir="$BUILD_WORKSPACE_DIRECTORY/third_party/bazel"
rm -fr "$bazel_dir"
mkdir -p "$bazel_dir"

tar -C "$bazel_dir" -xf $(rlocation bazel_tar/file/bazel.tar) --strip-components 1 \
    $tar_prefix/src/main/java/com/google/devtools/build/lib/buildeventstream/proto \
    $tar_prefix/src/main/java/com/google/devtools/build/lib/starlarkdebug/proto \
    $tar_prefix/src/main/java/com/google/devtools/build/lib/packages/metrics/BUILD \
    $tar_prefix/src/main/java/com/google/devtools/build/lib/packages/metrics/package_load_metrics.proto \
    $tar_prefix/src/main/java/com/google/devtools/build/lib/packages/metrics/package_metrics.proto \
    $tar_prefix/src/main/protobuf

buildozer="$(rlocation buildozer/buildozer)"

# Remove rules inside array comprehensions that buildozer can't find
sed -i '34,42d' $bazel_dir/src/main/protobuf/BUILD

$buildozer delete \
    //third_party/bazel/...:%java_proto_library \
    //third_party/bazel/...:%java_grpc_library \
    //third_party/bazel/...:%java_library \
    //third_party/bazel/...:%py_proto_library \
    //third_party/bazel/...:%cc_proto_library \
    //third_party/bazel/...:%cc_grpc_library \
    //third_party/bazel/...:%java_library_srcs \
    //third_party/bazel/src/main/protobuf:bazel_output_service_rev2_proto \
    //third_party/bazel/src/main/protobuf:remote_execution_log_proto \
    //third_party/bazel/src/main/protobuf:dist_jars \
    //third_party/bazel/src/main/java/com/google/devtools/build/lib/packages/metrics:dist_jars

$buildozer 'remove default_applicable_licenses' //third_party/bazel/src/main/java/com/google/devtools/build/lib/packages/metrics:__pkg__

$buildozer \
    'substitute deps @com_google_protobuf//(.*) @protobuf//${1}' \
    'substitute deps //src/main/(.*) //third_party/bazel/src/main/${1}' \
    'substitute_load @com_google_protobuf//(.*) @protobuf//${1}' \
    'fix unusedLoads' \
    //third_party/bazel/...:all


# Update imports in proto files
find $bazel_dir/src/main -type f -name '*.proto' | xargs sed -i -E 's|import "src/main/(.*?)"|import "third_party/bazel/src/main/\1"|g'
