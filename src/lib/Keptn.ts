import { RequestModel } from '../svc/RequestModel';
import axios, { AxiosRequestConfig, AxiosPromise, AxiosError } from 'axios';
import { Logger } from './Logger';

export class Keptn {
  static async sendEvent(event: RequestModel): Promise<void> {
    Logger.log(event.shkeptncontext, `Sending event: ${JSON.stringify(event)}`);
    if (!(process.env.NODE_ENV === 'production')) {
      return;
    }
    try {
      await axios.post('http://event-broker.keptn.svc.cluster.local/keptn', event);
    } catch (e) {
      Logger.log(event.shkeptncontext, 'Could not send event to event-broker', 'ERROR');
    }
  }
}
