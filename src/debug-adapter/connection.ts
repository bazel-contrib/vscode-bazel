// Copyright 2018 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { EventEmitter } from "events";
import * as jspb from "google-protobuf";
import * as net from "net";
import * as skylark_debugging from "../protos/src/main/java/com/google/devtools/build/lib/skylarkdebug/proto/skylark_debugging_pb";

/**
 * Manages the connection between the debug adapter and the debugging server
 * running in Bazel.
 *
 * This class acts as a Node event emitter for asynchronous events from the
 * server, and provides a Promise-based API for handling responses from
 * requests.
 */
export class BazelDebugConnection extends EventEmitter {
  /** The socket used to connect to the debugging server in Bazel. */
  private socket: net.Socket;

  /**
   * A buffer that stores data read from the socket until a complete message is
   * available.
   */
  private buffer: Buffer;

  /**
   * A monotonically increasing sequence number used to uniquely identify
   * requests.
   */
  private sequenceNumber = 1;

  /**
   * Keeps track of promises for responses that have not yet been received from
   * the server.
   *
   * When the debug adapter sends a request to Bazel, a promise for the response
   * is created and the resolve function for that promise is stored in this map,
   * keyed by the sequence number of the request. Then, when the response with
   * the matching sequence number is received from the server, we can look up
   * the resolver, call it, and continue execution of the client code waiting on
   * the promise.
   */
  private pendingResolvers = new Map<
    number,
    (event: skylark_debugging.DebugEvent) => void
  >();

  /**
   * Initializes a new debug connection and connects to the server.
   *
   * @param host The host name to connect to.
   * @param port The port number to connect to.
   */
  public constructor(
    host: string,
    port: number,
    private logger: (message: string, ...objects: any[]) => void,
  ) {
    super();

    this.buffer = null;
    this.tryToConnect(host, port);
  }

  /**
   * Sends a request to the Bazel debug server and returns a promise for its
   * response.
   *
   * @param builder A function that takes a {@code DebugRequest} proto whose
   *     sequence number has been prepopulated. The function is expected to
   *     fill in the rest of the payload with whatever content is appropriate
   *     for the request being sent.
   * @returns A {@code Promise} for the response to the request.
   */
  public sendRequest(
    builder: (request: skylark_debugging.DebugRequest) => void,
  ): Promise<skylark_debugging.DebugEvent> {
    const request = new skylark_debugging.DebugRequest();
    const sequenceNumber = this.sequenceNumber++;
    request.setSequenceNumber(sequenceNumber);

    const promise = new Promise<skylark_debugging.DebugEvent>((resolve) => {
      this.pendingResolvers.set(sequenceNumber, resolve);
    });

    builder(request);
    this.writeLengthDelimitedMessage(request);
    return promise;
  }

  /**
   * Makes an attempt to connect to the Bazel debug server.
   *
   * If the connection is not successful (for example, if Bazel is still
   * starting up and has not opened the socket yet), this function will wait one
   * second and make another attempt, up to a total of five attempts. If the
   * fifth attempt is unsuccessful, an error will be thrown.
   *
   * @param host The host name to connect to.
   * @param port The port number to connect to.
   * @param attempt The number of the attempt being made. Defaults to 1.
   */
  private tryToConnect(host: string, port: number, attempt: number = 1) {
    const socket = new net.Socket()
      .on("connect", () => {
        this.socket = socket;
        socket.on("data", (chunk) => {
          this.consumeChunk(chunk);
        });
        this.emit("connect");
      })
      .on("error", (error) => {
        if (attempt <= 5) {
          setTimeout(() => {
            this.tryToConnect(host, port, attempt + 1);
          }, 1000);
        } else {
          this.emit("error", error);
        }
      });
    socket.connect(
      port,
      host,
    );
  }

