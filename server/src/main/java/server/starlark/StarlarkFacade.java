package server.starlark;

import com.google.common.base.Preconditions;
import net.starlark.java.syntax.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.nio.file.Files;

/**
 * A wrapper around the Starlark language processing capabilities needed for this language
 * server. We use this class as a facade here because Bazel's Starlark code is prone to
 * change.
 * <p>
 * In the future we will use protobufs to communicate with the Golang implementation of the
 * Starlark language. But, for the purposes of getting something working, we use Bazel's
 * Java implementation of the Starlark implementation here.
 *
 * @see <a href="https://github.com/bazelbuild/bazel/issues/12608">GitHub Starlark issue</a>
 */
public class StarlarkFacade {
    private static final Logger logger = LogManager.getLogger(StarlarkFacade.class);

    private StarlarkFacade() {

    }

    public static ParseOutput parse(ParseInput input) throws ParseException {
//        // A file path is required by Starlark. But it is not needed for us at the moment,
//        // so it is left empty here.
//        final byte[] fileBytes = input.getBytes();
//        final String filePath = "";

        Preconditions.checkNotNull(input);
        Preconditions.checkNotNull(input.getFilePath());

        // Read all text from file input files.
        byte[] bytesToParse;
        try {
            bytesToParse = Files.readAllBytes(input.getFilePath());
        } catch (IOException e) {
            throw new ParseException();
        }

        final ParserInput parserInput = ParserInput.fromUTF8(bytesToParse, input.getFilePath().toString());
        final FileOptions fileOptions = FileOptions.DEFAULT;
        final StarlarkFile starlarkFile = StarlarkFile.parse(parserInput, fileOptions);

        logger.info("Path to starlark file: " + input.getFilePath());
        logger.info(starlarkFile.prettyPrint());

        for (int i = 0; i < starlarkFile.getStatements().size(); ++i) {
            final Statement statement = starlarkFile.getStatements().get(i);
            final Statement.Kind kind = statement.kind();
            logger.info("Doing something with kind: " + kind);

            if (kind == Statement.Kind.DEF) {
                DefStatement stmt = (DefStatement) statement;
                StringBuilder builder = new StringBuilder();
                builder.append("This is a def statement and it has:\n");
                builder.append("ID=" + stmt.getIdentifier() + "\n");

                builder.append("PARAMS:");
                for (Parameter s : stmt.getParameters()) {
                    builder.append("\tNAME=" + s.getName());
                    builder.append("\tDEFAULT_VALUE=" + s.getDefaultValue());
                    builder.append("\tID=" + s.getIdentifier() + "\n");
                }

                builder.append("BODY:");
                for (Statement s : stmt.getBody()) {
                    builder.append("\tSTATEMENT_KIND=" + s.kind() + "\n");
                }

                logger.info(builder.toString());
            } else if (kind == Statement.Kind.EXPRESSION) {
                ExpressionStatement stmt = (ExpressionStatement) statement;
                StringBuilder builder = new StringBuilder();
                builder.append("This is a EXPRESSION statement and it has:\n");

                final Expression expression = stmt.getExpression();
                final Expression.Kind k = expression.kind();
                builder.append("KIND=" + kind + "\n");

                if (k == Expression.Kind.CALL) {
                    final CallExpression callExpression = (CallExpression) expression;

                    builder.append("ARGS:");
                    for (Argument argument : callExpression.getArguments()) {
                        builder.append("\tNAME=" + argument.getName());
                        builder.append("\tVALUE=" + argument.getValue() + "\n");
                    }
                } else {
                    builder.append("DIDN'T account for that kind: " + k + "\n");
                }

                logger.info(builder.toString());
            } else if (kind == Statement.Kind.LOAD) {
                LoadStatement stmt = (LoadStatement) statement;
                logger.info("This is a load statement and it tried to import: " + stmt.getImport());
            } else {
                logger.info("DIDN'T IMPLEMENT THAT KIND!");
            }
        }

//        for (int i = 0; i < starlarkFile.getStatements().size(); ++i) {
//            StringBuilder builder = new StringBuilder();
//            builder.append(starlarkFile.getStatements().get(i).kind() + "\n");
//            builder.append(starlarkFile.getStatements().get(i) as
//        }

//        logger.info(String.format("Parsed some input. Found %d errors with the file.", starlarkFile.errors().size()));
//        logger.info(String.format("Starlark comment count = %s", starlarkFile.getComments().size()));
//        logger.info(String.format("Starlark first comment = %s",
//                starlarkFile.getComments().size() > 0 ? starlarkFile.getComments().get(0) : "No comments"));
//        logger.info(String.format("Starlark statement count = %s", starlarkFile.getComments().size()));
//        logger.info(String.format("Starlark first statement = %s",
//                starlarkFile.getStatements().size() > 0 ? starlarkFile.getStatements().get(0).kind().toString() : "No statements"));

        final ParseOutput output = new ParseOutput();

        return output;
    }
}
