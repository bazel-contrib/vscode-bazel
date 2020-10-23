package server.logger;


import java.io.PrintStream;

public class BazelServerLogger {

    private static BazelServerLogger instance;

    private static PrintStream logStream = System.out;

    static void setStream(PrintStream stream) {
        logStream = stream;
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
