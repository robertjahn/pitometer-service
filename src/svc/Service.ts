import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { RequestModel } from './RequestModel';
import axios, { AxiosRequestConfig, AxiosPromise, AxiosError } from 'axios';

const Pitometer = require('@pitometer/pitometer').Pitometer;
// tslint:disable-next-line: variable-name
const PrometheusSource = require('@pitometer/source-prometheus').Source;
// tslint:disable-next-line: variable-name
const DynatraceSource = require('@pitometer/source-dynatrace').Source;
// tslint:disable-next-line: variable-name
const ThresholdGrader = require('@pitometer/grader-threshold').Grader;

import { Logger } from '../lib/Logger';
import { Keptn } from '../lib/Keptn';
import { Credentials } from '../lib/Credentials';

@injectable()
export class Service {

  constructor() {}

  public async handleRequest(event: RequestModel): Promise<boolean> {
    const pitometer = new Pitometer();

    let prometheusUrl;
    if (process.env.NODE_ENV === 'production') {
      prometheusUrl =
        `http://prometheus-service.monitoring.svc.cluster.local:8080/api/v1/query`;
    } else {
      prometheusUrl = 'http://localhost:9090/api/v1/query';
    }

    this.addPrometheusSource(event, pitometer, prometheusUrl);

    await this.addDynatraceSource(event, pitometer);

    pitometer.addGrader('Threshold', new ThresholdGrader());

    // tslint:disable-next-line: max-line-length
    const perfspecUrl = `https://raw.githubusercontent.com/${event.data.githuborg}/${event.data.service}/master/monspec/monspec_${event.data.stage}.json`;
    let perfspecResponse;

    try {
      perfspecResponse = await axios.get(perfspecUrl, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
    } catch (e) {
      Logger.log(
        event.shkeptncontext,
        `No perfspec file defined for `
        + `${event.data.project}:${event.data.service}:${event.data.stage}`);
      return true;
    }

    Logger.log(
      event.shkeptncontext,
      perfspecResponse.data,
    );

    if (perfspecResponse.data !== undefined) {
      try {
        const evaluationResult = await pitometer.run(perfspecResponse.data, 'prod');
        Logger.log(
          event.shkeptncontext,
          evaluationResult,
        );

        this.handleEvaluationResult(evaluationResult, event);
      } catch (e) {
        console.log(e);
        Logger.log(
          event.shkeptncontext,
          JSON.stringify(e.config),
          'ERROR',
        );
      }
    }

    return true;
  }

  private addPrometheusSource(event: RequestModel, pitometer: any, prometheusUrl: any) {
    Logger.log(event.shkeptncontext, `Adding Prometheus source`);
    pitometer.addSource('Prometheus', new PrometheusSource({
      queryUrl: prometheusUrl,
    }));
  }

  private async addDynatraceSource(event: RequestModel, pitometer: any) {
    const dynatraceCredentials = await Credentials.getInstance().getDynatraceCredentials();
    if (dynatraceCredentials !== undefined &&
      dynatraceCredentials.tenantId !== undefined &&
      dynatraceCredentials.apiToken !== undefined) {
      Logger.log(
        event.shkeptncontext,
        `Adding Dynatrace Source for tenant ${dynatraceCredentials.tenantId}`,
      );
      pitometer.addSource('Dynatrace', new DynatraceSource({
        baseUrl: `https://${dynatraceCredentials.tenantId}.live.dynatrace.com`,
        apiToken: dynatraceCredentials.apiToken,
        log: console.log,
      }));
    }
  }

  async handleEvaluationResult(evaluationResult: any, sourceEvent: RequestModel): Promise<void> {
    const evaluationPassed: boolean =
      evaluationResult.result !== undefined && evaluationResult.result === 'pass';

    Logger.log(sourceEvent.shkeptncontext, `Evaluation passed: ${evaluationPassed}`);

    const event: RequestModel = new RequestModel();
    event.type = RequestModel.EVENT_TYPES.EVALUATION_DONE;
    event.shkeptncontext = sourceEvent.shkeptncontext;
    event.data.githuborg = sourceEvent.data.githuborg;
    event.data.teststategy = sourceEvent.data.teststategy;
    event.data.deploymentstrategy = sourceEvent.data.deploymentstrategy;
    event.data.stage = sourceEvent.data.stage;
    event.data.service = sourceEvent.data.service;
    event.data.image = sourceEvent.data.image;
    event.data.tag = sourceEvent.data.tag;
    event.data.evaluationpassed = evaluationPassed;

    Keptn.sendEvent(event);
  }
}
