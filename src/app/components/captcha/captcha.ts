import { afterNextRender, Component, ElementRef, output, viewChild } from '@angular/core';
import { environment } from '../../../environments/environment';

// turnstile lo deja el script que se carga en index.html.
declare const turnstile: {
  render: (elemento: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (widget?: string) => void;
};

// El script va con async y defer, asi que se le da hasta 10 segundos
// para aparecer antes de darlo por fallido.
const ESPERA_MS = 250;
const INTENTOS_MAX = 40;

@Component({
  selector: 'app-captcha',
  template: `<div #contenedor class="min-h-[65px]"></div>`,
})
export class Captcha {
  private contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');
  private widget = '';

  tokenGenerado = output<string>();
  fallo = output<void>();

  constructor() {
    // El widget se dibuja despues del primer render, cuando el div existe.
    afterNextRender(() => this.dibujar());
  }

  // Tras un error del servidor el token ya se gasto y hay que pedir otro.
  reiniciar() {
    if (this.widget && typeof turnstile !== 'undefined') {
      turnstile.reset(this.widget);
      this.tokenGenerado.emit('');
    }
  }

  // El componente puede quedar listo antes que el script: en vez de
  // rendirse al primer intento, se vuelve a mirar cada poco.
  private dibujar(intento = 0) {
    if (typeof turnstile === 'undefined') {
      if (intento >= INTENTOS_MAX) {
        this.fallo.emit();
        return;
      }

      setTimeout(() => this.dibujar(intento + 1), ESPERA_MS);
      return;
    }

    this.widget = turnstile.render(this.contenedor().nativeElement, {
      sitekey: environment.turnstileSiteKey,
      callback: (token: string) => this.tokenGenerado.emit(token),
      'error-callback': () => this.fallo.emit(),
      // El token de Turnstile caduca: al expirar se limpia para que
      // el formulario vuelva a pedirlo.
      'expired-callback': () => this.tokenGenerado.emit(''),
    });
  }
}
