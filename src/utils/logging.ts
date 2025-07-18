import * as fs from 'fs';
import * as path from 'path';

export class FileLogger {
  private logFile: string;
  private debugFile: string;
  // private persistenceDir: string; // Removed unused property

  constructor(persistenceDir: string = './logs') {
    // this.persistenceDir = persistenceDir; // Removed unused assignment
    
    // Ensure logs directory exists
    if (!fs.existsSync(persistenceDir)) {
      fs.mkdirSync(persistenceDir, { recursive: true });
    }
    
    this.logFile = path.join(persistenceDir, 'pipeline-execution.log');
    this.debugFile = path.join(persistenceDir, 'debug.log');
  }

  private writeToFile(file: string, message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    try {
      fs.appendFileSync(file, logMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(message: string, category: string = 'INFO') {
    const formattedMessage = `[${category}] ${message}`;
    this.writeToFile(this.logFile, formattedMessage);
    console.log(formattedMessage);
  }

  debug(message: string) {
    const formattedMessage = `[DEBUG] ${message}`;
    this.writeToFile(this.debugFile, formattedMessage);
    console.log(formattedMessage);
  }

  error(message: string, error?: any) {
    const errorMessage = error ? `${message}: ${error.message || error}` : message;
    const formattedMessage = `[ERROR] ${errorMessage}`;
    this.writeToFile(this.logFile, formattedMessage);
    this.writeToFile(this.debugFile, formattedMessage);
    console.error(formattedMessage);
  }

  info(message: string) {
    this.log(message, 'INFO');
  }

  warn(message: string) {
    this.log(message, 'WARN');
  }

  // Rotate logs if they get too large (>10MB)
  rotateLogs() {
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    [this.logFile, this.debugFile].forEach(file => {
      try {
        const stats = fs.statSync(file);
        if (stats.size > maxSize) {
          const backupFile = `${file}.${Date.now()}.bak`;
          fs.renameSync(file, backupFile);
          this.log(`Log file rotated: ${file} -> ${backupFile}`);
        }
      } catch (error) {
        // File doesn't exist or other error, ignore
      }
    });
  }
}

// Create singleton instance
export const logger = new FileLogger('./logs'); 