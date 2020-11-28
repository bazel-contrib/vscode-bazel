import org.junit.runner.RunWith;
import org.junit.runners.Suite;
import org.junit.runners.Suite.SuiteClasses;

import server.BazelServicesTest;
import server.util.DocumentTrackerTest;

// https://stackoverflow.com/questions/46365464/how-to-run-all-tests-in-bazel-from-a-single-java-test-rule
@RunWith(Suite.class)
@SuiteClasses({
    BazelServicesTest.class,
    DocumentTrackerTest.class
})
public class AllTests {}
