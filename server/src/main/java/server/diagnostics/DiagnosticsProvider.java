package server.diagnostics;

import com.google.common.base.Preconditions;
import net.starlark.java.syntax.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.Diagnostic;
import org.eclipse.lsp4j.DiagnosticSeverity;
import org.eclipse.lsp4j.PublishDiagnosticsParams;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPI;
import server.bazel.interp.Label;
import server.bazel.tree.BuildTarget;
import server.bazel.tree.WorkspaceTree;
import server.utils.DocumentTracker;
import server.utils.Logging;
import server.workspace.Workspace;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

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
        final String textDocContent = DocumentTracker.getInstance().getContents(textDocURI);

        final List<Diagnostic> diagnostics = new ArrayList<>();

        logger.info("Attempting to parse starlark file for syntax highlighting.");
        try {
            final ParserInput input = ParserInput.fromString(textDocContent, textDocURI.toString());
            final StarlarkFile file = StarlarkFile.parse(input);

            // Go through all statements
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

                            // If this is the srcs or deps attribute
                            if (arg.getName().equals("srcs") || arg.getName().equals("deps")) {
                                final Expression argExpr = arg.getValue();

                                // If this is a list (should usually be a list)
                                if (argExpr.kind() == Expression.Kind.LIST_EXPR) {
                                    final ListExpression listExpr = (ListExpression) argExpr;

                                    // Go through each string element
                                    for (final Expression argElement : listExpr.getElements()) {
                                        if (argElement.kind() == Expression.Kind.STRING_LITERAL) {
                                            final StringLiteral literalStr = (StringLiteral) argElement;

//                                            Label.parse(literalStr);

                                            Diagnostic d = new Diagnostic();

//                                            BuildTarget targ = new BuildTarget(
//                                            boolean isValid = api.isValidTarget(
//                                            d.setSeverity(DiagnosticSeverity.Error
//                                            diagnostics.add(
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
    }
}
