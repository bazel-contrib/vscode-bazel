package server.logger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;

import java.io.PrintStream;

import static org.junit.jupiter.api.Assertions.*;

class BazelServerLoggerTest {

    private BazelServerLogger testLogger;

    @Mock
    private PrintStream mockStream;

    @BeforeEach
    public void setUp() {
        MockitoAnnotations.openMocks(this);
        BazelServerLogger.setStream(mockStream);
        testLogger = BazelServerLogger.getLogger();
    }

    @Test
    public void loggerCallsPrintlnOnStream() {
        String message = "Arbitrary text";
        testLogger.log(message);
        Mockito.verify(mockStream).println(message);
    }

}
