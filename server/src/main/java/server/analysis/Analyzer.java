package server.analysis;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

public class Analyzer {
    private static final Logger logger = LogManager.getLogger(Analyzer.class);
    private static final Analyzer instance = new Analyzer();

    private boolean isInitialized;

    private Analyzer() {
        isInitialized = false;
    }

    public static Analyzer getInstance() {
        return instance;
    }

    public void initialize(AnalyzerConfig config) {
        if (isInitialized) {
            logger.warn("Already initialized.");
            return;
        }

        Preconditions.checkNotNull(config);
        Preconditions.checkNotNull(config.getRootPath());

        logger.info("Root=" + config.getRootPath());

        try {
            List<Path> files = Files.walk(config.getRootPath())
                    .filter(Utilities::isBuildFile)
                    .collect(Collectors.toList());

            for (Path file : files) {
                logger.info("BUILD File name=" + file);
            }

            files = Files.walk(config.getRootPath())
                    .filter(Utilities::isWorkspaceFile)
                    .collect(Collectors.toList());

            for (Path file : files) {
                logger.info("WORKSPACE File name=" + file);
            }
        } catch (Exception e) {
            logger.error("Failed to walk=" + e.getMessage());
        }

        isInitialized = true;
    }
}