  /**
   * Writes a varint-length-delimited message to the socket.
   *
   * @param message The message to write.
   */
  private writeLengthDelimitedMessage(message: jspb.Message) {
    const serializedRequestBytes = message.serializeBinary();

    // JSPB provides no API for varint-length-delimited messages, but worse, it
    // also apparently provides no low-level API for writing individual varints.
    // We hack around it by writing a fake "message" containing a single varint
    // at field number 1 and then peeling off the first byte (the field tag).
    const writer = new jspb.BinaryWriter();
    writer.writeUint64(1, serializedRequestBytes.byteLength);

    this.socket.write(writer.getResultBuffer().subarray(1));
    this.socket.write(serializedRequestBytes);
  }

  /**
   * Reads a varint-length-delimited message from the data buffer.
   *
   * @param messageType The type of message to read.
   * @returns The message that was read if the complete message was available in
   *     the buffer. If there was not a complete message in the buffer, this
   *     function returns {@code undefined}.
   */
  private readLengthDelimitedMessage<T extends jspb.Message>(
    messageType: {
      new (): T;
    } & typeof jspb.Message,
  ): T | undefined {
    // Since JSPB doesn't expose low-level coding APIs here, we need to create
    // a fake "message" containing the upcoming data as a field 1 varint so that
    // we can read it. 11 bytes is enough to hold the field tag (the integer 8
    // below) and the largest possible varint.
    const fakeMessageBuffer = new Uint8Array(11);
    fakeMessageBuffer.set([8], 0);
    fakeMessageBuffer.set(
      this.buffer.subarray(0, Math.min(this.buffer.byteLength, 10)),
      1,
    );
    const varintReader = new jspb.BinaryReader(fakeMessageBuffer);
    varintReader.nextField();
    const messageLength = varintReader.readUint64();
    const varintLength = varintReader.getCursor() - 1;

    // If the buffer doesn't have enough data yet, wait until more comes along
    // the wire.
    if (this.buffer.byteLength < messageLength + varintLength) {
      return undefined;
    }

    // Create a reader over the slice of the buffer that contains the message
    // data; if the buffer has data for more than one message, we need to make
    // sure that decoding stops after the first one.
    const messageReader = new jspb.BinaryReader(
      this.buffer,
      varintLength,
      messageLength,
    );

    const message = new messageType();
    messageType.deserializeBinaryFromReader(message, messageReader);

    // Remove the data that was decoded from the buffer before returning.
    this.buffer = this.buffer.slice(varintLength + messageLength);

    return message;
  }

  /**
   * Consumes a chunk of data from the socket and decodes an event/response out
   * of the data received so far, if possible.
   *
   * If there is not enough data in the buffer for a full event, this method
   * tracks the chunk and then the connection waits for more data to try to
   * decode again.
   *
   * @param chunk A chunk of bytes from the socket.
   */
  private consumeChunk(chunk: Buffer) {
    this.append(chunk);

    while (true) {
      const event = this.readLengthDelimitedMessage(
        skylark_debugging.DebugEvent,
      );
      if (event === undefined) {
        // This occurs if there is a partial message in the buffer; stop reading
        // and wait for more data.
        return;
      }

      const sequenceNumber = event.getSequenceNumber();
      if (sequenceNumber) {
        const handler = this.pendingResolvers.get(sequenceNumber);
        if (handler) {
          this.pendingResolvers.delete(sequenceNumber);
          handler(event);
        }
      } else {
        this.emit("event", event);
      }
    }
  }

  /** Appends a chunk of data to the buffer, resizing it as needed. */
  private append(chunk: Buffer) {
    if (!this.buffer) {
      this.buffer = chunk;
    } else {
      // Buffers can't be grown after allocation; we create a new one and copy
      // both blobs of data into it.
      const currentLength = this.buffer.byteLength;
      const newBuffer = Buffer.alloc(currentLength + chunk.byteLength);
      this.buffer.copy(newBuffer, 0);
      chunk.copy(newBuffer, currentLength);
      this.buffer = newBuffer;
    }
  }
}
