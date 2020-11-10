# Stage 3

In this stage we step it up and showcase how to integrate multiple `cc_library` targets from different packages.

Below, we see a similar configuration from Stage 2, except that this BUILD file is in a subdirectory called lib. In Bazel, subdirectories containing BUILD files are known as packages. The new property `visibility` will tell Bazel which package(s) can reference this target, in this case the `//main` package can use `hello_time` library.

```
cc_library(
    name = "hello_time",
    srcs = ["hello_time.cc"],
    hdrs = ["hello_time.h"],
    visibility = ["//main:__pkg__"],
)
```

To use our `hello_time` libary, an extra dependency is added in the form of //path/to/package:target_name, in this case, it's `//lib:hello_time`

```
cc_binary(
    name = "hello_world",
    srcs = ["hello_world.cc"],
    deps = [
        ":hello_greet",
        "//lib:hello_time",
    ],
)
```

To build this example you use (notice that 3 slashes are required in windows)

```
bazel build //main:hello_world

# In Windows, note the three slashes

bazel build ///main:hello_world
```
