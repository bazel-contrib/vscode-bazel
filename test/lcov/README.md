Those files were generated using

`bazel coverage --nocache_test_results --combined_report=lcov --instrument_test_targets $target`

for the following targets

java.lcov: `//examples/java-native/src/test/java/com/example/myproject:hello` from https://github.com/bazelbuild/bazel
cpp.lcov: `//src/test/cpp:rc_file_test` from https://github.com/bazelbuild/bazel
rust.lcov: `//util/label:label_test` from https://github.com/bazelbuild/rules_rust
go.lcov: `//config:go_default_test` from https://github.com/buchgr/bazel-remote
