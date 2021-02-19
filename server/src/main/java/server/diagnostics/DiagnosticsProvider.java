package server.diagnostics;

import com.google.common.base.Preconditions;
import net.starlark.java.syntax.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.*;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPI;
import server.bazel.interp.CompatabilityUtility;
import server.bazel.interp.Label;
import server.bazel.interp.LabelSyntaxException;
import server.bazel.tree.BuildTarget;
import server.bazel.tree.WorkspaceTree;
import server.utils.DocumentTracker;
import server.utils.Logging;
import server.workspace.Workspace;

import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

// TODO: This should be the analysis stuff.
public class DiagnosticsProvider {
    private static final Logger logger = LogManager.getLogger(DiagnosticsProvider.class);

    public DiagnosticsProvider() {

    }

    public void handleDiagnostics(DiagnosticParams params) {
        logger.info(String.format("Handling diagnostics for params:\n%s", params));

        Preconditions.checkNotNull(params);
        Preconditions.checkNotNull(params.getClient());
        Preconditions.checkNotNull(params.getTracker());
        Preconditions.checkNotNull(params.getUri());

        final WorkspaceTree tree = Workspace.getInstance().getWorkspaceTree();
        final WorkspaceAPI api = new WorkspaceAPI(tree);

        final URI textDocURI = params.getUri();
        final Path textDocPath = Path.of(textDocURI);
        final String textDocContent = DocumentTracker.getInstance().getContents(textDocURI);

        final List<Diagnostic> diagnostics = new ArrayList<>();

        logger.info("Attempting to parse starlark file for syntax highlighting.");
        try {
            final ParserInput input = ParserInput.fromString(textDocContent, textDocURI.toString());
            final StarlarkFile file = StarlarkFile.parse(input);

            // Go through all errors
            for (final SyntaxError err : file.errors()) {
                final Diagnostic diagnostic = new Diagnostic();
                diagnostic.setSeverity(DiagnosticSeverity.Error);
                diagnostic.setCode(DiagnosticCodes.SYNTAX_ERROR);
                diagnostic.setMessage(err.message());

                // TODO: All positions in the parser are off by one! Fix this generally in the AST.
                final Range range = new Range();
                range.setStart(new Position(err.location().line() - 1, err.location().column()));
                range.setEnd(new Position(err.location().line() - 1, 9999));

                diagnostic.setRange(range);
                diagnostics.add(diagnostic);
            }

            // Go through all statements. Literally the best code EVAR. We get +100 points for cleanliness.
            for (final Statement stmt : file.getStatements()) {
                if (stmt.kind() == Statement.Kind.EXPRESSION) {
                    final Expression expr = ((ExpressionStatement) stmt).getExpression();
                    if (expr.kind() == Expression.Kind.CALL) {

                        // Check all arguments of call functions
                        final CallExpression call = (CallExpression) expr;
                        for (final Argument arg : call.getArguments()) {
                            if (arg.getName() == null) {
                                continue;
                            }

                            if (arg.getName().equals("srcs")) {
                                // TODO(jarenm): Add support for sources.
                            }

                            // If this is the deps attribute
                            if (arg.getName().equals("deps")) {
                                final Expression argExpr = arg.getValue();

                                // If this is a list (should usually be a list)
                                if (argExpr.kind() == Expression.Kind.LIST_EXPR) {
                                    final ListExpression listExpr = (ListExpression) argExpr;

                                    // Go through each string element
                                    for (final Expression argElement : listExpr.getElements()) {
                                        if (argElement.kind() == Expression.Kind.STRING_LITERAL) {
                                            // This is a dep or src label
                                            final StringLiteral labelString = (StringLiteral) argElement;
                                            final int line = labelString.getLocation().line() - 1;
                                            final int colstart = labelString.getLocation().column();
                                            final int colend = colstart + labelString.getValue().length();

                                            try {
                                                final Label label = Label.parse(labelString.getValue());

                                                // Convert the label to a target. Get the parent of the text doc
                                                // because we don't want the BUILD file.
                                                final BuildTarget target = CompatabilityUtility.labelToBuildTarget(
                                                        label, textDocPath.getParent());

                                                logger.info("Validating package: " + label.value());
                                                logger.info("Path: " + target.getPath());
                                                logger.info("Name: " + target.getLabel());
                                                logger.info("PathwTarg: " + target.getPathWithTarget());

                                                // If target is invalid, say its invalid.
                                                if (!api.isValidTarget(target)) {
                                                    Diagnostic diag = new Diagnostic();
                                                    diag.setSeverity(DiagnosticSeverity.Error);
                                                    diag.setCode(DiagnosticCodes.INVALID_TARGET);
                                                    diag.setMessage(String.format("Target '%s' does not exist.",
                                                            labelString.getValue()));
                                                    diag.setRange(new Range(new Position(line, colstart),
                                                            new Position(line, colend)));
                                                    logger.info(labelString.getValue() + " does not exist.");
                                                    diagnostics.add(diag);
                                                }
                                            } catch (LabelSyntaxException e) {
                                                // If syntax is invalid, say its invalid.
                                                Diagnostic diag = new Diagnostic();
                                                diag.setSeverity(DiagnosticSeverity.Error);
                                                diag.setMessage("Invalid label syntax.");
                                                diag.setCode(DiagnosticCodes.INVALID_TARGET);
                                                diag.setRange(new Range(new Position(line, colstart),
                                                        new Position(line, colend)));
                                                logger.info(labelString.getValue() + " has invalid syntax.");
                                                diagnostics.add(diag);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Error | RuntimeException e) {
            logger.error("Parsing failed for an unknown reason!");
            logger.error(Logging.stackTraceToString(e));
        }

        final PublishDiagnosticsParams diagnosticsParams = new PublishDiagnosticsParams();
        diagnosticsParams.setUri(params.getUri().toString());
        diagnosticsParams.setDiagnostics(diagnostics);
        params.getClient().publishDiagnostics(diagnosticsParams);
    }
}
