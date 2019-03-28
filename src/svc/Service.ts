import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { RequestModel } from './RequestModel';
import axios, { AxiosRequestConfig, AxiosPromise } from 'axios';

const Pitometer = require('@pitometer/pitometer').Pitometer;
const PrometheusSource = require('@pitometer/source-prometheus').Source;
const ThresholdGrader = require('@pitometer/grader-threshold').Grader;

import { Logger } from '../lib/Logger';

@injectable()
export class Service {

  constructor() {}

  public async handleRequest(event: RequestModel): Promise<boolean> {
    const pitometer = new Pitometer();

    let prometheusUrl;
    if (process.env.NODE_ENV === 'production') {
      prometheusUrl =
        `http://prometheus-service.monitoring.svc.cluster.local/prometheus`;
    } else {
      prometheusUrl = 'http://localhost:9090/api/v1';
    }

    pitometer.addSource('Prometheus', new PrometheusSource({
      queryUrl: prometheusUrl,
    }));

    pitometer.addGrader('Threshold', new ThresholdGrader());

    // tslint:disable-next-line: max-line-length
    const monspecUrl = `https://raw.githubusercontent.com/${event.data.githuborg}/${event.data.service}/master/monspec/monspec.json`;

    const monspecResponse = await axios.get(monspecUrl);
    Logger.log(
      event.shkeptncontext,
      JSON.stringify(monspecResponse.data),
    );

    if (monspecResponse.data !== undefined) {
      try {
        const ewald = await pitometer.run(monspecResponse.data, 'prod');
        Logger.log(
          event.shkeptncontext,
          JSON.stringify(ewald.data),
        );
      } catch (e) {
        Logger.log(
          event.shkeptncontext,
          JSON.stringify(e),
          'ERROR',
        );
      }
    }

    return true;
  }
}
