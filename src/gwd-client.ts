import WebSocket from "ws";

export interface GwdMessage {
  Cmd: string;
  MT: string; // "Req" | "Rsp" | "Ntf" | "Evt"
  TID?: number;
  Data?: any;
  State?: number;
}

interface PendingRequest {
  resolve: (message: GwdMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

type GwdEventHandler = (message: GwdMessage) => void;

export class GwdClient {
  private ws!: WebSocket;
  private tid = 1;
  private heartbeatTimer?: NodeJS.Timeout;

  private static readonly heartbeatIntervalMs = 60_000;

  // Requests waiting for their corresponding TID response
  private readonly pending = new Map<number, PendingRequest>();

  // Unsolicited messages/events received from the GWD
  private readonly pushes: GwdMessage[] = [];

  // Event listeners
  private readonly eventHandlers: GwdEventHandler[] = [];

  // ============================================================
  // CONNECT
  // ============================================================

  async connect(
    //host = "localhost",
    host = "10.1.112.103",
    port = 8766
  ): Promise<void> {
    this.ws = new WebSocket(`wss://${host}:${port}`, {
      rejectUnauthorized: false,
    });

    // ----------------------------------------------------------
    // All incoming WebSocket messages arrive here
    // ----------------------------------------------------------

    this.ws.on("message", (raw) => {
      const text = raw.toString();

      console.log("\n<-- WS RECEIVED");
      console.log(text);

      let msg: GwdMessage;

      try {
        msg = JSON.parse(text);
      } catch (err) {
        console.error(
          "[WS] Could not parse message as JSON:",
          err
        );

        return;
      }

      console.log(
        "[WS] Currently pending TIDs:",
        [...this.pending.keys()]
      );

      // --------------------------------------------------------
      // Check whether this is the response to a request
      // --------------------------------------------------------

      const waiter =
        msg.TID !== undefined
          ? this.pending.get(msg.TID)
          : undefined;

      if (waiter && msg.TID !== undefined) {
        console.log(
          `[WS MATCH] TID ${msg.TID} -> ${msg.Cmd}`
        );

        clearTimeout(waiter.timer);

        this.pending.delete(msg.TID);

        waiter.resolve(msg);

        return;
      }

      // --------------------------------------------------------
      // Otherwise this is an unsolicited message / event
      // --------------------------------------------------------

      console.log(
        `[WS EVENT/PUSH] Cmd=${msg.Cmd} MT=${msg.MT} TID=${msg.TID}`
      );

      this.pushes.push(msg);

      // Notify registered listeners
      for (const handler of [...this.eventHandlers]) {
        try {
          handler(msg);
        } catch (err) {
          console.error(
            "[WS EVENT HANDLER ERROR]",
            err
          );
        }
      }
    });

    // ----------------------------------------------------------
    // Connection closed
    // ----------------------------------------------------------

    this.ws.on("close", (code, reason) => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = undefined;
      }

      const reasonText = reason.toString();

      console.log(
        `[WS CLOSED] code=${code} reason=${reasonText}`
      );

      // Reject all requests which are still waiting
      for (const [tid, waiter] of this.pending) {
        clearTimeout(waiter.timer);

        waiter.reject(
          new Error(
            `WebSocket closed while waiting for TID ${tid}. ` +
              `code=${code} reason=${reasonText}`
          )
        );
      }

      this.pending.clear();
    });

    // ----------------------------------------------------------
    // Wait until WebSocket is connected
    // ----------------------------------------------------------

    return new Promise((resolve, reject) => {
      this.ws.once("open", () => {
        console.log("[WS OPEN]");

        this.heartbeatTimer = setInterval(() => {
          void this.request("Heartbeat", {})
            .then((response) => {
              console.log(
                "[WS HEARTBEAT] Response:",
                JSON.stringify(response, null, 2)
              );
            })
            .catch((error: unknown) => {
              console.error("[WS HEARTBEAT ERROR]", error);
            });
        }, GwdClient.heartbeatIntervalMs);
        this.heartbeatTimer.unref();

        resolve();
      });

      this.ws.once("error", (err) => {
        console.error(
          "[WS ERROR]",
          err
        );

        reject(err);
      });
    });
  }

  // ============================================================
  // REQUEST
  // ============================================================

  async request(
    cmd: string,
    data: any = {},
    timeoutMs = 10_000
  ): Promise<GwdMessage> {
    // Your GWD requests start at TID 7
    if (this.tid < 6) {
      this.tid = 6;
    }

    const tid = ++this.tid;

    const msg: GwdMessage = {
      Cmd: cmd,
      MT: "Req",
      TID: tid,
      Data: data,
    };

    // ----------------------------------------------------------
    // Make sure WebSocket is connected
    // ----------------------------------------------------------

    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error(
        `WebSocket is not open. State: ${this.ws?.readyState}`
      );
    }

    // ----------------------------------------------------------
    // Create response Promise
    // ----------------------------------------------------------

