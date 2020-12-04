workspace(name = "bazel_language_server")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")

###############################
## MAVEN - JAVA DEPENDENCIES ##
###############################

RULES_JVM_EXTERNAL_TAG = "3.3"
RULES_JVM_EXTERNAL_SHA = "d85951a92c0908c80bd8551002d66cb23c3434409c814179c0ff026b53544dab"

http_archive(
    name = "rules_jvm_external",
    strip_prefix = "rules_jvm_external-%s" % RULES_JVM_EXTERNAL_TAG,
    sha256 = RULES_JVM_EXTERNAL_SHA,
    url = "https://github.com/bazelbuild/rules_jvm_external/archive/%s.zip" % RULES_JVM_EXTERNAL_TAG,
)

load("@rules_jvm_external//:defs.bzl", "maven_install")

maven_install(
    artifacts = [
        # guava
        "com.google.guava:guava:29.0-jre",

        # gson
        "com.google.code.gson:gson:2.8.6",

        # junit
        "junit:junit:4.12",

        # lsp4j
        "org.eclipse.lsp4j:org.eclipse.lsp4j:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.jsonrpc:0.10.0",

        # log4j
        "org.apache.logging.log4j:log4j-core:2.13.3",
        "org.apache.logging.log4j:log4j-api:2.13.3",

        # mockito
        "org.mockito:mockito-core:3.5.15",
    ],
    repositories = [
        "https://repo1.maven.org/maven2",
        "https://jcenter.bintray.com/",
        "https://maven.google.com",
    ],
)

#######################################
## BAZELBUILD - JAVA STARLARK PARSER ##
#######################################

# TODO (josiahsrc): Add in the bazel starlark parser. Once the starlark 
# becomes publically available, use that import instead of the raw jar. 
# This will allow this code to be up-to-date with the remote repo.
