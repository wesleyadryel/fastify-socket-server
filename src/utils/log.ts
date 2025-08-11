export class Log {
  static error(message: string, ...optionalParams: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...optionalParams);
  }

  static warning(message: string, ...optionalParams: unknown[]): void {
    console.warn(`[WARNING] ${message}`, ...optionalParams);
  }

  static log(message: string, ...optionalParams: unknown[]): void {
    if (process.env.Debug === 'true') {
      console.info(`[log] ${message}`, ...optionalParams);
    }
  }
}

export default Log;