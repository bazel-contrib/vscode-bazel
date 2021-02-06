package server.buildifier;

public final class LintWarningPosition {
    /**
     * Line in the file where the warning is located.
     */
    private int line;

    /**
     * Column in the line where the warning is located.
     */
    private int column;

    public int getLine() {
        return line;
    }

    public void setLine(int line) {
        this.line = line;
    }

    public int getColumn() {
        return column;
    }

    public void setColumn(int column) {
        this.column = column;
    }
}