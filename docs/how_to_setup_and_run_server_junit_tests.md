# How to Create and run Server Junit Test

### Prerequisites
1. Have project open in latest Docker Container and run from Docker container
OR
1. Have bazel installed on your device
2. Have Java 11+ installed on your device

### Steps to Setup Junit Tests
1. Create your Junit Tests within the server/test/java folder
2. Make sure your Junit Build file includes the correct Testing dependencies. An example is shown below
```
load("@rules_java//java:defs.bzl", "java_library")
package(default_visibility = ["//visibility:public"])

java_library(
    name = "bazel_workspace_api",
    srcs = [
        "APITests.java",
    ],
    deps = [
        "//server/src/main/java/server/bazel/bazelWorkspaceAPI",
        "//server/src/main/java/server/bazel/tree",
        "//third_party/java:guava",
        "//third_party/java:jmifs",
        "//third_party/java:junit",
        "//third_party/java:mockito",
    ],
)
```
3. Add your class to the AllServerTests.java file as seen below
Currently found at : server/src/test/java/server/AllServerTests.java
```
@RunWith(Suite.class)
@SuiteClasses({
        BazelServicesTest.class,
        BuildifierTest.class,
        DocumentTrackerTest.class,
        NullabilityTest.class,
        BazelTest.class,
        APITests.class
})
public class AllServerTests {}
 ```
4. Make sure to import your test file at the top of the AllServerTests.java file
```
import server.bazel.bazelWorkspaceAPI.*;
```
5. Add your test file to the AllServerTest BUILD file dependencies by adding the build Target you defined in your Test files BUILD target
6. In this case it looks like the example below
```
java_library(
    name = "all_tests",
    srcs = [
        "AllServerTests.java",
    ],
    deps = [
        ":server",
        "//server/src/test/java/server/analysis",
        "//server/src/test/java/server/bazel/cli:bazel_cli",
        "//server/src/test/java/server/buildifier",
        "//server/src/test/java/server/utils",
        "//server/src/test/java/server/bazel/bazelWorkspaceAPI:bazel_workspace_api",
        "//third_party/java:junit",
    ],
)
```

At this point your Tests are ready to run.

### Steps to Run Junit Tests

1. Make sure you've followed the steps
2. Run the test.sh script found in the scripts folder of the root directory
3. Make sure you have -n and server as arguments when running the test.sh script. It should look like the line below
```
./scripts/test.sh -n server
```
4. Your terminal should output the test results as seen below
```
root@104d804ccdd7:/workspaces/bazel-ls# ./scripts/test.sh -n server
INFO: Analyzed target //server:test (0 packages loaded, 0 targets configured).
INFO: Found 1 test target...
FAIL: //server:test (see /root/.cache/bazel/_bazel_root/b6c461a968fec2e46e36e50e9d835b1e/execroot/bazel_language_server/bazel-out/k8-fastbuild/testlogs/server/test/test.log)
INFO: From Testing //server:test:
==================== Test output for //server:test:
JUnit4 Test Runner
INFO: Elapsed time: 4.988s, Critical Path: 4.87s
INFO: 2 processes: 1 internal, 1 processwrapper-sandbox.
INFO: Build completed, 1 test FAILED, 2 total actions
//server:test                                                            FAILED in 4.8s
  /root/.cache/bazel/_bazel_root/b6c461a968fec2e46e36e50e9d835b1e/execroot/bazel_language_server/bazel-out/k8-fastbuild/testlogs/server/test/test.log

INFO: Build completed, 1 test FAILED, 2 total actions
```
5.  To see a more detailed report open the log file outputted by the terminal. This log file will look similar to the text below
```
JUnit4 Test Runner
.OpenJDK 64-Bit Server VM warning: Sharing is only supported for boot loader classes because bootstrap classpath has been appended
..................E
Time: 4.469
There was 1 failure:
1) doesSettingAndCreatingAPIWork(server.bazel.bazelWorkspaceAPI.APITests)
java.lang.NullPointerException
	at server.bazel.bazelWorkspaceAPI.APITests.setup(APITests.java:22)
	at java.base/jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
	.
	.
	.

```

Thats it.
