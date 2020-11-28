package server.util;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.Position;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.util.Comparator;

public class Positions {

    private static final Logger logger = LogManager.getLogger(Positions.class);

    public static final Comparator<Position> COMPARATOR = (Position p1, Position p2) -> {
        if (p1.getLine() != p2.getLine()) {
            return p1.getLine() - p2.getLine();
        }
        return p1.getCharacter() - p2.getCharacter();
    };

    public static boolean valid(Position p) {
        return p.getLine() >= 0 || p.getCharacter() >= 0;
    }

    public static int getOffset(String string, Position position) {
        int line = position.getLine();
        int character = position.getCharacter();
        int currentIndex = 0;
        if (line > 0) {
            BufferedReader reader = new BufferedReader(new StringReader(string));
            try {
                int readLines = 0;
                while (true) {
                    char currentChar = (char) reader.read();
                    if (currentChar == (char) -1) {
                        return -1;
                    }
                    currentIndex++;
                    if (currentChar == '\n') {
                        readLines++;
                        if (readLines == line) {
                            break;
                        }
                    }
                }
            } catch (IOException e) {
                return -1;
            }
            try {
                reader.close();
            } catch (IOException e) {
                logger.error(e);
            }
        }
        return currentIndex + character;
    }
}
