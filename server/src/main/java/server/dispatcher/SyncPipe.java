package server.dispatcher;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Runnable that acts as the command line.
 */
class SyncPipe implements Runnable {
    private final InputStream inputStream;
    private final OutputStream outputStream;

    public SyncPipe(InputStream inputStream, OutputStream outputStream) {
        this.inputStream = inputStream;
        this.outputStream = outputStream;
    }

    @Override
    public void run() {
        try {
            final byte[] buffer = new byte[1024];
            for(int length = 0; (length = inputStream.read(buffer)) != -1;) {
                outputStream.write(buffer, 0, length);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}