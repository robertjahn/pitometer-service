export class Logger {
  static log(keptnContext: string, message: string, logLevel: string = 'INFO'): void {
    console.log(JSON.stringify({
      keptnContext,
      logLevel,
      message,
      keptnService: 'pitometer-service',
    }));
  }
}
