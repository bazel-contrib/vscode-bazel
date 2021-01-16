package server.buildifier;

/**
 * A buildifier execution wrapper.
 */
interface Runner {
    /**
     * Executes the buildifier. This method will produce output even if the buildifier executes and runs
     * into an error during execution. Exceptions are only thrown if the buildifier can't be run.
     *
     * @param input Specifies how to run the buildifier.
     * @return A representation of the buildifier executable's output. This includes stdout and stderr.
     * @throws BuildifierException If the buildifier failed to execute.
     */
    RunnerOutput run(RunnerInput input) throws BuildifierException;
}
