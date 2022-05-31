import { ServerConnection } from '@jupyterlab/services';
import { URLExt } from '@jupyterlab/coreutils';

export class LoggerWS {
  //private _id: string;
  private _ws: WebSocket;
  private _msgs: string[];
  private _isReady: boolean;

  constructor(clientID: string) {
    //this._id = clientID;
    this._msgs = [];
    this._isReady = false;
    this._connect();
  }

  get ready(): boolean {
    return this._isReady;
  }

  dispose(): void {
    this._ws.close();
  }

  write(msg: string): void {
    if (this.ready) {
      this._ws.send(msg);
    }
    this._msgs.push(msg);
  }

  private _connect(): void {
    const server = ServerConnection.makeSettings();
    this._ws = new WebSocket(URLExt.join(server.wsUrl, 'logger'));
    this._ws.onopen = this._onConection;
    this._ws.onerror = this._onError;
    this._ws.onclose = this._onClose;
  }

  private _sendAll(): void {
    this._msgs.forEach(msg => this._ws.send(msg));
    this._msgs = [];
  }

  private _onConection = (): void => {
    this._isReady = true;
    this._sendAll();
  };

  private _onError = (error: any): void => {
    this._isReady = false;
  };

  private _onClose = (): void => {
    this._isReady = false;
    setTimeout(() => this._connect(), 1000);
  };
}
