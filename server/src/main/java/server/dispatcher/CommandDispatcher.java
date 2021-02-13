package server.dispatcher;

import com.google.common.base.Preconditions;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Optional;

/**
 * A command dispatcher that will execute commands as if it were the terminal.
 */
public class CommandDispatcher {
    private String uniqueIdentifier;

    private CommandDispatcher(String uniqueIdentifier) {
        this.uniqueIdentifier = uniqueIdentifier;
    }

    /**
     * Creates a new instance of a CommandDispatcher
     *
     * @param uniqueIdentifier An identifier to uniquely identify a specific instance of a CommandDispatcher
     */
    public static CommandDispatcher create(String uniqueIdentifier) {
        return new CommandDispatcher(uniqueIdentifier);
    }

    /**
     * Executes any command given on the command line.
     *
     * @param command The command to be executed
     * @return An Optional that will contain a CommandOutput unless there was an error in thread execution
     * @throws InterruptedException Thrown when a thread is interrupted
     */
    public Optional<CommandOutput> dispatch(ICommand command) throws InterruptedException {
        Preconditions.checkNotNull(command);
        Preconditions.checkNotNull(command.getExecutable());

        ByteArrayOutputStream standardOutput = new ByteArrayOutputStream();
        ByteArrayOutputStream errorOutput = new ByteArrayOutputStream();

        try {
            Executable executable = command.getExecutable();
            Process process = Runtime.getRuntime().exec(executable.getCmds());

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

    /**
     * @return Get the unique identifier for this CommandDispatcher
     */
    public String getUniqueIdentifier() {
        return uniqueIdentifier;
    }
}
