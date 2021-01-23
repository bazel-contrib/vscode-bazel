package server.dispatcher;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.UnsupportedEncodingException;

public class CommandDispatcher {
    private ByteArrayOutputStream errorOutput;
    private OS_TYPE osType = null;
    private ByteArrayOutputStream standardOutput;
    private String uniqueIdentifier;

    private CommandDispatcher(String uniqueIdentifier) {
        this.uniqueIdentifier = uniqueIdentifier;
        getOperatingSystem();
        standardOutput = new ByteArrayOutputStream();
        errorOutput = new ByteArrayOutputStream();
    }

    public static CommandDispatcher create(String uniqueIdentifier) {
        return new CommandDispatcher(uniqueIdentifier);
    }

    public boolean dispatch(ICommand command) {
        int returnCode = 0;
        try {
            Process process = Runtime.getRuntime().exec(getShell());
            new Thread(new SyncPipe(process.getErrorStream(), errorOutput)).start();
            new Thread(new SyncPipe(process.getInputStream(), standardOutput)).start();
            PrintWriter stdin = new PrintWriter(process.getOutputStream());
            command.dispatch(stdin);
            stdin.close();
            returnCode = process.waitFor();
        } catch (IOException | InterruptedException e) {
            e.printStackTrace();
        }
        return returnCode == 0;
    }

    public String getErrorOutput() throws UnsupportedEncodingException {
        return errorOutput.toString("UTF-8");
    }

    public String getStandardOutput() throws UnsupportedEncodingException {
        return standardOutput.toString("UTF-8");
    }

    public String getUniqueIdentifier() {
        return uniqueIdentifier;
    }

    private void getOperatingSystem() {
        if (System.getProperty("os.name").toLowerCase().contains("windows")) {
            osType = OS_TYPE.WINDOWS;
        } else {
            osType = OS_TYPE.UNIX;
        }
    }

    private String getShell() {
        if (osType == null) {
            getOperatingSystem();
        }

        if (osType == OS_TYPE.WINDOWS) {
            return "cmd";
        } else {
            return "sh";
        }
    }

    private enum OS_TYPE {
        UNIX, WINDOWS
    }
}
