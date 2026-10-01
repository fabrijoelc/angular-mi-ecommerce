import { afterNextRender, Component, ElementRef, output, viewChild } from '@angular/core';
import { environment } from '../../../environments/environment';

// turnstile lo deja el script que se carga en index.html.
declare const turnstile: {
  render: (elemento: HTMLElement, opciones: Record<string, unknown>) => string;
  reset: (widget?: string) => void;
};

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
    afterNextRender(() => {
      if (typeof turnstile === 'undefined') {
        this.fallo.emit();
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
    });
  }

  // Tras un error del servidor el token ya se gasto y hay que pedir otro.
  reiniciar() {
    if (typeof turnstile !== 'undefined' && this.widget) {
      turnstile.reset(this.widget);
      this.tokenGenerado.emit('');
    }
  }
}
