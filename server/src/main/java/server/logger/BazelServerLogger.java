package server.logger;


import java.io.PrintStream;

public class BazelServerLogger {

    private static BazelServerLogger instance;

    private PrintStream logStream;

    private BazelServerLogger(PrintStream stream) {
        this.logStream = stream;
    }

    private BazelServerLogger() {
        this.logStream = System.out;
    }

    public static BazelServerLogger getLogger() {
        if (instance == null) {
            instance = new BazelServerLogger();
        }
        return instance;
    }

    public void log(String line) {
        logStream.println(line);
    }


}
