workspace(name = "bazel_language_server")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

#########################
## JAVA MAVEN EXTERNAL ##
#########################

RULES_JVM_EXTERNAL_TAG = "3.3"

RULES_JVM_EXTERNAL_SHA = "d85951a92c0908c80bd8551002d66cb23c3434409c814179c0ff026b53544dab"

# Download the jvm rules.
http_archive(
    name = "rules_jvm_external",
    sha256 = RULES_JVM_EXTERNAL_SHA,
    strip_prefix = "rules_jvm_external-%s" % RULES_JVM_EXTERNAL_TAG,
    url = "https://github.com/bazelbuild/rules_jvm_external/archive/%s.zip" % RULES_JVM_EXTERNAL_TAG,
)

# Load macros and repository rules.
load("@rules_jvm_external//:defs.bzl", "maven_install")

# Install maven packages.
maven_install(
    artifacts = [
        "com.google.code.gson:gson:2.8.6",
        "com.google.guava:guava:29.0-jre",
        "com.google.jimfs:jimfs:1.2",
        "com.google.protobuf:protobuf-java:3.14.0",
        "junit:junit:4.12",
        "org.apache.logging.log4j:log4j-core:2.13.3",
        "org.apache.logging.log4j:log4j-api:2.13.3",
        "org.eclipse.lsp4j:org.eclipse.lsp4j:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.jsonrpc:0.10.0",
        "org.mockito:mockito-core:3.5.15",
    ],
    repositories = [
        "https://repo1.maven.org/maven2",
        "https://jcenter.bintray.com/",
        "https://maven.google.com",
    ],
)

##########
## JAVA ##
##########

# Download the java rules.
http_archive(
    name = "rules_java",
    sha256 = "220b87d8cfabd22d1c6d8e3cdb4249abd4c93dcc152e0667db061fb1b957ee68",
    url = "https://github.com/bazelbuild/rules_java/releases/download/0.1.1/rules_java-0.1.1.tar.gz",
)

# Load macros and repository rules.
load("@rules_java//java:repositories.bzl", "rules_java_dependencies", "rules_java_toolchains")

# Declare indirect dependencies and register toolchains.
rules_java_dependencies()

rules_java_toolchains()

##############
## PROTOBUF ##
##############

# Download the protobuf rules.
http_archive(
    name = "rules_proto",
    sha256 = "602e7161d9195e50246177e7c55b2f39950a9cf7366f74ed5f22fd45750cd208",
    strip_prefix = "rules_proto-97d8af4dc474595af3900dd85cb3a29ad28cc313",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_proto/archive/97d8af4dc474595af3900dd85cb3a29ad28cc313.tar.gz",
        "https://github.com/bazelbuild/rules_proto/archive/97d8af4dc474595af3900dd85cb3a29ad28cc313.tar.gz",
    ],
)

# Load macros and repository rules.
load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")

# Declare indirect dependencies and register toolchains.
rules_proto_dependencies()

rules_proto_toolchains()
