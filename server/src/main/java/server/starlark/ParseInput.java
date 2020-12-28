package server.starlark;

import com.google.common.base.Preconditions;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class ParseInput {
    private final byte[] bytes;
    private final Path path;

    private ParseInput(byte[] bytes, Path path) {
        this.bytes = Preconditions.checkNotNull(bytes);
        this.path = Preconditions.checkNotNull(path);
    }

    public static ParseInput fromFile(File file) throws IOException {
        final Path path = Paths.get(file.getAbsolutePath());
        final byte[] bytes = Files.readAllBytes(path);

        return new ParseInput(bytes, path);
    }

    public byte[] getBytes() {
        return bytes;
    }

    public Path getPath() {
        return path;
    }
}