    const replyPromise = new Promise<GwdMessage>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          console.error(
            `[WS TIMEOUT] Cmd=${cmd} TID=${tid}`
          );

          console.error(
            "[WS TIMEOUT] Pending TIDs:",
            [...this.pending.keys()]
          );

          this.pending.delete(tid);

          reject(
            new Error(
              `Timeout waiting for ${cmd} ` +
                `(TID ${tid}, timeout ${timeoutMs} ms)`
            )
          );
        }, timeoutMs);

        timer.unref();

        this.pending.set(tid, {
          resolve,
          reject,
          timer,
        });
      }
    );

    // ----------------------------------------------------------
    // Send request
    // ----------------------------------------------------------

    console.log("\n--> WS SEND ");
    console.log(
      `Cmd=${cmd} MT=Req TID=${tid}`
    );

    console.log(
      JSON.stringify(msg, null, 2)
    );


    this.ws.send(
      JSON.stringify(msg),
      (error) => {
        if (!error) {
          return;
        }

        console.error(
          `[WS SEND ERROR] Cmd=${cmd} TID=${tid}`,
          error
        );

        const waiter = this.pending.get(tid);

        if (waiter) {
          clearTimeout(waiter.timer);

          this.pending.delete(tid);

          waiter.reject(error);
        }
      }
    );

    return replyPromise;
  }

  // ============================================================
  // LOGIN
  // ============================================================

  async login(
    user = "system",
    password = "R0FU"
  ): Promise<GwdMessage> {
    return this.request("Login", {
      User: user,
      Password: password,
      OnlineDecision: true,
      Info: "",
    });
  }

  // ============================================================
  // REGISTER EVENT
  // ============================================================

  async registerEvent(
    event: string
  ): Promise<GwdMessage> {
    console.log(
      `[WS] Registering event: ${event}`
    );

    return this.request(
      "RegisterEvent",
      {
        Event: event,
      }
    );
  }

  // ============================================================
  // PERMANENT EVENT LISTENER
  //
  // Useful if you want to see ALL events during the test.
  // ============================================================

  onEvent(
    handler: GwdEventHandler
  ): void {
    this.eventHandlers.push(handler);
  }

  // ============================================================
  // REMOVE EVENT LISTENER
  // ============================================================

  offEvent(
    handler: GwdEventHandler
  ): void {
    const index =
      this.eventHandlers.indexOf(handler);

    if (index !== -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  // ============================================================
  // WAIT FOR A SPECIFIC EVENT
  //
  // Very useful with Playwright.
  //
  // Example:
  //
  // const event = await gwd.waitForEvent(
  //   msg => msg.Cmd === "App.Something"
  // );
  // ============================================================

  waitForEvent(
    predicate: (message: GwdMessage) => boolean,
    timeoutMs = 10_000
  ): Promise<GwdMessage> {
    return new Promise(
      (resolve, reject) => {
        let timer: NodeJS.Timeout;

        const handler: GwdEventHandler =
          (message) => {
            let matches = false;

            try {
              matches =
                predicate(message);
            } catch (err) {
              console.error(
                "[WS EVENT PREDICATE ERROR]",
                err
              );

              return;
            }

            if (!matches) {
              return;
            }

            clearTimeout(timer);

            this.offEvent(handler);

            console.log(
              `[WS EVENT MATCH] Cmd=${message.Cmd} ` +
                `MT=${message.MT} TID=${message.TID}`
            );

            resolve(message);
          };

        this.onEvent(handler);

        timer = setTimeout(() => {
          this.offEvent(handler);

          reject(
            new Error(
              `Timeout waiting for WebSocket event ` +
                `after ${timeoutMs} ms`
            )
          );
        }, timeoutMs);

        timer.unref();
      }
    );
  }

  // ============================================================
  // SEND AN EVENT for successfull of failed dispatch process
  // ============================================================
sendEvent(
  cmd: string,
  data: any = {}
): void {
  if (this.ws?.readyState !== WebSocket.OPEN) {
    throw new Error(
      `WebSocket is not open. State: ${this.ws?.readyState}`
    );
  }

  const msg: GwdMessage = {
    Cmd: cmd,
    MT: "Evt",
    Data: data,
  };

  console.log("\n--> WS SEND EVENT ==========");
  console.log(`Cmd=${cmd} MT=Evt`);
  console.log(JSON.stringify(msg, null, 2));

  this.ws.send(
    JSON.stringify(msg),
    (error) => {
      if (error) {
        console.error(
          `[WS EVENT SEND ERROR] Cmd=${cmd}`,
          error
        );
      }
    }
  );
}

sendDispatchProcessFeedback(
  data: any
): void {
  this.sendEvent(
    "App.DispatchProcessFeedback",
    data
  );
}

  // ============================================================
  // GET ALREADY RECEIVED PUSH MESSAGES
  // ============================================================

  getPushes(): readonly GwdMessage[] {
    return this.pushes;
  }

  // ============================================================
  // CLOSE
  // ============================================================

  close(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (
      this.ws &&
      (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      )
    ) {
      this.ws.close();
    }
  }
}