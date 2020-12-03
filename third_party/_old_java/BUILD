load("@rules_java//java:defs.bzl", "java_import", "java_library", "java_plugin")

package(default_visibility = ["//visibility:public"])

java_import(
    name = "bytebuddy",
    jars = [
        "bytebuddy/byte-buddy-1.9.7.jar",
        "bytebuddy/byte-buddy-agent-1.9.7.jar",
    ],
)

java_import(
    name = "gson",
    jars = [
        "gson/gson-2.8.0.jar",
    ],
)

java_import(
    name = "guava",
    jars = [
        "guava/failureaccess-1.0.1.jar",
        "guava/guava-29.0-jre.jar",
    ],
)

java_import(
    name = "junit",
    jars = [
        "junit/junit-4.13.jar",
    ],
)

java_import(
    name = "log4j",
    jars = [
        "log4j/log4j-api-2.14.0.jar",
        "log4j/log4j-core-2.14.0.jar",
    ],
    deps = [
        ":gson",
    ],
)

java_import(
    name = "lsp4j",
    jars = [
        "lsp4j/org.eclipse.lsp4j-0.10.0.jar",
        "lsp4j/org.eclipse.lsp4j.generator-0.10.0.jar",
        "lsp4j/org.eclipse.lsp4j.jsonrpc-0.10.0.jar",
        "lsp4j/org.eclipse.lsp4j.websocket-0.10.0.jar",
    ],
)

java_import(
    name = "mockito",
    jars = [
        "mockito/mockito-core-3.6.28.jar",
    ],
    deps = [
        ":bytebuddy",
        ":objenesis",
    ],
)

java_import(
    name = "objenesis",
    jars = [
        "objenesis/objenesis-3.1.jar",
    ],
)
