export class Logger {
  static log(keptnContext: string, msg: string, logLevel: string = 'INFO'): void {
    console.log(JSON.stringify({
      keptnContext,
      logLevel,
      msg,
      keptnService: 'pitometer-service',
    }));
  }
}
