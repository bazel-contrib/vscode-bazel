package server;

import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

import server.BazelServicesTest;
import server.buildifier.BuildifierTest;
import server.utils.DocumentTrackerTest;
import server.utils.UtilityTest;

// [TODO] 
// Create an automated test runner so we don't have to explicitly define tests here.
// https://stackoverflow.com/questions/46365464/how-to-run-all-tests-in-bazel-from-a-single-java-test-rule
@RunWith(Suite.class)
@SuiteClasses({
        BazelServicesTest.class,
        BuildifierTest.class,
        DocumentTrackerTest.class,
        UtilityTest.class,
})
public class AllServerTests {}
