package server.starlark;

import net.starlark.java.syntax.FileOptions;
import net.starlark.java.syntax.ParserInput;
import net.starlark.java.syntax.StarlarkFile;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

/**
 * A wrapper around the Starlark language processing capabilities needed for this language
 * server. We use this class as a facade here because Bazel's Starlark code is prone to
 * change.
 *
 * @see <a href="https://github.com/bazelbuild/bazel/issues/12608">GitHub Starlark issue</a>
 */
public class StarlarkFacade {
    private static final Logger logger = LogManager.getLogger(StarlarkFacade.class);

    private StarlarkFacade() {

    }

    public static ParseOutput parse(ParseInput input) throws ParseException {
        // A file path is required by Starlark. But it is not needed for us at the moment,
        // so it is left empty here.
        final byte[] fileBytes = input.getBytes();
        final String filePath = "";

        logger.info("About to parse some input");

        final ParserInput parserInput = ParserInput.fromUTF8(fileBytes, filePath);
        final FileOptions fileOptions = FileOptions.DEFAULT;
        final StarlarkFile starlarkFile = StarlarkFile.parse(parserInput, fileOptions);

        logger.info(String.format("Parsed some input. Found %d errors with the file.", starlarkFile.errors().size()));
        logger.info(String.format("Starlark comment count = %s", starlarkFile.getComments().size()));
        logger.info(String.format("Starlark first comment = %s",
                starlarkFile.getComments().size() > 0 ? starlarkFile.getComments().get(0) : "No comments"));
        logger.info(String.format("Starlark statement count = %s", starlarkFile.getComments().size()));
        logger.info(String.format("Starlark first statement = %s",
                starlarkFile.getStatements().size() > 0 ? starlarkFile.getStatements().get(0).kind().toString() : "No statements"));

        final ParseOutput output = new ParseOutput();

        return output;
    }
}
