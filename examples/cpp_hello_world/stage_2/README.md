# Stage 2

### Library

Here, we introduce the `cc_library` rule for building C++ libraries. We have a `cc_library` named `hello_greet` and its header and source files are defined accordingly.

```
cc_library(
    name = "hello_greet",
    srcs = ["hello_greet.cc"],
    hdrs = ["hello_greet.h"],
)
```

### Binary

The `cc_binary` rule we saw in stage 1 has not changed, except that we now depend on the `cc_library` `hello_greet`.

```
cc_binary(
    name = "hello_world",
    srcs = ["hello_world.cc"],
    deps = [
        ":hello_greet",
    ],
)
```

To build this example you use (notice that 3 slashes are required in windows)

```
bazel build //main:hello_world

# In Windows, note the three slashes

bazel build ///main:hello_world
```
