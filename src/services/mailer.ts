import { env } from "../config/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Desarrollo: imprime el correo en la terminal.
 * Sirve para probar el flujo sin configurar ningún proveedor (costo $0).
 */
class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    console.log(
      `\n─── 📧 correo (driver: console) ───\n` +
        `Para:     ${message.to}\n` +
        `Asunto:   ${message.subject}\n` +
        `${message.text}\n` +
        `───────────────────────────────────\n`,
    );
  }
}

/**
 * Tests: guarda los envíos en memoria para poder leer el OTP.
 * Nunca se activa fuera de NODE_ENV=test.
 */
class MemoryMailer implements Mailer {
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
  }

  lastTo(address: string): MailMessage | undefined {
    for (let i = this.outbox.length - 1; i >= 0; i -= 1) {
      if (this.outbox[i].to === address) {
        return this.outbox[i];
      }
    }
    return undefined;
  }

  clear(): void {
    this.outbox.length = 0;
  }
}

const memoryMailer = new MemoryMailer();

export const mailer: Mailer =
  env.MAIL_DRIVER === "memory" ? memoryMailer : new ConsoleMailer();

/** Solo para tests: permite leer el OTP enviado. */
export const memoryMailbox = memoryMailer;
