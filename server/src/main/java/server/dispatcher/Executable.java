package server.dispatcher;

import com.google.common.base.Preconditions;

/**
 * Represents an executable to be invoked by the dispatcher.
 */
public class Executable {
    private final String[] cmds;

    private Executable(String[] program) {
        this.cmds = program;
    }

    /**
     * Gets the commands to execute in the dispatcher.
     *
     * @return The commands to execute in the dispatcher.
     */
    public String[] getCmds() {
        return cmds;
    }

    /**
     * Gets an executable shell.
     *
     * @return cmd if windows, otherwise use sh.
     */
    public static Executable fromShell() {
        if (System.getProperty("os.name").toLowerCase().contains("windows")) {
            return new Executable(new String[]{"cmd"});
        } else {
            return new Executable(new String[]{"sh"});
        }
    }

    /**
     * Creates an executable from a list of command line args.
     *
     * @param cmds The commands to run.
     * @return An executable tailored for the given list of commands.
     */
    public static Executable fromCmds(String[] cmds) {
        Preconditions.checkNotNull(cmds);
        return new Executable(cmds);
    }
}
