package server.dispatcher;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Optional;

public class CommandDispatcher {
    private OS_TYPE osType = null;
    private String uniqueIdentifier;

    private CommandDispatcher(String uniqueIdentifier) {
        this.uniqueIdentifier = uniqueIdentifier;
        getOperatingSystem();
    }

    public static CommandDispatcher create(String uniqueIdentifier) {
        return new CommandDispatcher(uniqueIdentifier);
    }

    public Optional<CommandOutput> dispatch(ICommand command) throws InterruptedException {
        ByteArrayOutputStream standardOutput = new ByteArrayOutputStream();
        ByteArrayOutputStream errorOutput = new ByteArrayOutputStream();
        try {
            Process process = Runtime.getRuntime().exec(getShell());
            new Thread(new SyncPipe(process.getErrorStream(), errorOutput)).start();
            new Thread(new SyncPipe(process.getInputStream(), standardOutput)).start();
            PrintWriter stdin = new PrintWriter(process.getOutputStream());
            command.dispatch(stdin);
            stdin.close();
            int returnCode = process.waitFor();
            return Optional.of(new CommandOutput(standardOutput, errorOutput, returnCode));
        } catch (IOException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
            throw e;
        }
        return Optional.empty();
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
